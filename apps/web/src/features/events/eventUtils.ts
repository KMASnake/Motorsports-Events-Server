import type { EventFiltersState, EventFormState, EventRow } from './eventTypes';

export const emptyEventForm = (): EventFormState => ({
  championship_id: '', circuit_id: '', name: '', slug: '', category: '',
  starts_at: '', ends_at: '', timezone: 'Europe/Paris', status: 'scheduled',
  published: true, origin: 'manual', description: ''
});

export const localDateTimeInput = (iso: string | null) => iso
  ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
  : '';

export function eventToForm(event: EventRow): EventFormState {
  return {
    championship_id: event.championship_id,
    circuit_id: event.circuit_id ?? '',
    name: event.name,
    slug: event.slug,
    category: event.category ?? '',
    starts_at: localDateTimeInput(event.starts_at),
    ends_at: localDateTimeInput(event.ends_at),
    timezone: event.timezone,
    status: event.status,
    published: event.published,
    origin: event.origin,
    description: event.description ?? ''
  };
}

export function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function filterEvents(events: EventRow[], filters: EventFiltersState) {
  const query = filters.search.trim().toLowerCase();
  return events.filter((event) => {
    const haystack = `${event.name} ${event.slug} ${event.championship_name} ${event.circuit_name ?? ''}`.toLowerCase();
    return (!query || haystack.includes(query))
      && (filters.championship === 'all' || event.championship_id === filters.championship)
      && (filters.status === 'all' || event.status === filters.status)
      && (filters.publication === 'all' || event.published === (filters.publication === 'published'));
  });
}

export interface CalendarDay { date: Date; key: string; inMonth: boolean; events: EventRow[] }

export function buildCalendarDays(month: Date, events: EventRow[]): CalendarDay[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = dateKey(date);
    return {
      date,
      key,
      inMonth: date.getMonth() === month.getMonth(),
      events: events.filter((event) => dateKey(new Date(event.starts_at)) === key)
    };
  });
}

export function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formDateForDay(date: Date) {
  return `${dateKey(date)}T09:00`;
}

export const monthLabel = (date: Date) => new Intl.DateTimeFormat('fr-FR', {
  month: 'long', year: 'numeric'
}).format(date).replace(/^./, (letter) => letter.toUpperCase());

export const fullDate = (value: string) => new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long', timeStyle: 'short'
}).format(new Date(value));

export function moveEvent(event: EventRow, nextStart: Date): EventRow {
  const duration = event.ends_at ? new Date(event.ends_at).getTime() - new Date(event.starts_at).getTime() : 0;
  return { ...event, starts_at: nextStart.toISOString(), ends_at: event.ends_at ? new Date(nextStart.getTime() + duration).toISOString() : null };
}

export function resizeEvent(event: EventRow, nextEnd: Date): EventRow {
  if (nextEnd < new Date(event.starts_at)) throw new Error('La fin ne peut pas précéder le début.');
  return { ...event, ends_at: nextEnd.toISOString() };
}

export function eventDuration(event: EventRow) {
  return event.ends_at ? Math.max(0, new Date(event.ends_at).getTime() - new Date(event.starts_at).getTime()) : 0;
}

export function overlappingEvents(events: EventRow[]) {
  return events.filter((event, index) => events.some((other, otherIndex) => otherIndex !== index
    && event.published && other.published && event.circuit_id && event.circuit_id === other.circuit_id
    && new Date(event.starts_at) < new Date(other.ends_at ?? other.starts_at)
    && new Date(other.starts_at) < new Date(event.ends_at ?? event.starts_at)));
}
