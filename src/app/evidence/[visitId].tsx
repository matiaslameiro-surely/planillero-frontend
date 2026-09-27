import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  uploadSvgEvidence,
  prepareSvgEvidence,
  listEvidences,
  createManifest,
  verifyManifest,
  type SvgEvidence,
  type EvidenceResponse,
  type ManifestResponse,
  type VerificationResultResponse,
} from '@/api/evidence';
import { SignaturePad } from '@/components/SignaturePad';
import { insertTrace } from '@/audit/auditRepository';
import { useDatabase } from '@/db/DatabaseProvider';
import { MIN_TOUCH_TARGET } from '@/constants/layout';

interface LocalPhotoDraft extends SvgEvidence {
  id: string;
  name: string;
}

/** Nombre del archivo de la firma en el almacenamiento: el backend toma de ahí la extensión. */
const SIGNATURE_FILE_NAME = 'firma-olografa.svg';

export default function EvidenceScreen() {
  const { visitId } = useLocalSearchParams<{ visitId: string }>();
  const router = useRouter();
  const database = useDatabase();

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [remoteEvidences, setRemoteEvidences] = useState<EvidenceResponse[]>([]);
  const [manifest, setManifest] = useState<ManifestResponse | null>(null);
  const [verification, setVerification] = useState<VerificationResultResponse | null>(null);

  // Estados locales para captura y previsualización (Heurística 3: libertad y control)
  const [draftPhotos, setDraftPhotos] = useState<LocalPhotoDraft[]>([]);
  const [signatureData, setSignatureData] = useState<SvgEvidence | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);

  const loadData = React.useCallback(async () => {
    if (!visitId) return;
    try {
      setLoading(true);
      const evidences = await listEvidences(visitId);
      setRemoteEvidences(evidences);
    } catch {
      // Puede que no haya evidencias aún
    } finally {
      setLoading(false);
    }
  }, [visitId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /** Agrega una fotografía de prueba pericial a la bandeja de borradores */
  const handleAddSamplePhoto = async () => {
    const photoNumber = draftPhotos.length + 1;
    // Se guarda el SVG en sí, no un data URI: es lo que se hashea y lo que se sube (PLAN-78).
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#3b82f6"/><text x="10" y="50" fill="white">Foto ${photoNumber}</text></svg>`;
    const evidence = await prepareSvgEvidence(svg);

    setDraftPhotos((prev) => [
      ...prev,
      {
        ...evidence,
        id: `local-photo-${Date.now()}`,
        name: `evidencia-pericial-${photoNumber}.svg`,
      },
    ]);
  };

  const handleRemoveDraftPhoto = (id: string) => {
    setDraftPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  /** Sube las evidencias pendientes al backend con su hash SHA-256 verificado */
  const handleUploadAll = async () => {
    if (!visitId) return;
    if (draftPhotos.length === 0 && !signatureData) {
      Alert.alert('Aviso', 'No hay nuevas evidencias para sincronizar.');
      return;
    }

    try {
      setUploading(true);

      // 1. Subir fotos en borrador
      for (const photo of draftPhotos) {
        await uploadSvgEvidence(visitId, photo, 'PHOTO', {
          fileName: photo.name,
          capturedAt: new Date().toISOString(),
          metadata: JSON.stringify({ name: photo.name }),
        });
      }

      // 2. Subir firma ológrafa si se capturó
      if (signatureData) {
        await uploadSvgEvidence(visitId, signatureData, 'SIGNATURE', {
          fileName: SIGNATURE_FILE_NAME,
          capturedAt: new Date().toISOString(),
        });
      }

      setDraftPhotos([]);
      setSignatureData(null);
      await loadData();
      if (database.status === 'ready') {
        try {
          await insertTrace(database.db, visitId, 'EVIDENCE_SAVED', {
            photos: draftPhotos.length,
            signature: signatureData != null,
          });
        } catch (error) {
          // La traza es un registro local best-effort: no bloquea el flujo de la visita, pero
          // queda el rastro en consola para detectar en QA si el criterio 8 falla en la práctica.
          console.warn('No se pudo registrar la traza de auditoría de la evidencia.', error);
        }
      } else {
        console.warn(
          `No se registró la traza de auditoría de la evidencia: base local en estado "${database.status}".`,
        );
      }
      Alert.alert('Éxito', 'Evidencias subidas y almacenadas con política WORM.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al subir evidencias';
      Alert.alert('Error de subida', msg);
    } finally {
      setUploading(false);
    }
  };

  /** Sella la visita generando el manifiesto firmado con HMAC-SHA256 */
  const handleSealManifest = async () => {
    if (!visitId) return;
    if (remoteEvidences.length === 0) {
      Alert.alert('Aviso', 'Debe haber evidencias almacenadas en el servidor para sellar la visita.');
      return;
    }

    try {
      setUploading(true);
      const evidenceIds = remoteEvidences.map((e) => e.id);
      const res = await createManifest(visitId, 'Dispositivo Móvil Inspector', evidenceIds);
      setManifest(res);
      Alert.alert('Visita Sellada', `Manifiesto firmado digitalmente con HMAC (Estado: ${res.verificationStatus})`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al sellar manifiesto';
      Alert.alert('Error', msg);
    } finally {
      setUploading(false);
    }
  };

  /** Audita la integridad pericial contra el servidor */
  const handleVerify = async () => {
    if (!visitId) return;
    try {
      setLoading(true);
      const res = await verifyManifest(visitId);
      setVerification(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al verificar';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Volver a la pantalla anterior"
        >
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Custodia de Evidencias</Text>
      </View>

      <Text style={styles.metaText}>Visita ID: {visitId}</Text>

      {/* Galería de Fotografías (Heurística 3: Miniaturas y confirmación) */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>1. Fotos Periciales de Ambiente</Text>
          <TouchableOpacity
            style={styles.smallAddButton}
            onPress={handleAddSamplePhoto}
            accessibilityRole="button"
            accessibilityLabel="Tomar fotografía de prueba pericial"
          >
            <Text style={styles.smallAddText}>+ Tomar foto</Text>
          </TouchableOpacity>
        </View>

        {draftPhotos.length > 0 && (
          <View style={styles.draftContainer}>
            <Text style={styles.draftHeader}>Fotos pendientes de confirmación:</Text>
            <View style={styles.thumbnailsRow}>
              {draftPhotos.map((photo) => (
                <View key={photo.id} style={styles.thumbnailCard}>
                  <View style={styles.thumbnailPlaceholder}>
                    <Text style={styles.thumbnailLabel}>FOTO</Text>
                  </View>
                  <Text style={styles.thumbnailHash} numberOfLines={1}>
                    SHA: {photo.sha256.substring(0, 10)}...
                  </Text>
                  <TouchableOpacity
                    style={styles.deleteThumbnailBtn}
                    onPress={() => handleRemoveDraftPhoto(photo.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Eliminar foto ${photo.name}`}
                  >
                    <Text style={styles.deleteThumbnailText}>Eliminar</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {draftPhotos.length === 0 && (
          <Text style={styles.emptyNote}>No hay fotos en borrador. Presione «+ Tomar foto» para agregar.</Text>
        )}
      </View>

      {/* Firma Ológrafa Táctil (Heurística 8: Minimalismo y maximización de espacio) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Firma Ológrafa de las Partes</Text>

        {!signatureData && !showSignaturePad && (
          <TouchableOpacity
            style={styles.openSignatureBtn}
            onPress={() => setShowSignaturePad(true)}
            accessibilityRole="button"
            accessibilityLabel="Abrir lienzo táctil de firma ológrafa"
          >
            <Text style={styles.openSignatureText}>Abrir lienzo de firma</Text>
          </TouchableOpacity>
        )}

        {showSignaturePad && (
          <SignaturePad
            onSave={({ content, sha256, size }) => {
              setSignatureData({ content, sha256, size });
              setShowSignaturePad(false);
            }}
            onCancel={() => setShowSignaturePad(false)}
          />
        )}

        {signatureData && (
          <View style={styles.signatureCard}>
            <Text style={styles.signatureTitle}>✓ Firma ológrafa capturada</Text>
            <Text style={styles.signatureHash}>SHA-256: {signatureData.sha256}</Text>
            <TouchableOpacity
              style={styles.retrySignatureBtn}
              onPress={() => {
                setSignatureData(null);
                setShowSignaturePad(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Reintentar captura de firma ológrafa"
            >
              <Text style={styles.retrySignatureText}>Reintentar firma</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Botón de Sincronización WORM */}
      {(draftPhotos.length > 0 || signatureData) && (
        <TouchableOpacity
          style={[styles.actionButton, styles.uploadButton, uploading && styles.disabledBtn]}
          onPress={handleUploadAll}
          disabled={uploading}
          accessibilityRole="button"
          accessibilityLabel="Subir y almacenar evidencias digitales"
          accessibilityState={{ disabled: uploading }}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.actionButtonText}>Subir y Almacenar Evidencias (WORM)</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Evidencias ya custodiadas en Servidor */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. Evidencias Custodiadas en Servidor ({remoteEvidences.length})</Text>
        {loading ? (
          <ActivityIndicator color="#2563eb" />
        ) : remoteEvidences.length === 0 ? (
          <Text style={styles.emptyNote}>No hay evidencias subidas aún.</Text>
        ) : (
          remoteEvidences.map((ev) => (
            <View key={ev.id} style={styles.remoteCard}>
              <View style={styles.remoteHeader}>
                <Text style={styles.remoteType}>{ev.evidenceType}</Text>
                <Text style={styles.remoteSize}>{(ev.fileSize / 1024).toFixed(1)} KB</Text>
              </View>
              <Text style={styles.remoteHash}>SHA-256: {ev.sha256Hash}</Text>
              <Text style={styles.remoteDate}>Captura: {new Date(ev.capturedAt).toLocaleString()}</Text>
            </View>
          ))
        )}
      </View>

      {/* Cierre y Manifiesto HMAC */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4. Manifiesto Criptográfico y Cierre</Text>

        <View style={styles.buttonsRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.sealButton]}
            onPress={handleSealManifest}
            disabled={uploading || remoteEvidences.length === 0}
            accessibilityRole="button"
            accessibilityLabel="Sellar manifiesto pericial con HMAC"
            accessibilityState={{ disabled: uploading || remoteEvidences.length === 0 }}
          >
            <Text style={styles.actionButtonText}>Sellar Manifiesto con HMAC</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.verifyButton]}
            onPress={handleVerify}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Auditar integridad criptográfica del manifiesto"
            accessibilityState={{ disabled: loading }}
          >
            <Text style={styles.verifyButtonText}>Auditar Integridad</Text>
          </TouchableOpacity>
        </View>

        {manifest && (
          <View style={styles.manifestResultCard}>
            <Text style={styles.manifestStatus}>Estado: {manifest.verificationStatus}</Text>
            <Text style={styles.manifestHash} numberOfLines={1}>
              Firma HMAC: {manifest.hmacSignature}
            </Text>
            <Text style={styles.manifestDate}>Sellado: {new Date(manifest.createdAt).toLocaleString()}</Text>
          </View>
        )}

        {verification && (
          <View
            style={[
              styles.verificationCard,
              verification.status === 'VERIFIED' ? styles.statusVerified : styles.statusTampered,
            ]}
          >
            <Text style={styles.verificationTitle}>
              {verification.status === 'VERIFIED' ? '✓ INTEGRIDAD VERIFICADA' : '⚠ ALERTA: MANIPULADO (TAMPERED)'}
            </Text>
            <Text style={styles.verificationMsg}>{verification.message}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f8fafc',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  backButton: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingRight: 12,
  },
  backText: {
    color: '#1d4ed8',
    fontSize: 15,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  metaText: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 16,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  smallAddButton: {
    backgroundColor: '#eff6ff',
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#93c5fd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallAddText: {
    color: '#1d4ed8',
    fontSize: 14,
    fontWeight: '700',
  },
  draftContainer: {
    marginTop: 8,
  },
  draftHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 6,
  },
  thumbnailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  thumbnailCard: {
    width: 110,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  thumbnailPlaceholder: {
    height: 60,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  thumbnailHash: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 4,
  },
  deleteThumbnailBtn: {
    minHeight: MIN_TOUCH_TARGET,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteThumbnailText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyNote: {
    fontSize: 13,
    color: '#64748b',
    fontStyle: 'italic',
  },
  openSignatureBtn: {
    backgroundColor: '#f8fafc',
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  openSignatureText: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 15,
  },
  signatureCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 8,
    padding: 12,
  },
  signatureTitle: {
    color: '#15803d',
    fontWeight: '700',
    fontSize: 14,
  },
  signatureHash: {
    color: '#166534',
    fontSize: 11,
    marginTop: 4,
  },
  retrySignatureBtn: {
    minHeight: MIN_TOUCH_TARGET,
    marginTop: 8,
    justifyContent: 'center',
  },
  retrySignatureText: {
    color: '#1d4ed8',
    fontSize: 14,
    fontWeight: '700',
  },
  actionButton: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  uploadButton: {
    backgroundColor: '#059669',
  },
  sealButton: {
    backgroundColor: '#2563eb',
    flex: 1,
  },
  verifyButton: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    flex: 1,
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  verifyButtonText: {
    color: '#1e293b',
    fontWeight: '700',
    fontSize: 14,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  remoteCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 8,
  },
  remoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  remoteType: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  remoteSize: {
    fontSize: 12,
    color: '#64748b',
  },
  remoteHash: {
    fontSize: 11,
    color: '#334155',
    fontFamily: 'monospace',
  },
  remoteDate: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 12,
  },
  manifestResultCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginTop: 8,
  },
  manifestStatus: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 13,
  },
  manifestHash: {
    color: '#1e40af',
    fontSize: 11,
    marginTop: 2,
  },
  manifestDate: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  verificationCard: {
    borderRadius: 8,
    padding: 12,
    borderWidth: 1.5,
    marginTop: 8,
  },
  statusVerified: {
    backgroundColor: '#f0fdf4',
    borderColor: '#22c55e',
  },
  statusTampered: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
  },
  verificationTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  verificationMsg: {
    fontSize: 12,
    color: '#334155',
  },
});
