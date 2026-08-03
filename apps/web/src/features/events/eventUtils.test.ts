import { describe, expect, it } from 'vitest';
import { buildCalendarDays, calendarPeriodLabel, eventDuration, eventPage, filterEvents, formDateForDay, moveEvent, navigateCalendarDate, nearestEventsFirst, overlappingEvents, resizeEvent, slugify } from './eventUtils';
import type { EventRow } from './eventTypes';
import { availableProviderOptions, providerLabel } from './providerDisplay';

const event = (overrides: Partial<EventRow> = {}): EventRow => ({
  id: 'event-1', championship_id: 'champ-1', championship_name: 'Formule 1',
  championship_slug: 'formula-1', circuit_id: null, circuit_name: null,
  circuit_city: null, country_code: null, name: 'Grand Prix de France',
  slug: 'grand-prix-france', category: 'Course', starts_at: '2026-06-11T14:00:00.000Z',
  ends_at: '2026-06-11T16:00:00.000Z', timezone: 'UTC', status: 'scheduled',
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
    expect(filterEvents(rows, { search: 'rallye', championship: 'all', status: 'all', publication: 'private', provider: 'all' }).map((row) => row.id)).toEqual(['event-2']);
  });

  it('filtre les événements par fournisseur administratif', () => {
    const rows = [event(), event({ id: 'event-2', origin: 'provider', provider_key: 'fixture' })];
    expect(filterEvents(rows, { search: '', championship: 'all', status: 'all', publication: 'all', provider: 'motorsports-events' }).map((row) => row.id)).toEqual(['event-1']);
    const external = event({ id: 'event-3', origin: 'provider', provider_key: 'ocblacktop' });
    expect(filterEvents([...rows, external], { search: '', championship: 'all', status: 'all', publication: 'all', provider: 'ocblacktop' }).map((row) => row.id)).toEqual(['event-3']);
  });

  it('ajoute automatiquement un futur fournisseur au filtre', () => {
    const options = availableProviderOptions([{ origin: 'provider', provider_key: 'future-racing-api' }]);
    expect(options).toContainEqual({ value: 'provider:future-racing-api', label: 'Future Racing API' });
    expect(providerLabel('manual', null)).toBe('Motorsports Events');
  });

  it('prépare une création depuis un jour et normalise le slug', () => {
    expect(formDateForDay(new Date(2026, 5, 7))).toBe('2026-06-07T09:00');
    expect(slugify('Grand Prix d’Été')).toBe('grand-prix-d-ete');
  });

  it('conserve la durée pendant un déplacement',()=>{const moved=moveEvent(event(),new Date('2026-06-12T10:00:00Z'));expect(moved.starts_at).toBe('2026-06-12T10:00:00.000Z');expect(eventDuration(moved)).toBe(eventDuration(event()))});
  it('redimensionne uniquement la fin et refuse une durée négative',()=>{const row=event();expect(resizeEvent(row,new Date('2026-06-11T17:00:00Z')).starts_at).toBe(row.starts_at);expect(()=>resizeEvent(row,new Date('2026-06-10T00:00:00Z'))).toThrow()});
  it('détecte les chevauchements publiés sur le même circuit',()=>{const first=event({circuit_id:'track'});const second=event({id:'event-2',circuit_id:'track',starts_at:'2026-06-11T15:00:00Z',ends_at:'2026-06-11T17:00:00Z'});expect(overlappingEvents([first,second])).toHaveLength(2)});

  it('navigue selon la granularité de chaque vue', () => {
    const date = new Date(2026, 5, 10, 12);
    expect(navigateCalendarDate(date, 'month', 1).getMonth()).toBe(6);
    expect(navigateCalendarDate(date, 'week', 1).getDate()).toBe(17);
    expect(navigateCalendarDate(date, 'day', -1).getDate()).toBe(9);
    expect(navigateCalendarDate(date, 'agenda', 1).getDate()).toBe(10);
    expect(navigateCalendarDate(date, 'agenda', 1).getMonth()).toBe(6);
  });

  it('décrit la période réellement affichée', () => {
    const date = new Date(2026, 5, 10, 12);
    expect(calendarPeriodLabel(date, 'month')).toContain('Juin 2026');
    expect(calendarPeriodLabel(date, 'week')).toContain('8 juin');
    expect(calendarPeriodLabel(date, 'day')).toContain('10 juin 2026');
  });

  it('place en premier l’événement le plus proche de la date de référence', () => {
    const reference = new Date('2026-06-10T12:00:00Z');
    const rows = [
      event({ id: 'far', starts_at: '2026-07-01T12:00:00Z' }),
      event({ id: 'nearest', starts_at: '2026-06-10T13:00:00Z' }),
      event({ id: 'past', starts_at: '2026-06-09T12:00:00Z' })
    ];
    expect(nearestEventsFirst(rows, reference).map((row) => row.id)).toEqual(['nearest', 'past', 'far']);
  });

  it('pagine la liste par blocs de 25 événements', () => {
    const rows = Array.from({ length: 52 }, (_, index) => event({ id: `event-${index + 1}` }));
    expect(eventPage(rows, 1)).toHaveLength(25);
    expect(eventPage(rows, 2)[0].id).toBe('event-26');
    expect(eventPage(rows, 3).map((row) => row.id)).toEqual(['event-51', 'event-52']);
  });
});
