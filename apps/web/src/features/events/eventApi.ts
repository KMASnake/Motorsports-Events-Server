import type { Championship, Circuit, EventFormState, EventRow } from './eventTypes';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && init.body !== null) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(body.message ?? 'Une erreur est survenue.');
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

const toIso = (value: string) => value ? new Date(value).toISOString() : null;

export async function loadEventWorkspace() {
  const [events, championships, circuits] = await Promise.all([
    request<EventRow[]>('/api/v1/admin/events'),
    request<Championship[]>('/api/v1/championships'),
    request<Circuit[]>('/api/v1/circuits')
  ]);
  return { events, championships, circuits };
}

export function saveEvent(form: EventFormState, eventId?: string) {
  const payload = {
    ...form,
    circuit_id: form.circuit_id || null,
    category: form.category || null,
    starts_at: toIso(form.starts_at),
    ends_at: toIso(form.ends_at),
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
