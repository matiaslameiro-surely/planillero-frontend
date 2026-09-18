import { act, create } from 'react-test-renderer';

import { getMyRouteSheet, type RouteSheet } from '@/api/visits';
import { countPending, lastSync, listDay, replaceDay, type AgendaVisit } from '@/agenda/agendaRepository';
import { useAgenda, type Agenda } from '@/agenda/useAgenda';
import { useDatabase } from '@/db/DatabaseProvider';

/**
 * Tests del hook de la agenda: el modo offline y el manejo de fallos de sincronización.
 *
 * Se reemplazan la base, el backend y el repositorio. Lo que se verifica es la regla central de la
 * tarea: la pantalla lee siempre de SQLite, sólo sincroniza con conexión y un fallo de red nunca
 * vacía la agenda.
 */

jest.mock('@/db/DatabaseProvider', () => ({ useDatabase: jest.fn() }));
jest.mock('@/api/visits');
jest.mock('@/agenda/agendaRepository');

const database = useDatabase as jest.Mock;
const fetchSheet = getMyRouteSheet as jest.Mock;
const replace = replaceDay as jest.Mock;
const list = listDay as jest.Mock;
const pending = countPending as jest.Mock;
const synced = lastSync as jest.Mock;

const DATE = '2026-11-01';
const db = {};

const stored: AgendaVisit = {
  visitId: 'v-1',
  routeDate: DATE,
  position: 1,
  code: 'V-1001',
  address: 'Calle Ficticia 1',
  latitude: -34.5,
  longitude: -58.4,
  status: 'ASSIGNED',
  urgency: 'HIGH',
  start: null,
};

const sheet: RouteSheet = { operatorId: 'op', operatorUsername: 'operador.demo', date: DATE, items: [] };

/** Monta el hook y devuelve cómo leer el último valor y cómo cambiar la conexión. */
async function mount(online: boolean) {
  let latest!: Agenda;
  function Probe({ isOnline }: { isOnline: boolean }) {
    latest = useAgenda(DATE, isOnline);
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
  fetchSheet.mockResolvedValue(sheet);
  replace.mockResolvedValue(undefined);
  list.mockResolvedValue([stored]);
  pending.mockResolvedValue(1);
  synced.mockResolvedValue('2026-11-01T14:00:00Z');
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('useAgenda', () => {
  it('con conexión baja el día, lo vuelca a SQLite y muestra lo que hay en SQLite', async () => {
    const { current } = await mount(true);

    expect(fetchSheet).toHaveBeenCalledWith(DATE);
    expect(replace).toHaveBeenCalledWith(db, sheet, expect.any(String));
    expect(current().visits).toEqual([stored]);
    expect(current().pending).toBe(1);
    expect(current().sync).toBe('idle');
  });

  it('sin conexión no toca la red y muestra la copia guardada', async () => {
    const { current } = await mount(false);

    expect(fetchSheet).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(current().visits).toEqual([stored]);
    expect(current().lastSyncedAt).toBe('2026-11-01T14:00:00Z');
  });

  it('si el pedido falla conserva la copia anterior y avisa', async () => {
    fetchSheet.mockRejectedValue(new TypeError('Network request failed'));

    const { current } = await mount(true);

    expect(replace).not.toHaveBeenCalled();
    expect(current().sync).toBe('failed');
    expect(current().visits).toEqual([stored]);
  });

  it('si falla al volcar a SQLite tampoco vacía lo que ya se veía', async () => {
    replace.mockRejectedValue(new Error('disco lleno'));

    const { current } = await mount(true);

    expect(current().sync).toBe('failed');
    expect(current().visits).toEqual([stored]);
  });

  it('cuando vuelve la conexión sincroniza otra vez', async () => {
    const { setOnline } = await mount(false);
    expect(fetchSheet).not.toHaveBeenCalled();

    await setOnline(true);

    expect(fetchSheet).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('mientras la base no está lista no lee ni sincroniza', async () => {
    database.mockReturnValue({ status: 'opening' });

    const { current } = await mount(true);

    expect(fetchSheet).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
    expect(current().database).toBe('opening');
    expect(current().visits).toEqual([]);
  });

  it('expone el error si la base no pudo abrirse', async () => {
    database.mockReturnValue({ status: 'error', message: 'clave dañada' });

    const { current } = await mount(true);

    expect(current().database).toBe('error');
    expect(current().databaseError).toBe('clave dañada');
  });
});
