import React from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { act, create } from 'react-test-renderer';
import { SafeAreaView } from 'react-native-safe-area-context';

import AgendaScreen from '@/app/agenda';
import { DeviceStatusBar } from '@/components/DeviceStatusBar';
import { LIGHT_THEME, DARK_THEME } from '@/constants/layout';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  default: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  Redirect: () => null,
}));

jest.mock('@/auth/SessionContext', () => ({
  useSession: () => ({
    status: 'signedIn',
    user: { username: 'inspector01', roles: ['OPERATOR'] },
    signOut: jest.fn(),
  }),
}));

jest.mock('@/db/DatabaseProvider', () => ({
  useDatabase: () => ({
    status: 'ready',
    db: {},
  }),
}));

jest.mock('@/status/useDeviceStatus', () => ({
  useDeviceStatus: () => ({
    online: true,
    batteryLevel: 0.85,
    gps: 'ready',
  }),
}));

jest.mock('@/sync/useSyncQueue', () => ({
  useSyncQueue: () => ({
    pending: 0,
    failed: 0,
    justCleared: false,
    dispatching: false,
    reload: jest.fn().mockResolvedValue(0),
  }),
}));

jest.mock('@/agenda/useAgenda', () => ({
  useAgenda: () => ({
    pending: 2,
    visits: [],
    sync: 'synced',
    lastSyncedAt: '2026-09-25T12:00:00.000Z',
    database: 'ready',
    refresh: jest.fn(),
    reload: jest.fn(),
    openFormulario: jest.fn(),
  }),
}));

describe('AgendaScreen SafeArea and Theme Layout (PLAN-53)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders root container as SafeAreaView with top edge only', async () => {
    (useColorScheme as jest.Mock).mockReturnValue('light');

    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<AgendaScreen />);
    });

    const safeAreaViews = renderer.root.findAllByType(SafeAreaView);
    expect(safeAreaViews.length).toBeGreaterThanOrEqual(1);

    const rootSafeArea = safeAreaViews[0];
    expect(rootSafeArea.props.edges).toEqual(['top']);

    // DeviceStatusBar must be contained inside the SafeAreaView
    const deviceStatusBar = rootSafeArea.findByType(DeviceStatusBar);
    expect(deviceStatusBar).toBeDefined();
    expect(deviceStatusBar.props.pendingVisits).toBe(2);
  });

  it('applies light backdrop background to SafeAreaView in Light Mode', async () => {
    (useColorScheme as jest.Mock).mockReturnValue('light');

    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<AgendaScreen />);
    });

    const rootSafeArea = renderer.root.findByType(SafeAreaView);
    const flattenedStyle = StyleSheet.flatten(rootSafeArea.props.style);
    expect(flattenedStyle.backgroundColor).toBe(LIGHT_THEME.bgBackdrop);
    expect(flattenedStyle.flex).toBe(1);
  });

  it('applies dark backdrop background to SafeAreaView in Dark Mode', async () => {
    (useColorScheme as jest.Mock).mockReturnValue('dark');

    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<AgendaScreen />);
    });

    const rootSafeArea = renderer.root.findByType(SafeAreaView);
    const flattenedStyle = StyleSheet.flatten(rootSafeArea.props.style);
    expect(flattenedStyle.backgroundColor).toBe(DARK_THEME.bgBackdrop);
    expect(flattenedStyle.flex).toBe(1);
  });
});
