import { requestWithAuth } from './client';

export type EvidenceType = 'PHOTO' | 'SIGNATURE';

export interface EvidenceResponse {
  id: string;
  visitId: string;
  evidenceType: EvidenceType;
  fileName: string;
  contentType: string;
  fileSize: number;
  sha256Hash: string;
  capturedAt: string;
  createdAt: string;
  metadata?: string;
}

export interface ManifestResponse {
  id: string;
  visitId: string;
  userId: string;
  deviceInfo?: string;
  manifestData: string;
  hmacSignature: string;
  verificationStatus: 'VERIFIED' | 'TAMPERED';
  createdAt: string;
}

export interface VerificationDetail {
  evidenceId: string;
  sha256Expected: string;
  sha256Actual: string;
  intact: boolean;
  status: string;
}

export interface VerificationResultResponse {
  manifestId: string;
  visitId: string;
  status: 'VERIFIED' | 'TAMPERED';
  signatureValid: boolean;
  allEvidencesIntact: boolean;
  message: string;
  evidences: VerificationDetail[];
}

/**
 * Calcula el digest SHA-256 en hexadecimal de una cadena o buffer de datos.
 * Compatible con Web Crypto API y fallback determinístico puro.
 */
export async function computeSha256(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;

  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  return sha256Fallback(bytes);
}

/** Fallback determinístico RFC 6234 de SHA-256 en puro JS para entornos sin Web Crypto. */
function sha256Fallback(bytes: Uint8Array): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const length = bytes.length;
  const bitLength = length * 8;
  const withOne = length + 1;
  const padLength = (withOne % 64 <= 56) ? 56 - (withOne % 64) : 120 - (withOne % 64);
  const totalLength = withOne + padLength + 8;
  const padded = new Uint8Array(totalLength);

  padded.set(bytes);
  padded[length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setBigUint64(totalLength - 8, BigInt(bitLength));

  const W = new Uint32Array(64);

  for (let i = 0; i < totalLength; i += 64) {
    for (let t = 0; t < 16; t++) {
      W[t] = view.getUint32(i + t * 4);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = (rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3)) >>> 0;
      const s1 = (rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10)) >>> 0;
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

    for (let t = 0; t < 64; t++) {
      const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
      const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (S0 + maj) >>> 0;

      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }

  const toHex = (n: number) => n.toString(16).padStart(8, '0');
  return `${toHex(h0)}${toHex(h1)}${toHex(h2)}${toHex(h3)}${toHex(h4)}${toHex(h5)}${toHex(h6)}${toHex(h7)}`;
}

function rotr(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

/**
 * Sube una evidencia pericial multipart (foto o firma) con verificación previa de SHA-256.
 */
export async function uploadEvidence(
  visitId: string,
  file: Blob | File | { uri: string; name: string; type: string },
  type: EvidenceType = 'PHOTO',
  options: {
    capturedAt?: string;
    clientSha256?: string;
    metadata?: string;
  } = {},
): Promise<EvidenceResponse> {
  const formData = new FormData();
  // En React Native `file` puede ser { uri, name, type }
  formData.append('file', file as unknown as Blob);
  formData.append('type', type);
  if (options.capturedAt) {
    formData.append('capturedAt', options.capturedAt);
  }
  if (options.metadata) {
    formData.append('metadata', options.metadata);
  }

  const headers: Record<string, string> = {};
  if (options.clientSha256) {
    headers['X-Content-SHA256'] = options.clientSha256;
  }

  return requestWithAuth<EvidenceResponse>(`/api/v1/visits/${visitId}/evidences`, {
    method: 'POST',
    body: formData,
    headers,
  });
}

/** Consulta las evidencias asociadas a una visita. */
export async function listEvidences(visitId: string): Promise<EvidenceResponse[]> {
  return requestWithAuth<EvidenceResponse[]>(`/api/v1/visits/${visitId}/evidences`);
}

/** Sella el manifiesto de la visita pericial computando firma HMAC en backend. */
export async function createManifest(
  visitId: string,
  deviceInfo: string,
  evidenceIds: string[],
): Promise<ManifestResponse> {
  return requestWithAuth<ManifestResponse>(`/api/v1/visits/${visitId}/manifest`, {
    method: 'POST',
    body: { deviceInfo, evidenceIds },
  });
}

/** Consulta el último manifiesto sellado. */
export async function getManifest(visitId: string): Promise<ManifestResponse> {
  return requestWithAuth<ManifestResponse>(`/api/v1/visits/${visitId}/manifest`);
}

/** Audita la integridad criptográfica de la visita (firmas y hashes WORM). */
export async function verifyManifest(visitId: string): Promise<VerificationResultResponse> {
  return requestWithAuth<VerificationResultResponse>(`/api/v1/visits/${visitId}/manifest/verify`, {
    method: 'POST',
  });
}
