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
  uploadEvidence,
  listEvidences,
  createManifest,
  verifyManifest,
  computeSha256,
  type EvidenceResponse,
  type ManifestResponse,
  type VerificationResultResponse,
} from '@/api/evidence';
import { SignaturePad } from '@/components/SignaturePad';

interface LocalPhotoDraft {
  id: string;
  name: string;
  dataUri: string;
  sha256: string;
  size: number;
}

export default function EvidenceScreen() {
  const { visitId } = useLocalSearchParams<{ visitId: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [remoteEvidences, setRemoteEvidences] = useState<EvidenceResponse[]>([]);
  const [manifest, setManifest] = useState<ManifestResponse | null>(null);
  const [verification, setVerification] = useState<VerificationResultResponse | null>(null);

  // Estados locales para captura y previsualización (Heurística 3: libertad y control)
  const [draftPhotos, setDraftPhotos] = useState<LocalPhotoDraft[]>([]);
  const [signatureData, setSignatureData] = useState<{ dataUri: string; sha256: string } | null>(null);
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
    const fakeContent = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%233b82f6"/><text x="10" y="50" fill="white">Foto ${photoNumber}</text></svg>`;
    const hash = await computeSha256(fakeContent);

    setDraftPhotos((prev) => [
      ...prev,
      {
        id: `local-photo-${Date.now()}`,
        name: `evidencia-pericial-${photoNumber}.svg`,
        dataUri: fakeContent,
        sha256: hash,
        size: fakeContent.length,
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
        const blob = new Blob([photo.dataUri], { type: 'image/svg+xml' });
        await uploadEvidence(visitId, blob, 'PHOTO', {
          capturedAt: new Date().toISOString(),
          clientSha256: photo.sha256,
          metadata: JSON.stringify({ name: photo.name }),
        });
      }

      // 2. Subir firma ológrafa si se capturó
      if (signatureData) {
        const sigBlob = new Blob([signatureData.dataUri], { type: 'image/svg+xml' });
        await uploadEvidence(visitId, sigBlob, 'SIGNATURE', {
          capturedAt: new Date().toISOString(),
          clientSha256: signatureData.sha256,
        });
      }

      setDraftPhotos([]);
      setSignatureData(null);
      await loadData();
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Custodia de Evidencias</Text>
      </View>

      <Text style={styles.metaText}>Visita ID: {visitId}</Text>

      {/* Galería de Fotografías (Heurística 3: Miniaturas y confirmación) */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>1. Fotos Periciales de Ambiente</Text>
          <TouchableOpacity style={styles.smallAddButton} onPress={handleAddSamplePhoto}>
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
          >
            <Text style={styles.openSignatureText}>Abrir lienzo de firma</Text>
          </TouchableOpacity>
        )}

        {showSignaturePad && (
          <SignaturePad
            onSave={(sig) => {
              setSignatureData(sig);
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
          >
            <Text style={styles.actionButtonText}>Sellar Manifiesto con HMAC</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.verifyButton]}
            onPress={handleVerify}
            disabled={loading}
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
    paddingRight: 12,
  },
  backText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  metaText: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 16,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    color: '#1e293b',
    marginBottom: 8,
  },
  smallAddButton: {
    backgroundColor: '#eff6ff',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  smallAddText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '600',
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
    width: 100,
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
    marginTop: 4,
    alignItems: 'center',
  },
  deleteThumbnailText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyNote: {
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  openSignatureBtn: {
    backgroundColor: '#f8fafc',
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  openSignatureText: {
    color: '#2563eb',
    fontWeight: '600',
    fontSize: 14,
  },
  signatureCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    padding: 12,
  },
  signatureTitle: {
    color: '#166534',
    fontWeight: '700',
    fontSize: 14,
  },
  signatureHash: {
    color: '#15803d',
    fontSize: 11,
    marginTop: 4,
  },
  retrySignatureBtn: {
    marginTop: 8,
  },
  retrySignatureText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '600',
  },
  actionButton: {
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
