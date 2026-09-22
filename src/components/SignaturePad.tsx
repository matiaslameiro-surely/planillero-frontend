import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';
import { computeSha256 } from '@/api/evidence';
import { MIN_TOUCH_TARGET } from '@/constants/layout';

interface Point {
  x: number;
  y: number;
}

interface SignaturePadProps {
  onSave: (signatureData: {
    dataUri: string;
    sha256: string;
    pointsCount: number;
  }) => void;
  onCancel?: () => void;
}

/**
 * Componente de lienzo táctil para firma ológrafa pericial.
 *
 * Cumple con:
 * - Heurística 3: Control y libertad (limpiar y reintentar firma).
 * - Heurística 8: Diseño limpio y minimalista que maximiza el área útil de trazo.
 */
export function SignaturePad({ onSave, onCancel }: SignaturePadProps) {
  const [paths, setPaths] = useState<Point[][]>([]);
  const currentPathRef = useRef<Point[]>([]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentPathRef.current = [{ x: locationX, y: locationY }];
        setPaths((prev) => [...prev, [{ x: locationX, y: locationY }]]);
      },
      onPanResponderMove: (evt: GestureResponderEvent, _gestureState: PanResponderGestureState) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentPathRef.current.push({ x: locationX, y: locationY });
        setPaths((prev) => {
          if (prev.length === 0) return [[{ x: locationX, y: locationY }]];
          const next = [...prev];
          next[next.length - 1] = [...currentPathRef.current];
          return next;
        });
      },
      onPanResponderRelease: () => {
        currentPathRef.current = [];
      },
    }),
  ).current;

  const handleClear = () => {
    currentPathRef.current = [];
    setPaths([]);
  };

  const handleConfirm = async () => {
    if (paths.length === 0) {
      return;
    }

    // Generar representación SVG serializada del trazo ológrafo
    const totalPoints = paths.reduce((acc, p) => acc + p.length, 0);
    const svgPathStrings = paths
      .map((p) => {
        if (p.length === 0) return '';
        const d = p.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ');
        return `<path d="${d}" stroke="#000000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />`;
      })
      .join('');

    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" width="400" height="200" style="background:#ffffff">${svgPathStrings}</svg>`;
    const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`;
    const sha256 = await computeSha256(svgContent);

    onSave({
      dataUri,
      sha256,
      pointsCount: totalPoints,
    });
  };

  const hasStrokes = paths.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Firma Ológrafa Pericial</Text>
        <Text style={styles.subtitle}>Firme en el recuadro blanco utilizando su dedo o stylus</Text>
      </View>

      <View style={styles.canvasContainer} {...panResponder.panHandlers}>
        {/* Guía visual para la firma */}
        <View style={styles.baselineGuide} />
        <Text style={styles.guideText}>X __________________________________________</Text>

        {paths.map((path, pIdx) => (
          <View key={`path-${pIdx}`} pointerEvents="none" style={StyleSheet.absoluteFill}>
            {path.map((point, ptIdx) => {
              if (ptIdx === 0) return null;
              const prevPoint = path[ptIdx - 1];
              const dx = point.x - prevPoint.x;
              const dy = point.y - prevPoint.y;
              const length = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);

              return (
                <View
                  key={`seg-${pIdx}-${ptIdx}`}
                  style={[
                    styles.strokeSegment,
                    {
                      left: prevPoint.x,
                      top: prevPoint.y,
                      width: Math.max(length, 1),
                      transform: [{ rotate: `${angle}deg` }],
                    },
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.clearButton]}
          onPress={handleClear}
          disabled={!hasStrokes}
          accessibilityRole="button"
          accessibilityLabel="Limpiar trazo de firma"
          accessibilityState={{ disabled: !hasStrokes }}
        >
          <Text style={[styles.buttonText, !hasStrokes && styles.disabledText]}>
            Limpiar trazo
          </Text>
        </TouchableOpacity>

        {onCancel && (
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancelar captura de firma"
          >
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.button, styles.confirmButton, !hasStrokes && styles.disabledButton]}
          onPress={handleConfirm}
          disabled={!hasStrokes}
          accessibilityRole="button"
          accessibilityLabel="Confirmar y guardar firma"
          accessibilityState={{ disabled: !hasStrokes }}
        >
          <Text style={styles.confirmText}>Confirmar firma</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
  },
  canvasContainer: {
    height: 220,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    borderStyle: 'dashed',
    position: 'relative',
    overflow: 'hidden',
  },
  baselineGuide: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: '#cbd5e1',
  },
  guideText: {
    position: 'absolute',
    bottom: 42,
    left: 24,
    color: '#64748b',
    fontSize: 12,
  },
  strokeSegment: {
    position: 'absolute',
    height: 2.5,
    backgroundColor: '#0f172a',
    borderRadius: 1.25,
    transformOrigin: '0% 50%',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  button: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButton: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#94a3b8',
  },
  cancelButton: {
    backgroundColor: 'transparent',
  },
  confirmButton: {
    backgroundColor: '#1d4ed8',
    flex: 1,
  },
  disabledButton: {
    backgroundColor: '#94a3b8',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  disabledText: {
    color: '#94a3b8',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
});
