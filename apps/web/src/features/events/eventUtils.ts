import type { EventFiltersState, EventFormState, EventRow, EventView } from './eventTypes';
import { providerSource } from './providerDisplay';

export const emptyEventForm = (): EventFormState => ({
  championship_id: '', circuit_id: '', name: '',
  starts_at: '', ends_at: '', status: 'scheduled',
  published: true, description: '', session_title: ''
});

export const localDateTimeInput = (iso: string | null) => iso
  ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
  : '';

export function eventToForm(event: EventRow): EventFormState {
  return {
    championship_id: event.championship_id,
    circuit_id: event.circuit_id ?? '',
    name: event.name,
    starts_at: localDateTimeInput(event.starts_at),
    ends_at: localDateTimeInput(event.ends_at),
    status: event.status,
    published: event.published,
    description: event.description ?? '',
    session_title: event.session_title ?? ''
  };
}

export function eventPresentationStatus(event: Pick<EventRow, 'status' | 'starts_at' | 'ends_at'>, reference = new Date()): EventRow['status'] {
  if (event.status !== 'scheduled') return event.status;
  const boundary = new Date(event.ends_at ?? event.starts_at);
  return Number.isFinite(boundary.getTime()) && boundary <= reference ? 'completed' : 'scheduled';
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
      && (filters.publication === 'all' || event.published === (filters.publication === 'published'))
      && (filters.provider === 'all' || providerSource(event.origin,event.provider_key) === filters.provider);
  });
}

export function nearestEventsFirst(events: EventRow[], reference = new Date()): EventRow[] {
  const referenceTime = reference.getTime();
  return [...events].sort((left, right) => {
    const proximity = Math.abs(new Date(left.starts_at).getTime() - referenceTime)
      - Math.abs(new Date(right.starts_at).getTime() - referenceTime);
    if (proximity !== 0) return proximity;
    const chronological = new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime();
    return chronological || left.name.localeCompare(right.name, 'fr');
  });
}

export type EventListSortKey = 'starts_at' | 'name' | 'championship' | 'circuit' | 'status' | 'publication';
export type EventListSortDirection = 'nearest' | 'asc' | 'desc';

export function sortEventList(
  events: EventRow[],
  key: EventListSortKey,
  direction: EventListSortDirection,
  reference = new Date()
): EventRow[] {
  if (key === 'starts_at' && direction === 'nearest') return nearestEventsFirst(events, reference);
  const multiplier = direction === 'desc' ? -1 : 1;
  const text = (event: EventRow): string => {
    if (key === 'name') return event.name;
    if (key === 'championship') return event.championship_name;
    if (key === 'circuit') return event.circuit_name ?? '';
    if (key === 'status') return event.status;
    if (key === 'publication') return event.published ? 'publié' : 'privé';
    return event.starts_at;
  };
  return [...events].sort((left, right) => {
    const comparison = key === 'starts_at'
      ? new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime()
      : text(left).localeCompare(text(right), 'fr', { sensitivity: 'base' });
    return comparison * multiplier || left.name.localeCompare(right.name, 'fr');
  });
}

export function eventPage(events: EventRow[], page: number, pageSize = 25): EventRow[] {
  const safePage = Math.max(1, Math.trunc(page));
  return events.slice((safePage - 1) * pageSize, safePage * pageSize);
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

export function formDatesForRange(first: Date, last: Date) {
  const start = first <= last ? first : last;
  const end = first <= last ? last : first;
  return { starts_at: `${dateKey(start)}T09:00`, ends_at: `${dateKey(end)}T18:00` };
}

export const monthLabel = (date: Date) => new Intl.DateTimeFormat('fr-FR', {
  month: 'long', year: 'numeric'
}).format(date).replace(/^./, (letter) => letter.toUpperCase());

export function navigateCalendarDate(date: Date, view: EventView, direction: -1 | 1) {
  const next = new Date(date);
  if (view === 'week') next.setDate(next.getDate() + direction * 7);
  else if (view === 'day') next.setDate(next.getDate() + direction);
  else if (view === 'agenda') next.setDate(next.getDate() + direction * 30);
  else next.setMonth(next.getMonth() + direction, 1);
  return next;
}

export function calendarPeriodLabel(date: Date, view: EventView) {
  if (view === 'month' || view === 'list') return monthLabel(date);
  if (view === 'day') return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date).replace(/^./, (letter) => letter.toUpperCase());
  const start = new Date(date);
  if (view === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start); end.setDate(start.getDate() + (view === 'week' ? 6 : 29));
  const short = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
  const complete = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${short.format(start)} – ${complete.format(end)}`;
}

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

export async function persistOptimisticEvent(previous: EventRow, optimistic: EventRow, persist: (event: EventRow) => Promise<unknown>) {
  try { await persist(optimistic); return { event: optimistic, rolledBack: false }; }
  catch (error) { return { event: previous, rolledBack: true, error }; }
}

export function overlappingEvents(events: EventRow[]) {
  return events.filter((event, index) => events.some((other, otherIndex) => otherIndex !== index
    && event.published && other.published && event.circuit_id && event.circuit_id === other.circuit_id
    && new Date(event.starts_at) < new Date(other.ends_at ?? other.starts_at)
    && new Date(other.starts_at) < new Date(event.ends_at ?? event.starts_at)));
}
