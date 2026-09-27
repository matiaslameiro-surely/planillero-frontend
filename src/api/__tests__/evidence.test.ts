import { createHash } from 'node:crypto';
import { convertFormDataAsync } from 'expo/src/winter/fetch/convertFormData';

import * as tokenStore from '@/auth/tokenStore';
import {
  computeSha256,
  prepareSvgEvidence,
  uploadSvgEvidence,
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

/** SHA-256 calculado por fuera del código bajo prueba, como lo hace el servidor sobre los bytes. */
function serverSha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Bytes exactos de la parte `file` del multipart que se mandó al backend. */
async function uploadedFile(mockFetch: jest.Mock): Promise<{ file: File; bytes: Uint8Array; declared: string }> {
  const [, init] = mockFetch.mock.calls[0];
  const file = (init.body as FormData).get('file') as File;
  return {
    file,
    bytes: new Uint8Array(await file.arrayBuffer()),
    declared: init.headers['X-Content-SHA256'],
  };
}

describe('evidencias SVG: el hash declarado es el de los bytes subidos (PLAN-78)', () => {
  const photoSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#3b82f6"/><text x="10" y="50" fill="white">Foto 1</text></svg>';
  /** Misma forma que el SVG que arma `SignaturePad`. */
  const signatureSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" width="400" height="200" style="background:#ffffff"><path d="M 10.0 20.0 L 30.0 40.0" stroke="#000000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" /></svg>';

  it('prepareSvgEvidence hashea los bytes UTF-8 del markup, también con caracteres no ASCII', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>Inspección nº 1 · ✓</text></svg>';
    const evidence = await prepareSvgEvidence(svg);
    const bytes = Buffer.from(svg, 'utf8');

    expect(evidence.content).toBe(svg);
    expect(evidence.sha256).toBe(serverSha256(bytes));
    expect(evidence.size).toBe(bytes.length);
  });

  const cases = [
    ['foto', 'PHOTO', 'evidencia-pericial-1.svg', photoSvg],
    ['firma', 'SIGNATURE', 'firma-olografa.svg', signatureSvg],
  ] as const;

  it.each(cases)('una %s sube un SVG cuyo SHA-256 es el declarado', async (_name, type, fileName, svg) => {
    const mockFetch = jest.fn().mockResolvedValue(jsonResponse(201, { id: 'ev-1' }));
    useFetch(mockFetch);
    const evidence = await prepareSvgEvidence(svg);

    await uploadSvgEvidence('v-1', evidence, type, { fileName });

    const { file, bytes, declared } = await uploadedFile(mockFetch);
    expect(declared).toBe(serverSha256(bytes));
    expect(declared).toBe(evidence.sha256);
    expect(new TextDecoder().decode(bytes).startsWith('<svg')).toBe(true);
    expect(file.type).toBe('image/svg+xml');
    expect(file.name).toBe(fileName);
  });

  /**
   * En el dispositivo, el multipart lo arma `expo/fetch` con `convertFormDataAsync`: se usa esa misma
   * función y se hashea la parte `file` tal como queda en el cuerpo HTTP que recibe el servidor.
   */
  it.each(cases)(
    'en el cuerpo multipart que arma expo/fetch, la parte file de una %s tiene el hash declarado',
    async (_name, type, fileName, svg) => {
      const mockFetch = jest.fn().mockResolvedValue(jsonResponse(201, { id: 'ev-1' }));
      useFetch(mockFetch);
      const evidence = await prepareSvgEvidence(svg);

      await uploadSvgEvidence('v-1', evidence, type, { fileName });

      const [, init] = mockFetch.mock.calls[0];
      const { body, boundary } = await convertFormDataAsync(init.body as FormData);
      const filePart = multipartPart(body, boundary, 'file');
      expect(init.headers['X-Content-SHA256']).toBe(serverSha256(filePart));
    },
  );
});

/** Extrae los bytes del contenido de una parte de un cuerpo multipart/form-data. */
function multipartPart(body: Uint8Array, boundary: string, name: string): Uint8Array {
  const text = Buffer.from(body).toString('latin1');
  const start = text.indexOf(`name="${name}"`);
  const contentStart = text.indexOf('\r\n\r\n', start) + 4;
  const contentEnd = text.indexOf(`\r\n--${boundary}`, contentStart);
  expect(start).toBeGreaterThanOrEqual(0);
  return body.slice(contentStart, contentEnd);
}
