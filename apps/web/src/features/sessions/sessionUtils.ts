import type { SessionFormState, SessionRow, SessionStatus } from './sessionTypes';

export const statusLabels: Record<SessionStatus, string> = {
  draft: 'Brouillon', scheduled: 'À venir', completed: 'Terminée',
  cancelled: 'Annulée', postponed: 'Reportée'
};

export function localDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function offsetDateTime(value: string): string {
  return new Date(value).toISOString();
}

export function sessionToForm(session: SessionRow): SessionFormState {
  return {
    title: session.title,
    starts_at: localDateTime(session.starts_at),
    ends_at: localDateTime(session.ends_at),
    status: session.status,
    published: session.published,
    description: session.description ?? ''
  };
}

export function emptySessionForm(eventStart: string): SessionFormState {
  return { title: '', starts_at: localDateTime(eventStart), ends_at: '', status: 'scheduled', published: true, description: '' };
}

export function sessionPayload(form: SessionFormState) {
  return {
    title: form.title.trim(),
    starts_at: offsetDateTime(form.starts_at),
    ends_at: form.ends_at ? offsetDateTime(form.ends_at) : null,
    status: form.status,
    published: form.published,
    description: form.description.trim() || null
  };
}

export function deduplicateTitles(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = value.trim().toLocaleLowerCase('fr');
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized); return true;
  });
}
