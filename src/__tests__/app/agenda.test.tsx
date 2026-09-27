import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import AgendaScreen from '@/app/agenda';
import { MIN_TOUCH_TARGET } from '@/constants/layout';
import { confirmSignOut } from '@/sync/signOutGuard';
import { useSession } from '@/auth/SessionContext';
import { useRouter } from 'expo-router';
import { useSyncQueue } from '@/sync/useSyncQueue';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  Redirect: jest.fn(() => null),
}));

jest.mock('@/auth/SessionContext', () => ({
  useSession: jest.fn(),
}));

jest.mock('@/db/DatabaseProvider', () => ({
  useDatabase: () => ({ status: 'ready', db: {} }),
}));

jest.mock('@/status/useDeviceStatus', () => ({
  useDeviceStatus: () => ({ online: true, batteryLevel: 0.9, gps: 'ready' }),
}));

jest.mock('@/agenda/useAgenda', () => ({
  useAgenda: () => ({
    visits: [],
    pending: 0,
    sync: 'idle',
    database: 'ready',
    lastSyncedAt: '2026-09-25T10:00:00.000Z',
    refresh: jest.fn(),
    reload: jest.fn(),
    openFormulario: jest.fn(),
  }),
}));

jest.mock('@/sync/useSyncQueue', () => ({
  useSyncQueue: jest.fn(),
}));

jest.mock('@/sync/signOutGuard', () => ({
  confirmSignOut: jest.fn(),
}));

describe('AgendaScreen Navigation and Logout (PLAN-54)', () => {
  const mockBack = jest.fn();
  const mockReplace = jest.fn();
  const mockCanGoBack = jest.fn();
  const mockSignOut = jest.fn();
  const mockReloadQueue = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      back: mockBack,
      replace: mockReplace,
      canGoBack: mockCanGoBack,
    });
    (useSession as jest.Mock).mockReturnValue({
      status: 'signedIn',
      user: { username: 'inspector01', roles: ['OPERATOR'] },
      signOut: mockSignOut,
    });
    (useSyncQueue as jest.Mock).mockReturnValue({
      pending: 0,
      failed: 0,
      justCleared: false,
      dispatching: false,
      reload: mockReloadQueue.mockResolvedValue(0),
    });
    (confirmSignOut as unknown as jest.Mock).mockResolvedValue(true);
  });

  it('renders return button with accessibility attributes and ergonomic touch target (>= 48 dp)', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<AgendaScreen />);
    });

    const backBtn = renderer.root.findByProps({
      accessibilityLabel: 'Volver a la pantalla principal',
    });
    expect(backBtn).toBeTruthy();
    expect(backBtn.props.accessibilityRole).toBe('button');

    const style = StyleSheet.flatten(
      typeof backBtn.props.style === 'function'
        ? backBtn.props.style({ pressed: false })
        : backBtn.props.style,
    );
    expect(style.minHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    expect(style.minWidth).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });

  it('renders sign out button with accessibility attributes and ergonomic touch target (>= 48 dp)', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<AgendaScreen />);
    });

    const logoutBtn = renderer.root.findByProps({
      accessibilityLabel: 'Cerrar sesión',
    });
    expect(logoutBtn).toBeTruthy();
    expect(logoutBtn.props.accessibilityRole).toBe('button');

    const style = StyleSheet.flatten(
      typeof logoutBtn.props.style === 'function'
        ? logoutBtn.props.style({ pressed: false })
        : logoutBtn.props.style,
    );
    expect(style.minHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    expect(style.minWidth).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });

  it('navigates back using router.back() when canGoBack() is true', () => {
    mockCanGoBack.mockReturnValue(true);

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<AgendaScreen />);
    });

    const backBtn = renderer.root.findByProps({
      accessibilityLabel: 'Volver a la pantalla principal',
    });

    act(() => {
      backBtn.props.onPress();
    });

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('navigates to root "/" using router.replace() when canGoBack() is false', () => {
    mockCanGoBack.mockReturnValue(false);

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<AgendaScreen />);
    });

    const backBtn = renderer.root.findByProps({
      accessibilityLabel: 'Volver a la pantalla principal',
    });

    act(() => {
      backBtn.props.onPress();
    });

    expect(mockReplace).toHaveBeenCalledWith('/');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('invokes confirmSignOut with pending queue count and executes signOut on confirmation', async () => {
    mockReloadQueue.mockResolvedValue(3);
    (confirmSignOut as unknown as jest.Mock).mockResolvedValue(true);

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<AgendaScreen />);
    });

    const logoutBtn = renderer.root.findByProps({
      accessibilityLabel: 'Cerrar sesión',
    });

    await act(async () => {
      logoutBtn.props.onPress();
    });

    expect(mockReloadQueue).toHaveBeenCalledTimes(1);
    expect(confirmSignOut).toHaveBeenCalledWith(3);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('cancels signOut if confirmSignOut resolves to false', async () => {
    mockReloadQueue.mockResolvedValue(2);
    (confirmSignOut as unknown as jest.Mock).mockResolvedValue(false);

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<AgendaScreen />);
    });

    const logoutBtn = renderer.root.findByProps({
      accessibilityLabel: 'Cerrar sesión',
    });

    await act(async () => {
      logoutBtn.props.onPress();
    });

    expect(mockReloadQueue).toHaveBeenCalledTimes(1);
    expect(confirmSignOut).toHaveBeenCalledWith(2);
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
