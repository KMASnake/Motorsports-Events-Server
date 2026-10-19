import {describe,expect,it,vi} from 'vitest';
import type {PoolClient} from 'pg';
import {CanonicalCatalogPublicationService} from '../src/public/canonicalCatalogPublicationService.js';
import {championshipPublicId} from '../src/public/canonicalPublicContract.js';

const ids={season:'57000000-0000-4000-8000-000000000001',venue:'57000000-0000-4000-8000-000000000002',layout:'57000000-0000-4000-8000-000000000003'};
function fixture(){
  const rows={championship:{id:'f1',name:'Formula 1',slug:'formula-1',short_name:'F1',official_name:'Formula One',category:'single-seater',discipline_key:'single_seater',discipline_label:'Monoplace',discipline_family_key:'circuit_racing',season:2026,logo_url:null,description:null,active:true},season:{id:ids.season,championship_id:'f1',key:'winter-2026',label:'Winter 2026',start_year:2026,end_year:2026,starts_on:null,ends_on:null},venue:{id:ids.venue,key:'monza',name:'Monza',kind_key:'circuit',city:'Monza',region:null,country_code:'IT',timezone:'Europe/Rome',latitude:null,longitude:null},layout:{id:ids.layout,venue_id:ids.venue,key:'gp',name:'Grand Prix'}};
  const states=new Map<string,Record<string,unknown>>(),changes:unknown[][]=[],versions:unknown[][]=[];let sequence=0;
  const query=vi.fn(async(sql:string,args:unknown[]=[])=>{
    if(sql.includes('publication_controls'))return {rows:[{enabled:true}]};
    if(sql.includes('from championships championship'))return {rows:[rows.championship]};
    if(sql.includes('from championship_seasons'))return {rows:[rows.season]};
    if(sql.includes('from venues where'))return {rows:[rows.venue]};
    if(sql.includes('from venue_layouts'))return {rows:[rows.layout]};
    if(sql.startsWith('select pg_advisory'))return {rows:[]};
    if(sql.startsWith('select * from public_resource_states'))return {rows:states.has(`${args[0]}:${args[1]}`)?[states.get(`${args[0]}:${args[1]}`)]:[]};
    if(sql.startsWith('insert into public_resource_states')){states.set(`${args[0]}:${args[1]}`,{resource_type:args[0],resource_id:args[1],championship_id:args[2],revision:args[3],lifecycle:'active',canonical_state:JSON.parse(String(args[4])),state_checksum:args[5]});return {rows:[]};}
    if(sql.startsWith('insert into public_change_log')){changes.push(args);return {rows:[{sequence:++sequence}]};}
    if(sql.startsWith('insert into public_resource_versions')){versions.push(args);return {rows:[]};}
    throw new Error(`unexpected SQL: ${sql}`);
  });
  const transaction=async<T>(operation:(client:PoolClient)=>Promise<T>)=>operation({query} as unknown as PoolClient);
  return {service:new CanonicalCatalogPublicationService(transaction),rows,states,changes,versions};
}

describe('F5-7B canonical catalog publication',()=>{
  it('versions each first-class catalog resource and keeps identities canonical',async()=>{
    const f=fixture(),at=new Date('2026-09-29T12:00:00Z');
    const inputs=[['championship','f1'],['championshipSeason',ids.season],['venue',ids.venue],['venueLayout',ids.layout]] as const;
    for(const [resourceType,canonicalId] of inputs)expect(await f.service.publish({resourceType,canonicalId,occurredAt:at})).toMatchObject({outcome:'created',revision:1});
    expect([...f.states.keys()]).toEqual([`championship:${championshipPublicId('f1')}`,`championshipSeason:${ids.season}`,`venue:${ids.venue}`,`venueLayout:${ids.layout}`]);
    expect(f.states.get(`championship:${championshipPublicId('f1')}`)?.canonical_state).toMatchObject({championshipId:'f1'});
    expect(f.states.get(`championshipSeason:${ids.season}`)?.canonical_state).toMatchObject({championship_id:'f1',key:'winter-2026'});
    expect(f.states.get(`venueLayout:${ids.layout}`)?.canonical_state).toMatchObject({venue_id:ids.venue});
    expect(f.changes).toHaveLength(4);expect(f.versions).toHaveLength(4);
  });

  it('makes identical replay a no-op and one canonical mutation one revision/change/version',async()=>{
    const f=fixture(),input={resourceType:'venue' as const,canonicalId:ids.venue,occurredAt:new Date('2026-09-29T12:00:00Z')};
    await f.service.publish(input);
    expect(await f.service.publish(input)).toMatchObject({outcome:'unchanged',revision:1,sequence:null});
    expect(f.changes).toHaveLength(1);expect(f.versions).toHaveLength(1);
    f.rows.venue.name='Autodromo Nazionale Monza';
    expect(await f.service.publish({...input,occurredAt:new Date('2026-09-29T13:00:00Z')})).toMatchObject({outcome:'updated',revision:2,sequence:2});
    expect(f.changes).toHaveLength(2);expect(f.versions).toHaveLength(2);
    expect(f.changes[1]?.[4]).toEqual(['name']);
  });

  it('keeps same-year championship editions distinct by their persisted UUID',async()=>{
    const f=fixture(),at=new Date('2026-09-29T12:00:00Z'),secondSeasonId='57000000-0000-4000-8000-000000000004';
    await f.service.publish({resourceType:'championshipSeason',canonicalId:ids.season,occurredAt:at});
    f.rows.season.id=secondSeasonId;
    f.rows.season.key='summer-2026';
    f.rows.season.label='Summer 2026';
    await f.service.publish({resourceType:'championshipSeason',canonicalId:secondSeasonId,occurredAt:at});
    expect(f.states.get(`championshipSeason:${ids.season}`)?.canonical_state).toMatchObject({start_year:2026,key:'winter-2026'});
    expect(f.states.get(`championshipSeason:${secondSeasonId}`)?.canonical_state).toMatchObject({start_year:2026,key:'summer-2026'});
    expect([...f.states.keys()]).toEqual([`championshipSeason:${ids.season}`,`championshipSeason:${secondSeasonId}`]);
  });

  it('refuses to resurrect a public tombstone',async()=>{
    const f=fixture(),key=`venue:${ids.venue}`;
    f.states.set(key,{resource_type:'venue',resource_id:ids.venue,revision:2,lifecycle:'removed',state_checksum:'0'.repeat(64)});
    await expect(f.service.publish({resourceType:'venue',canonicalId:ids.venue,occurredAt:new Date()})).rejects.toThrow('publication_tombstone_permanent');
  });
});
