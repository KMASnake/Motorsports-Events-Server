import {describe,expect,it} from 'vitest';
import Ajv from 'ajv';
import {readFileSync} from 'node:fs';
import {
  canonicalPublicStatuses,championshipPublicId,compareCanonicalPublic,eventPublicSchema,meetingPublicSchema,
  serializeChampionshipSeason,serializePublishedResource,serializeSessionType,serializeVenue,serializeVenueLayout
} from '../src/public/canonicalPublicContract.js';
import type {ResourceRow} from '../src/preview/repository.js';

const ids={season:'57000000-0000-4000-8000-000000000001',venue:'57000000-0000-4000-8000-000000000002',layout:'57000000-0000-4000-8000-000000000003',meeting:'57000000-0000-4000-8000-000000000004',event:'57000000-0000-4000-8000-000000000005'};
const promotedAt='2026-09-29T12:00:00.000Z';
const state={resourceKind:'event',name:'Race',sessionType:'race',sessionLabel:'Grand Prix',status:'confirmed',meetingId:ids.meeting,championshipId:'formula-1',championshipSeasonId:ids.season,circuitId:'legacy-monza',venueId:ids.venue,venueLayoutId:ids.layout,season:2026,round:'8',startsAt:'2026-09-29T12:00:00.000Z',endsAt:'2026-09-29T14:00:00.000Z',timezone:'UTC',presence:'seen',providerId:'must-not-leak',externalId:'provider-event'};
const row=(resourceType:'event'|'meeting',resourceId:string,patch:Record<string,unknown>={}):ResourceRow=>({resourceType,resourceId,revision:3,lifecycle:'active',promotedAt,sortKey:String(state.startsAt),state:{...state,...patch}});
const openApi=JSON.parse(readFileSync(new URL('../../../docs/api-v1-preview.openapi.json',import.meta.url),'utf8'));
function validatesOpenApiSchema(name:string,value:unknown){
  const definitions=JSON.parse(JSON.stringify(openApi.components.schemas).replaceAll('#/components/schemas/','#/definitions/'));
  return new Ajv({allErrors:true,strict:false}).validate({definitions,$ref:`#/definitions/${name}`},value);
}

describe('F5-7A canonical public contract',()=>{
  it('derives a stable Championship publication UUID without changing the legacy identity',()=>{
    const first=championshipPublicId('formula-1');
    expect(first).toBe(championshipPublicId('formula-1'));
    expect(first).not.toBe(championshipPublicId('formula-e'));
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const publicRow:ResourceRow={resourceType:'championship',resourceId:first,revision:1,lifecycle:'active',promotedAt,sortKey:'Formula 1',state:{championshipId:'formula-1',name:'Formula 1',slug:'formula-1',disciplineKey:'single_seater'}};
    expect(serializePublishedResource(publicRow)).toMatchObject({id:first,legacy_id:'formula-1',discipline:{key:'single_seater'}});
    expect(()=>serializePublishedResource({...publicRow,resourceId:ids.event})).toThrow('canonical_public_championship_identity_mismatch');
  });

  it('keeps the complete runtime Championship response conformant with its closed OpenAPI schema',()=>{
    const legacyId='formula-1',id=championshipPublicId(legacyId);
    const output=serializePublishedResource({resourceType:'championship',resourceId:id,revision:2,lifecycle:'active',promotedAt,sortKey:'Formula 1',state:{championshipId:legacyId,name:'Formula 1',slug:'formula-1',shortName:'F1',officialName:'FIA Formula One World Championship',category:'single-seater',disciplineKey:'single_seater',disciplineLabel:'Monoplace',disciplineFamilyKey:'circuit',season:2026,logoUrl:'https://example.invalid/f1.svg',description:'World championship',availability:'preview',providerId:'private'}});
    expect(output).toMatchObject({id,legacy_id:legacyId,slug:'formula-1',short_name:'F1',official_name:'FIA Formula One World Championship',category:'single-seater',season:2026,logo_url:'https://example.invalid/f1.svg',description:'World championship',availability:'preview'});
    expect(validatesOpenApiSchema('Championship',output)).toBe(true);
    expect(JSON.stringify(output)).not.toMatch(/provider/i);
  });

  it('represents canonical Season, Venue, Layout and Session type identities without provider ids',()=>{
    expect(serializeChampionshipSeason({id:ids.season,championship_id:'formula-1',key:'2026',label:'2026',start_year:2026,end_year:2026,starts_on:'2026-01-01',ends_on:'2026-12-31'})).toEqual({id:ids.season,championship_id:championshipPublicId('formula-1'),key:'2026',label:'2026',start_year:2026,end_year:2026,starts_on:'2026-01-01',ends_on:'2026-12-31'});
    expect(serializeVenue({id:ids.venue,key:'monza',name:'Monza',kind_key:'circuit',city:'Monza',region:null,country_code:'IT',timezone:'Europe/Rome',latitude:45.62,longitude:9.28,provider_id:'private'})).toEqual({id:ids.venue,key:'monza',name:'Monza',kind_key:'circuit',city:'Monza',region:null,country_code:'IT',timezone:'Europe/Rome',latitude:45.62,longitude:9.28});
    expect(serializeVenueLayout({id:ids.layout,venue_id:ids.venue,key:'grand-prix',name:'Grand Prix',external_id:'private'})).toEqual({id:ids.layout,venue_id:ids.venue,key:'grand-prix',name:'Grand Prix'});
    expect(serializeSessionType({key:'race',label:'Course',sort_order:30,active:true,provider_key:'private'})).toEqual({key:'race',label:'Course',sort_order:30,active:true});
  });

  it('preserves canonical Meeting and Event references and compatibility Circuit separately',()=>{
    const meeting=serializePublishedResource(row('meeting',ids.meeting,{resourceKind:'meeting',sessionType:'other',sessionLabel:null,status:null,sessions:[{id:ids.event,type_key:'race',title:'Grand Prix',status:'confirmed',starts_at:'2026-09-29T12:00:00.000Z',ends_at:'2026-09-29T14:00:00.000Z',provider_id:'private',payload:{private:true}}]}));
    expect(meetingPublicSchema.parse(meeting)).toMatchObject({id:ids.meeting,championship:{id:'formula-1',canonical_id:championshipPublicId('formula-1')},championship_season_id:ids.season,venue_id:ids.venue,venue_layout_id:ids.layout,legacy_circuit_id:'legacy-monza'});
    expect(meeting.sessions).toEqual([{id:ids.event,type_key:'race',title:'Grand Prix',status:'confirmed',starts_at:'2026-09-29T12:00:00.000Z',ends_at:'2026-09-29T14:00:00.000Z'}]);
    expect(JSON.stringify(meeting)).not.toMatch(/provider|payload/i);
    const event=serializePublishedResource(row('event',ids.event));
    expect(eventPublicSchema.parse(event)).toMatchObject({id:ids.event,meeting_id:ids.meeting,championship_season_id:ids.season,venue_id:ids.venue,venue_layout_id:ids.layout,legacy_circuit_id:'legacy-monza',session:{type:'race',type_key:'race',name:'Grand Prix',title:'Grand Prix'},status:'confirmed'});
    expect(JSON.stringify(event)).not.toMatch(/provider|external/i);
  });

  it('uses the complete canonical status domain and absolute instants without presentation conversion',()=>{
    expect(canonicalPublicStatuses).toEqual(['scheduled','confirmed','postponed','cancelled','completed']);
    const event=eventPublicSchema.parse(serializePublishedResource(row('event',ids.event)));
    expect(event.starts_at).toBe('2026-09-29T12:00:00.000Z');
    expect(event.ends_at).toBe('2026-09-29T14:00:00.000Z');
    expect(event.timezone).toBe('UTC');
    expect(JSON.stringify(event)).not.toContain('Europe/Paris');
  });

  it('preserves explicit timezone and represents unknown or absent timezone as null',()=>{
    expect(serializePublishedResource(row('event',ids.event,{timezone:'America/New_York'})).timezone).toBe('America/New_York');
    expect(serializePublishedResource(row('event',ids.event,{timezone:null})).timezone).toBeNull();
    const withoutTimezone={...state};delete (withoutTimezone as Partial<typeof state>).timezone;
    const output=serializePublishedResource({...row('event',ids.event),state:withoutTimezone});
    expect(output.timezone).toBeNull();
    expect(validatesOpenApiSchema('CanonicalEvent',output)).toBe(true);
  });

  it('is deterministic for identical canonical input and rejects malformed canonical identities',()=>{
    const value=row('event',ids.event);
    expect(serializePublishedResource(value)).toEqual(serializePublishedResource(value));
    expect(()=>serializePublishedResource(row('event','provider-event-id'))).toThrow();
    expect(()=>serializeChampionshipSeason({id:'external-season',championship_id:'formula-1',key:'2026',label:'2026'})).toThrow();
  });

  it('defines deterministic ordering with canonical identity tie breakers',()=>{
    const events=[{id:ids.event,starts_at:'2026-09-29T12:00:00.000Z'},{id:ids.meeting,starts_at:'2026-09-28T12:00:00.000Z'},{id:ids.venue,starts_at:'2026-09-29T12:00:00.000Z'}];
    expect(events.sort((a,b)=>compareCanonicalPublic('event',a,b)).map(item=>item.id)).toEqual([ids.meeting,ids.venue,ids.event]);
    const types=[{key:'race',sort_order:30},{key:'qualifying',sort_order:20},{key:'practice',sort_order:20}];
    expect(types.sort((a,b)=>compareCanonicalPublic('sessionType',a,b)).map(item=>item.key)).toEqual(['practice','qualifying','race']);
  });
});
