import { requestWithAuth } from '../api/client';
import type { FormTemplateListItem, FormTemplateDetail } from './types';

const BASE = '/api/v1';

/** GET /api/v1/plantillas - Lista plantillas activas. */
export async function fetchTemplates(): Promise<FormTemplateListItem[]> {
  const res = await requestWithAuth<FormTemplateListItem[]>(`${BASE}/plantillas`);
  return res ?? [];
}

/** GET /api/v1/plantillas/{clave} - Detalle con schema. */
export async function fetchTemplate(clave: string, version?: number): Promise<FormTemplateDetail> {
  const params = version ? `?version=${version}` : '';
  const res = await requestWithAuth<FormTemplateDetail>(`${BASE}/plantillas/${clave}${params}`);
  if (!res) throw new Error('Plantilla no encontrada');
  return res;
}