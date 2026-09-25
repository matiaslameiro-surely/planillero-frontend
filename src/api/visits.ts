import { requestWithAuth } from '@/api/client';

/**
 * Tipos y llamadas de la agenda y del inicio de visita.
 *
 * Reflejan `03-contrato-api.md` de PLAN-9. Los nombres y las formas son los del backend: si algo hace
 * falta y no está acá, se pide al backend en vez de inventarlo del lado del cliente.
 */

export type VisitStatus = 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type VisitUrgency = 'LOW' | 'MEDIUM' | 'HIGH';

/** Visita tal como llega en la agenda del operador. */
export interface Visit {
  id: string;
  code: string;
  address: string;
  latitude: number;
  longitude: number;
  status: VisitStatus;
  urgency: VisitUrgency;
  /** ID de la plantilla de formulario asociada (si hay). */
  formTemplateId?: string;
  /** Versión de la plantilla de formulario. */
  formTemplateVersion?: number;
  /** Timestamp de envío del formulario (si ya se envió). */
  formSubmittedAt?: string;
}

/** Hoja de ruta de un día, ya ordenada por posición. */
export interface RouteSheet {
  operatorId: string;
  operatorUsername: string;
  /** Fecha `YYYY-MM-DD`. */
  date: string;
  items: { position: number; visit: Visit }[];
}

export interface StartVisitRequest {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  /** Hora del reloj del dispositivo al capturar la ubicación, ISO-8601 en UTC. */
  clientTimestamp: string;
}

export interface StartVisitResponse {
  visitId: string;
  status: VisitStatus;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  startedAtDevice: string;
  startedAtServer: string;
  /** Hora del servidor menos hora del dispositivo, en segundos. Positivo si el dispositivo está atrasado. */
  driftSeconds: number;
}

/** Baja la hoja de ruta del operador autenticado para una fecha `YYYY-MM-DD`. */
export function getMyRouteSheet(date: string): Promise<RouteSheet> {
  return requestWithAuth<RouteSheet>(
    `/api/v1/operators/me/route-sheet?date=${encodeURIComponent(date)}`,
  );
}

/**
 * Inicia una visita con la ubicación capturada.
 *
 * Un 409 (`visit_not_startable`) significa que la visita ya estaba iniciada: quien llama lo tiene que
 * tratar como "ya estaba" y refrescar la agenda, no como un fallo.
 */
export function startVisit(visitId: string, body: StartVisitRequest): Promise<StartVisitResponse> {
  return requestWithAuth<StartVisitResponse>(`/api/v1/visits/${encodeURIComponent(visitId)}/start`, {
    method: 'POST',
    body,
  });
}

/** Envía las respuestas de un formulario para una visita. */
export interface FormSubmissionRequest {
  templateKey: string;
  templateVersion: number;
  responses: Record<string, unknown>;
}

export interface FormSubmissionResponse {
  visitId: string;
  templateKey: string;
  templateVersion: number;
  submittedAt: string;
}

/** POST /api/v1/visitas/{id}/formulario - Enviar respuestas de formulario. */
export function submitForm(
  visitId: string,
  payload: FormSubmissionRequest
): Promise<FormSubmissionResponse> {
  return requestWithAuth<FormSubmissionResponse>(`/api/v1/visitas/${encodeURIComponent(visitId)}/formulario`, {
    method: 'POST',
    body: payload,
  });
}

export interface CompleteVisitResponse {
  visitId: string;
  status: VisitStatus;
  code: string;
  completedAt: string;
}

/** Finaliza una visita en curso. */
export function completeVisit(visitId: string): Promise<CompleteVisitResponse> {
  return requestWithAuth<CompleteVisitResponse>(`/api/v1/visits/${encodeURIComponent(visitId)}/complete`, {
    method: 'POST',
  });
}