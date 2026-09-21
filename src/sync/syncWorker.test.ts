import type { SQLiteDatabase } from 'expo-sqlite';

import { ApiError } from '@/api/client';
import { postSyncBatch } from '@/api/sync';
import * as queue from '@/sync/syncQueue';
import { dispatchQueue, MAX_ATTEMPTS } from '@/sync/syncWorker';

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'clave-nueva'),
}));

jest.mock('@/api/sync', () => ({
  postSyncBatch: jest.fn(),
}));

jest.mock('@/sync/syncQueue', () => ({
  ...jest.requireActual('@/sync/syncQueue'),
  nextBatch: jest.fn(),
  assignBatchKey: jest.fn(),
  bumpAttempts: jest.fn(),
  clearBatchKey: jest.fn(),
  removeOperations: jest.fn(),
  markFailed: jest.fn(),
  countPendingOperations: jest.fn(),
}));

const post = postSyncBatch as jest.MockedFunction<typeof postSyncBatch>;
const nextBatch = queue.nextBatch as jest.MockedFunction<typeof queue.nextBatch>;
const assignBatchKey = queue.assignBatchKey as jest.MockedFunction<typeof queue.assignBatchKey>;
const clearBatchKey = queue.clearBatchKey as jest.MockedFunction<typeof queue.clearBatchKey>;
const removeOperations = queue.removeOperations as jest.MockedFunction<typeof queue.removeOperations>;
const markFailed = queue.markFailed as jest.MockedFunction<typeof queue.markFailed>;
const bumpAttempts = queue.bumpAttempts as jest.MockedFunction<typeof queue.bumpAttempts>;
const countPending = queue.countPendingOperations as jest.MockedFunction<
  typeof queue.countPendingOperations
>;

const db = {} as SQLiteDatabase;

function operation(overrides: Partial<queue.QueuedOperation> = {}): queue.QueuedOperation {
  return {
    clientOperationId: 'op-1',
    visitId: 'v-1',
    form: { templateKey: 'mantenimiento-general', responses: { workedHours: 8 } },
    attempts: 0,
    batchKey: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  countPending.mockResolvedValue(0);
});

describe('dispatchQueue', () => {
  it('con la cola vacía no toca la red', async () => {
    nextBatch.mockResolvedValue([]);

    const result = await dispatchQueue(db);

    expect(post).not.toHaveBeenCalled();
    expect(result.sent).toBe(0);
  });

  it('guarda la clave del lote ANTES de enviarlo', async () => {
    nextBatch.mockResolvedValue([operation()]);
    post.mockResolvedValue({ results: [] });
    const orden: string[] = [];
    assignBatchKey.mockImplementation(async () => {
      orden.push('guardar-clave');
    });
    post.mockImplementation(async () => {
      orden.push('enviar');
      return { results: [] };
    });

    await dispatchQueue(db);

    // Si el orden se invirtiera, un corte de red en el medio dejaría las operaciones sin clave y el
    // reintento saldría como un envío nuevo: el backend lo aplicaría dos veces.
    expect(orden).toEqual(['guardar-clave', 'enviar']);
    expect(assignBatchKey).toHaveBeenCalledWith(db, ['op-1'], 'clave-nueva');
  });

  it('las operaciones aplicadas y las duplicadas salen de la cola', async () => {
    nextBatch.mockResolvedValue([operation(), operation({ clientOperationId: 'op-2' })]);
    post.mockResolvedValue({
      results: [
        { clientOperationId: 'op-1', status: 'APPLIED', form: null, error: null, message: null },
        { clientOperationId: 'op-2', status: 'DUPLICATE', form: null, error: null, message: null },
      ],
    });

    const result = await dispatchQueue(db);

    // `DUPLICATE` no es un error: el acta está en el servidor, que es lo único que importa.
    expect(removeOperations).toHaveBeenCalledWith(db, ['op-1', 'op-2']);
    expect(result.settled).toBe(2);
    expect(result.rejected).toBe(0);
  });

  it('una operación rechazada se archiva con su motivo y las otras se cierran igual', async () => {
    nextBatch.mockResolvedValue([operation(), operation({ clientOperationId: 'op-2' })]);
    post.mockResolvedValue({
      results: [
        { clientOperationId: 'op-1', status: 'APPLIED', form: null, error: null, message: null },
        {
          clientOperationId: 'op-2',
          status: 'FAILED',
          form: null,
          error: 'form_validation_failed',
          message: 'El formulario no cumple el schema de su plantilla.',
        },
      ],
    });

    const result = await dispatchQueue(db);

    expect(removeOperations).toHaveBeenCalledWith(db, ['op-1']);
    expect(markFailed).toHaveBeenCalledWith(
      db,
      ['op-2'],
      'El formulario no cumple el schema de su plantilla.',
    );
    expect(result.rejected).toBe(1);
  });

  it('un corte de red deja el lote intacto, con su clave, para reintentarlo igual', async () => {
    nextBatch.mockResolvedValue([operation()]);
    post.mockRejectedValue(new TypeError('Network request failed'));

    const result = await dispatchQueue(db);

    expect(result.failure).toBe('offline');
    expect(removeOperations).not.toHaveBeenCalled();
    expect(markFailed).not.toHaveBeenCalled();
    // La clave NO se suelta: el reintento tiene que ser el mismo envío para el backend.
    expect(clearBatchKey).not.toHaveBeenCalled();
  });

  it('el reintento de un lote a medio enviar reutiliza su clave', async () => {
    nextBatch.mockResolvedValue([operation({ batchKey: 'clave-original', attempts: 1 })]);
    post.mockResolvedValue({ results: [] });

    await dispatchQueue(db);

    expect(assignBatchKey).toHaveBeenCalledWith(db, ['op-1'], 'clave-original');
    expect(post).toHaveBeenCalledWith('clave-original', expect.any(Array));
  });

  it('un 409 por envío en curso no consume el lote: se reintenta después', async () => {
    nextBatch.mockResolvedValue([operation({ batchKey: 'clave-original' })]);
    post.mockRejectedValue(
      new ApiError('Hay otro envío en curso.', 409, 'idempotency_key_in_progress'),
    );

    const result = await dispatchQueue(db);

    expect(result.failure).toBe('busy');
    expect(clearBatchKey).not.toHaveBeenCalled();
    expect(markFailed).not.toHaveBeenCalled();
  });

  it('un 409 por clave reutilizada suelta la clave para salir con una nueva', async () => {
    nextBatch.mockResolvedValue([operation({ batchKey: 'clave-quemada' })]);
    post.mockRejectedValue(new ApiError('Clave ya usada.', 409, 'idempotency_key_reused'));

    await dispatchQueue(db);

    // Lo que ya se hubiera aplicado va a volver como DUPLICATE, así que soltarla no duplica nada.
    expect(clearBatchKey).toHaveBeenCalledWith(db, ['op-1']);
    expect(markFailed).not.toHaveBeenCalled();
  });

  it('una sesión vencida conserva la cola entera', async () => {
    nextBatch.mockResolvedValue([operation()]);
    post.mockRejectedValue(new ApiError('La sesión venció.', 401, 'session_expired'));

    const result = await dispatchQueue(db);

    expect(result.failure).toBe('unauthorized');
    expect(markFailed).not.toHaveBeenCalled();
  });

  it('un lote inválido para el servidor no se reintenta para siempre', async () => {
    nextBatch.mockResolvedValue([operation()]);
    post.mockRejectedValue(new ApiError('El lote no es válido.', 400, 'invalid_request'));

    const result = await dispatchQueue(db);

    expect(markFailed).toHaveBeenCalledWith(db, ['op-1'], 'El lote no es válido.');
    expect(result.rejected).toBe(1);
  });

  it('un error del servidor se reintenta: no es culpa del dato', async () => {
    nextBatch.mockResolvedValue([operation()]);
    post.mockRejectedValue(new ApiError('Algo falló.', 500, 'server_error'));

    const result = await dispatchQueue(db);

    expect(result.failure).toBe('offline');
    expect(markFailed).not.toHaveBeenCalled();
  });

  it('quedarse sin señal no consume intentos', async () => {
    // Una jornada entera con cobertura intermitente no puede archivar actas que nadie rechazó: el
    // tope existe para los rechazos del servidor, no para el transporte.
    nextBatch.mockResolvedValue([operation({ batchKey: 'clave-original' })]);
    post.mockRejectedValue(new TypeError('Network request failed'));

    for (let intento = 0; intento < MAX_ATTEMPTS + 2; intento += 1) {
      const result = await dispatchQueue(db);
      expect(result.failure).toBe('offline');
    }

    expect(bumpAttempts).not.toHaveBeenCalled();
    expect(markFailed).not.toHaveBeenCalled();
    expect(assignBatchKey).toHaveBeenCalledWith(db, ['op-1'], 'clave-original');
  });

  it('un rechazo del servidor sí consume un intento', async () => {
    nextBatch.mockResolvedValue([operation({ batchKey: 'clave-original' })]);
    post.mockRejectedValue(new ApiError('Algo falló.', 500, 'server_error'));

    await dispatchQueue(db);

    expect(bumpAttempts).toHaveBeenCalledWith(db, ['op-1']);
  });

  it('un lote que agotó los intentos se archiva en vez de volver a salir', async () => {
    nextBatch.mockResolvedValue([operation({ attempts: MAX_ATTEMPTS, batchKey: 'clave-vieja' })]);

    const result = await dispatchQueue(db);

    expect(post).not.toHaveBeenCalled();
    expect(markFailed).toHaveBeenCalledWith(db, ['op-1'], expect.stringContaining('rechazó'));
    expect(result.rejected).toBe(1);
  });
});
