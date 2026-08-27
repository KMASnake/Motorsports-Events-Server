import { describe, expect, it } from 'vitest';
import { buildCalendarDays, calendarPeriodLabel, eventDuration, eventPage, eventPresentationStatus, eventToForm, filterEvents, formDateForDay, formDatesForRange, moveEvent, navigateCalendarDate, nearestEventsFirst, overlappingEvents, persistOptimisticEvent, resizeEvent, slugify, sortEventList } from './eventUtils';
import type { EventRow } from './eventTypes';
import { availableProviderOptions, providerLabel } from './providerDisplay';

const event = (overrides: Partial<EventRow> = {}): EventRow => ({
  id: 'event-1', championship_id: 'champ-1', championship_name: 'Formule 1',
  championship_slug: 'formula-1', circuit_id: null, circuit_name: null,
  circuit_city: null, country_code: null, meeting_id:null, meeting_name:null, name: 'Grand Prix de France',
  slug: 'grand-prix-france', category: 'Course', starts_at: '2026-06-11T14:00:00.000Z',
  ends_at: '2026-06-11T16:00:00.000Z', timezone: 'UTC', status: 'scheduled',
  published: true, origin: 'manual', description: null, ...overrides
});

describe('eventUtils', () => {
  it('préremplit tous les champs métier de l’éditeur depuis l’Event API', () => {
    const row=event({championship_id:'f1',circuit_id:'silverstone',name:'British Grand Prix',ends_at:'2026-07-05T16:00:00.000Z',status:'postponed',published:false,description:'Pluie',session_title:'Race'});
    const form=eventToForm(row);
    expect(form).toMatchObject({championship_id:'f1',circuit_id:'silverstone',name:'British Grand Prix',status:'postponed',published:false,description:'Pluie',session_title:'Race'});
    expect(new Date(form.starts_at).toISOString()).toBe(row.starts_at);
    expect(new Date(form.ends_at).toISOString()).toBe(row.ends_at);
  });

  it('laisse la fin vide lorsque ends_at est null',()=>expect(eventToForm(event({ends_at:null})).ends_at).toBe(''));

  it('construit une grille mensuelle de six semaines commençant un lundi', () => {
    const days = buildCalendarDays(new Date(2026, 5, 1), [event()]);
    expect(days).toHaveLength(42);
    expect(days[0].date.getDay()).toBe(1);
    expect(days.find((day) => day.key === '2026-06-11')?.events).toHaveLength(1);
  });

  it('ne présente pas comme à venir un événement planifié dont la borne temporelle est passée', () => {
    expect(eventPresentationStatus(event(), new Date('2026-06-12T00:00:00Z'))).toBe('completed');
    expect(eventPresentationStatus(event({ends_at:null}), new Date('2026-06-12T00:00:00Z'))).toBe('completed');
    expect(eventPresentationStatus(event({status:'cancelled'}), new Date('2026-06-12T00:00:00Z'))).toBe('cancelled');
  });

  it('partage les filtres entre calendrier et liste', () => {
    const rows = [event(), event({ id: 'event-2', championship_id: 'champ-2', name: 'Rallye du Portugal', published: false })];
    expect(filterEvents(rows, { search: 'rallye', championship: 'all', status: 'all', publication: 'private', provider: 'all' }).map((row) => row.id)).toEqual(['event-2']);
  });

  it('retrouve les sessions par le nom du Meeting parent',()=>{
    const rows=[event({name:'Qualifying',session_title:'Qualifying',meeting_id:'meeting-1',meeting_name:'Singapore Grand Prix'})];
    expect(filterEvents(rows,{search:'Singapore Grand Prix',championship:'all',status:'all',publication:'all',provider:'all'})).toEqual(rows);
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
    expect(providerLabel('provider', null)).toBe('Identité fournisseur manquante');
    expect(availableProviderOptions([{origin:'provider',provider_key:null}])).toContainEqual({value:'provider-identity-missing',label:'Identité fournisseur manquante'});
  });

  it('prépare une création depuis un jour et normalise le slug', () => {
    expect(formDateForDay(new Date(2026, 5, 7))).toBe('2026-06-07T09:00');
    expect(slugify('Grand Prix d’Été')).toBe('grand-prix-d-ete');
  });
  it('prépare une création par plage dans les deux sens', () => {
    expect(formDatesForRange(new Date(2026, 5, 9), new Date(2026, 5, 11))).toEqual({ starts_at: '2026-06-09T09:00', ends_at: '2026-06-11T18:00' });
    expect(formDatesForRange(new Date(2026, 5, 11), new Date(2026, 5, 9))).toEqual({ starts_at: '2026-06-09T09:00', ends_at: '2026-06-11T18:00' });
  });

  it('conserve la durée pendant un déplacement',()=>{const moved=moveEvent(event(),new Date('2026-06-12T10:00:00Z'));expect(moved.starts_at).toBe('2026-06-12T10:00:00.000Z');expect(eventDuration(moved)).toBe(eventDuration(event()))});
  it('redimensionne uniquement la fin et refuse une durée négative',()=>{const row=event();expect(resizeEvent(row,new Date('2026-06-11T17:00:00Z')).starts_at).toBe(row.starts_at);expect(()=>resizeEvent(row,new Date('2026-06-10T00:00:00Z'))).toThrow()});
  it('restaure visuellement un déplacement ou redimensionnement rejeté', async () => {
    const original = event(); const optimistic = moveEvent(original, new Date('2026-06-12T10:00:00Z'));
    const result = await persistOptimisticEvent(original, optimistic, async () => { throw new Error('API indisponible'); });
    expect(result.rolledBack).toBe(true); expect(result.event).toEqual(original);
  });
  it('conserve la durée absolue à travers minuit et les changements d’heure', () => {
    const midnight = event({ starts_at: '2026-06-11T23:30:00Z', ends_at: '2026-06-12T01:00:00Z' });
    expect(eventDuration(moveEvent(midnight, new Date('2026-06-13T23:30:00Z')))).toBe(90 * 60_000);
    for (const row of [event({ starts_at: '2026-03-29T00:30:00Z', ends_at: '2026-03-29T02:30:00Z' }), event({ starts_at: '2026-10-25T00:30:00Z', ends_at: '2026-10-25T02:30:00Z' })]) {
      expect(eventDuration(moveEvent(row, new Date('2026-11-01T00:30:00Z')))).toBe(2 * 60 * 60_000);
    }
  });
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

  it('trie toutes les pages par date ou par ordre alphabétique', () => {
    const rows = [
      event({ id: 'zolder', name: 'Zolder', championship_name: 'WEC', starts_at: '2026-08-01T12:00:00Z' }),
      event({ id: 'assen', name: 'Assen', championship_name: 'MotoGP', starts_at: '2026-06-01T12:00:00Z' }),
      event({ id: 'barcelone', name: 'Barcelone', championship_name: 'Formule 1', starts_at: '2026-07-01T12:00:00Z' })
    ];
    expect(sortEventList(rows, 'starts_at', 'asc').map((row) => row.id)).toEqual(['assen', 'barcelone', 'zolder']);
    expect(sortEventList(rows, 'starts_at', 'desc').map((row) => row.id)).toEqual(['zolder', 'barcelone', 'assen']);
    expect(sortEventList(rows, 'name', 'asc').map((row) => row.id)).toEqual(['assen', 'barcelone', 'zolder']);
    expect(sortEventList(rows, 'championship', 'desc').map((row) => row.id)).toEqual(['zolder', 'assen', 'barcelone']);
  });
});
