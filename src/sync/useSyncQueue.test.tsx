import { act, create } from 'react-test-renderer';

import { useDatabase } from '@/db/DatabaseProvider';
import { countFailedOperations, countPendingOperations } from '@/sync/syncQueue';
import { dispatchQueue } from '@/sync/syncWorker';
import { useSyncQueue, type SyncQueue } from '@/sync/useSyncQueue';

/**
 * Tests del hook de la cola.
 *
 * Se reemplazan la base, los contadores y el despacho. Lo que se verifica es lo que el operador
 * percibe: que la cola se vacía sola al volver la red, que no se queda a medias cuando hay más
 * operaciones que un lote, y que la confirmación de «todo sincronizado» no se queda pegada.
 */

jest.mock('@/db/DatabaseProvider', () => ({ useDatabase: jest.fn() }));
jest.mock('@/sync/syncQueue');
jest.mock('@/sync/syncWorker');

const database = useDatabase as jest.Mock;
const pending = countPendingOperations as jest.Mock;
const failed = countFailedOperations as jest.Mock;
const dispatch = dispatchQueue as jest.Mock;

const db = {};

/** Monta el hook y devuelve cómo leer el último valor y cómo cambiar la conexión. */
async function mount(online: boolean) {
  let latest!: SyncQueue;
  function Probe({ isOnline }: { isOnline: boolean }) {
    latest = useSyncQueue(isOnline);
    return null;
  }
  let renderer!: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(<Probe isOnline={online} />);
  });
  return {
    current: () => latest,
    setOnline: (value: boolean) =>
      act(async () => {
        renderer.update(<Probe isOnline={value} />);
      }),
  };
}

beforeEach(() => {
  database.mockReturnValue({ status: 'ready', db });
  pending.mockResolvedValue(0);
  failed.mockResolvedValue(0);
  dispatch.mockResolvedValue({ sent: 0, settled: 0, rejected: 0, pending: 0, failure: null });
});

afterEach(() => {
  jest.useRealTimers();
  jest.resetAllMocks();
});

describe('useSyncQueue', () => {
  it('sin conexión no intenta despachar', async () => {
    await mount(false);

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('despacha al volver la conexión, sin que el operador toque nada', async () => {
    const { setOnline } = await mount(false);

    await setOnline(true);

    expect(dispatch).toHaveBeenCalledWith(db);
  });

  it('encadena lotes mientras queden pendientes: no se detiene en el primero', async () => {
    // Con más operaciones que las que entran en un lote, quedarse en el primer envío dejaría el
    // resto esperando a que la red se cortara y volviera otra vez, con el dispositivo conectado.
    dispatch
      .mockResolvedValueOnce({ sent: 50, settled: 50, rejected: 0, pending: 10, failure: null })
      .mockResolvedValueOnce({ sent: 10, settled: 10, rejected: 0, pending: 0, failure: null });

    await mount(true);

    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it('deja de encadenar cuando el envío falla, en vez de insistir en el vacío', async () => {
    dispatch.mockResolvedValue({ sent: 5, settled: 0, rejected: 0, pending: 5, failure: 'offline' });

    await mount(true);

    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('la confirmación de cola vacía se muestra y después se va sola', async () => {
    jest.useFakeTimers();
    pending.mockResolvedValueOnce(2).mockResolvedValue(0);

    const { current, setOnline } = await mount(false);
    expect(current().pending).toBe(2);

    await setOnline(true);
    expect(current().justCleared).toBe(true);

    // Un cartel de confirmación que no se va deja de ser una confirmación y pasa a ser ruido fijo.
    await act(async () => {
      jest.advanceTimersByTime(6000);
    });
    expect(current().justCleared).toBe(false);
  });

  it('cuenta las pendientes y las rechazadas por separado', async () => {
    pending.mockResolvedValue(3);
    failed.mockResolvedValue(1);

    const { current } = await mount(false);

    expect(current().pending).toBe(3);
    expect(current().failed).toBe(1);
  });

  it('reload devuelve el conteo del momento, no el del último render', async () => {
    // Es lo que permite decidir si preguntar antes de cerrar sesión sin esperar a que React repinte.
    pending.mockResolvedValue(0);
    const { current } = await mount(false);

    pending.mockResolvedValue(4);
    let contado = 0;
    await act(async () => {
      contado = await current().reload();
    });

    expect(contado).toBe(4);
  });
});
