import * as tokenStore from '@/auth/tokenStore';
import {
  computeSha256,
  uploadEvidence,
  listEvidences,
  createManifest,
  verifyManifest,
} from '@/api/evidence';

jest.mock('@/auth/tokenStore');

const readTokens = tokenStore.readTokens as jest.Mock;
const fetchOriginal = global.fetch;

function useFetch(implementation: jest.Mock) {
  global.fetch = implementation as unknown as typeof fetch;
}

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

beforeEach(() => {
  readTokens.mockReset();
  readTokens.mockResolvedValue({
    accessToken: 'test-token',
    refreshToken: 'test-refresh',
  });
});

afterEach(() => {
  global.fetch = fetchOriginal;
  jest.clearAllMocks();
});

describe('computeSha256', () => {
  it('calcula SHA-256 correctamente para vectores conocidos', async () => {
    // Cadena vacía
    const emptyHash = await computeSha256('');
    expect(emptyHash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');

    // "abc"
    const abcHash = await computeSha256('abc');
    expect(abcHash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');

    // "The quick brown fox jumps over the lazy dog"
    const foxHash = await computeSha256('The quick brown fox jumps over the lazy dog');
    expect(foxHash).toBe('d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592');
  });
});

describe('API de Evidencias periciales', () => {
  it('uploadEvidence envía FormData con headers y devuelve la evidencia creada', async () => {
    const mockRes = {
      id: 'ev-1',
      visitId: 'v-1',
      evidenceType: 'PHOTO',
      fileName: 'test.jpg',
      contentType: 'image/jpeg',
      fileSize: 1234,
      sha256Hash: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      capturedAt: '2026-09-18T12:00:00Z',
      createdAt: '2026-09-18T12:00:01Z',
    };

    const mockFetch = jest.fn().mockResolvedValue(jsonResponse(201, mockRes));
    useFetch(mockFetch);

    const blob = new Blob(['sample-photo-data'], { type: 'image/jpeg' });
    const res = await uploadEvidence('v-1', blob, 'PHOTO', {
      clientSha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    });

    expect(res.id).toBe('ev-1');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/v1/visits/v-1/evidences');
    expect(init.method).toBe('POST');
    expect(init.headers['X-Content-SHA256']).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('listEvidences devuelve el listado de evidencias', async () => {
    const mockList = [{ id: 'ev-1', visitId: 'v-1' }];
    useFetch(jest.fn().mockResolvedValue(jsonResponse(200, mockList)));

    const res = await listEvidences('v-1');
    expect(res).toEqual(mockList);
  });

  it('createManifest sella la visita y devuelve el manifiesto', async () => {
    const mockManifest = {
      id: 'm-1',
      visitId: 'v-1',
      verificationStatus: 'VERIFIED',
      hmacSignature: 'sig123',
    };
    useFetch(jest.fn().mockResolvedValue(jsonResponse(201, mockManifest)));

    const res = await createManifest('v-1', 'Android Test', ['ev-1']);
    expect(res.verificationStatus).toBe('VERIFIED');
  });

  it('verifyManifest consulta la auditoría pericial', async () => {
    const mockVerify = {
      manifestId: 'm-1',
      visitId: 'v-1',
      status: 'VERIFIED',
      signatureValid: true,
      allEvidencesIntact: true,
      message: 'OK',
      evidences: [],
    };
    useFetch(jest.fn().mockResolvedValue(jsonResponse(200, mockVerify)));

    const res = await verifyManifest('v-1');
    expect(res.status).toBe('VERIFIED');
  });
});
