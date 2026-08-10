import { adminAuthorization } from '../../lib/adminAuth';
import type { Paginated, SessionCorrection, SessionFormState, SessionRow, SessionTitleSuggestion } from './sessionTypes';
import { sessionPayload } from './sessionUtils';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export class SessionApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(adminAuthorization())) headers.set(name, value);
  if (init.body != null) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    throw new SessionApiError(response.status, body.message ?? 'Une erreur est survenue.');
  }
  return response.status === 204 ? undefined as T : response.json();
}

export async function loadSessions(eventId: string): Promise<SessionRow[]> {
  const result = await request<Paginated<SessionRow>>(`/api/v1/admin/events/${eventId}/sessions?page_size=100&sort=starts_at&direction=asc`);
  return result.items;
}
export function loadSessionTitles() { return request<SessionTitleSuggestion[]>('/api/v1/admin/session-titles'); }
export function createSession(eventId: string, form: SessionFormState) {
  return request<SessionRow>(`/api/v1/admin/events/${eventId}/sessions`, { method: 'POST', body: JSON.stringify(sessionPayload(form)) });
}
export function updateSession(id: string, form: SessionFormState) {
  return request<SessionRow>(`/api/v1/admin/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(sessionPayload(form)) });
}
export function deleteSession(id: string) { return request<void>(`/api/v1/admin/sessions/${id}`, { method: 'DELETE' }); }
export async function loadSessionCorrections(sessionId: string): Promise<SessionCorrection[]> {
  return (await request<Paginated<SessionCorrection>>(`/api/v1/admin/session-corrections?session_id=${encodeURIComponent(sessionId)}&page_size=100`)).items;
}
export function keepSessionCorrection(id: string) { return request<SessionCorrection>(`/api/v1/admin/session-corrections/${id}/keep-override`, { method: 'POST' }); }
export function acceptSessionProvider(id: string) { return request<void>(`/api/v1/admin/session-corrections/${id}/accept-provider`, { method: 'POST' }); }
export function restoreSessionProvider(id: string) { return request<void>(`/api/v1/admin/session-corrections/${id}`, { method: 'DELETE' }); }
