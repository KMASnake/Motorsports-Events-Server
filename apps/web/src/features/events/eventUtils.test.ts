import { describe, expect, it } from 'vitest';
import { buildCalendarDays, filterEvents, formDateForDay, slugify } from './eventUtils';
import type { EventRow } from './eventTypes';

const event = (overrides: Partial<EventRow> = {}): EventRow => ({
  id: 'event-1', championship_id: 'champ-1', championship_name: 'Formule 1',
  championship_slug: 'formula-1', circuit_id: null, circuit_name: null,
  circuit_city: null, country_code: null, name: 'Grand Prix de France',
  slug: 'grand-prix-france', category: 'Course', starts_at: '2026-06-11T14:00:00.000Z',
  ends_at: '2026-06-11T16:00:00.000Z', timezone: 'Europe/Paris', status: 'scheduled',
  published: true, origin: 'manual', description: null, ...overrides
});

describe('eventUtils', () => {
  it('construit une grille mensuelle de six semaines commençant un lundi', () => {
    const days = buildCalendarDays(new Date(2026, 5, 1), [event()]);
    expect(days).toHaveLength(42);
    expect(days[0].date.getDay()).toBe(1);
    expect(days.find((day) => day.key === '2026-06-11')?.events).toHaveLength(1);
  });

  it('partage les filtres entre calendrier et liste', () => {
    const rows = [event(), event({ id: 'event-2', championship_id: 'champ-2', name: 'Rallye du Portugal', published: false })];
    expect(filterEvents(rows, { search: 'rallye', championship: 'all', status: 'all', publication: 'private' }).map((row) => row.id)).toEqual(['event-2']);
  });

  it('prépare une création depuis un jour et normalise le slug', () => {
    expect(formDateForDay(new Date(2026, 5, 7))).toBe('2026-06-07T09:00');
    expect(slugify('Grand Prix d’Été')).toBe('grand-prix-d-ete');
  });
});
