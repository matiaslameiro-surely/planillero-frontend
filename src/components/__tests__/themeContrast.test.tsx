import React from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { act, create } from 'react-test-renderer';

import Home from '@/app/index';
import { VisitCard } from '@/components/VisitCard';
import { contrastRatio } from '@/constants/contrast';
import { LIGHT_THEME, DARK_THEME } from '@/constants/layout';
import type { AgendaVisit } from '@/agenda/agendaRepository';

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

jest.mock('@/api/client', () => ({
  getHealth: jest.fn().mockResolvedValue({ status: 'connected' }),
}));

jest.mock('@/status/useDeviceStatus', () => ({
  useDeviceStatus: () => ({ online: true, batteryLevel: 0.9, gps: 'ready' }),
}));

jest.mock('@/sync/useSyncQueue', () => ({
  useSyncQueue: () => ({ reload: jest.fn().mockResolvedValue(0) }),
}));

describe('Theme and Contrast Accessibility (PLAN-48)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('WCAG 2.1 AA Contrast Ratios', () => {
    it('Dark theme text colors have sufficient contrast against dark surface and backdrop (>= 4.5:1)', () => {
      const primaryRatio = contrastRatio(DARK_THEME.textPrimary, DARK_THEME.bgSurface);
      expect(primaryRatio).toBeGreaterThanOrEqual(7.0); // WCAG AAA

      const secondaryRatio = contrastRatio(DARK_THEME.textSecondary, DARK_THEME.bgSurface);
      expect(secondaryRatio).toBeGreaterThanOrEqual(4.5); // WCAG AA

      const mutedRatio = contrastRatio(DARK_THEME.textMuted, DARK_THEME.bgSurface);
      expect(mutedRatio).toBeGreaterThanOrEqual(4.5); // WCAG AA
    });

    it('Light theme text colors have sufficient contrast against light surface and backdrop (>= 4.5:1)', () => {
      const primaryRatio = contrastRatio(LIGHT_THEME.textPrimary, LIGHT_THEME.bgSurface);
      expect(primaryRatio).toBeGreaterThanOrEqual(7.0);

      const secondaryRatio = contrastRatio(LIGHT_THEME.textSecondary, LIGHT_THEME.bgSurface);
      expect(secondaryRatio).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe('Home Screen (index.tsx) theme adaptability', () => {
    it('renders with dark surface background and high-contrast texts in Dark Mode', async () => {
      (useColorScheme as jest.Mock).mockReturnValue('dark');

      let renderer!: ReturnType<typeof create>;
      await act(async () => {
        renderer = create(<Home />);
      });

      const texts = renderer.root.findAllByType(Text);
      const title = texts.find((t) => t.props.children === 'Planillero');
      expect(title).toBeDefined();
      const titleStyle = StyleSheet.flatten(title!.props.style);
      expect(titleStyle.color).toBe(DARK_THEME.textPrimary);

      const subtitle = texts.find((t) => t.props.children === 'Aplicación móvil');
      expect(subtitle).toBeDefined();
      const subtitleStyle = StyleSheet.flatten(subtitle!.props.style);
      expect(subtitleStyle.color).toBe(DARK_THEME.textSecondary);

      // Tarjetas con fondo y borde de superficie oscura
      const views = renderer.root.findAllByType(View);
      const cards = views.filter((v) => {
        const style = StyleSheet.flatten(v.props.style);
        return style && style.maxWidth === 420 && style.borderRadius === 12;
      });
      expect(cards.length).toBeGreaterThanOrEqual(2);
      for (const card of cards) {
        const cardStyle = StyleSheet.flatten(card.props.style);
        expect(cardStyle.backgroundColor).toBe(DARK_THEME.bgSurface);
        expect(cardStyle.borderColor).toBe(DARK_THEME.borderDefault);
      }
    });

    it('renders with light surface background and dark texts in Light Mode', async () => {
      (useColorScheme as jest.Mock).mockReturnValue('light');

      let renderer!: ReturnType<typeof create>;
      await act(async () => {
        renderer = create(<Home />);
      });

      const texts = renderer.root.findAllByType(Text);
      const title = texts.find((t) => t.props.children === 'Planillero');
      expect(title).toBeDefined();
      const titleStyle = StyleSheet.flatten(title!.props.style);
      expect(titleStyle.color).toBe(LIGHT_THEME.textPrimary);

      const views = renderer.root.findAllByType(View);
      const cards = views.filter((v) => {
        const style = StyleSheet.flatten(v.props.style);
        return style && style.maxWidth === 420 && style.borderRadius === 12;
      });
      expect(cards.length).toBeGreaterThanOrEqual(2);
      for (const card of cards) {
        const cardStyle = StyleSheet.flatten(card.props.style);
        expect(cardStyle.backgroundColor).toBe(LIGHT_THEME.bgSurface);
        expect(cardStyle.borderColor).toBe(LIGHT_THEME.borderDefault);
      }
    });
  });

  describe('VisitCard component theme adaptability', () => {
    const mockVisit: AgendaVisit = {
      visitId: 'v-999',
      routeDate: '2026-11-01',
      position: 1,
      code: 'VIS-999',
      address: 'Avenida Siempre Viva 742',
      latitude: -34.6,
      longitude: -58.4,
      urgency: 'HIGH',
      status: 'ASSIGNED',
      start: null,
    };

    it('renders with dark card surface and accessible text colors in Dark Mode', () => {
      (useColorScheme as jest.Mock).mockReturnValue('dark');

      let renderer!: ReturnType<typeof create>;
      act(() => {
        renderer = create(
          <VisitCard
            visit={mockVisit}
            online={true}
            starting={false}
            onStart={jest.fn()}
          />,
        );
      });

      const root = renderer.root;
      const cardView = root.findByType(View);
      const cardStyle = StyleSheet.flatten(cardView.props.style);
      expect(cardStyle.backgroundColor).toBe(DARK_THEME.bgSurface);
      expect(cardStyle.borderColor).toBe(DARK_THEME.borderDefault);

      const texts = root.findAllByType(Text);
      const codeText = texts.find((t) => t.props.children === 'VIS-999');
      expect(codeText).toBeDefined();
      const codeStyle = StyleSheet.flatten(codeText!.props.style);
      expect(codeStyle.color).toBe(DARK_THEME.textPrimary);

      const addressText = texts.find((t) => t.props.children === 'Avenida Siempre Viva 742');
      expect(addressText).toBeDefined();
      const addressStyle = StyleSheet.flatten(addressText!.props.style);
      expect(addressStyle.color).toBe(DARK_THEME.textSecondary);
    });
  });
});
