import type { Championship, Circuit, EventFormState, EventRow, SessionTitleSuggestion } from './eventTypes';
import {isEventCategory} from './eventCategories';
import { adminAuthorization, notifyAuthenticationRequired } from '../../lib/adminAuth';

const API = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3001' : '');

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(adminAuthorization())) headers.set(name, value);
  if (init.body !== undefined && init.body !== null) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API}${path}`, { ...init, credentials: 'include', headers });
  if (response.status === 401) notifyAuthenticationRequired();
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(body.message ?? 'Une erreur est survenue.');
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

const toIso = (value: string) => value ? new Date(value).toISOString() : null;

export async function loadEventWorkspace() {
  const [events, championships, circuits, sessionTitles] = await Promise.all([
    request<EventRow[]>('/api/v1/admin/events'),
    request<Championship[]>('/api/v1/admin/championships'),
    request<Circuit[]>('/api/v1/circuits'),
    request<SessionTitleSuggestion[]>('/api/v1/admin/session-titles')
  ]);
  return { events, championships, circuits, sessionTitles };
}

export function saveEvent(form: EventFormState, eventId?: string) {
  const payload = {
    championship_id: form.championship_id,
    circuit_id: form.circuit_id || null,
    name: form.name,
    ...(isEventCategory(form.category)?{category:form.category}:{}),
    starts_at: toIso(form.starts_at),
    ends_at: toIso(form.ends_at),
    status: form.status,
    published: form.published,
    session_title: form.session_title.trim() || null,
    description: form.description || null
  };
  return request<EventRow>(eventId ? `/api/v1/admin/events/${eventId}` : '/api/v1/admin/events', {
    method: eventId ? 'PATCH' : 'POST',
    body: JSON.stringify(payload)
  });
}

export function setEventPublication(event: EventRow, published: boolean) {
  return request<EventRow>(`/api/v1/admin/events/${event.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ published })
  });
}

export function patchEvent(eventId: string, values: Partial<EventFormState>) {
  return request<EventRow>(`/api/v1/admin/events/${eventId}`, {
    method: 'PATCH', body: JSON.stringify(values)
  });
}

export function deleteEvent(eventId: string) {
  return request<void>(`/api/v1/admin/events/${eventId}`, { method: 'DELETE' });
}
