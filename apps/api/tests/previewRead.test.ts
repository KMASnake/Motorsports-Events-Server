import Fastify from 'fastify';
import {readFileSync} from 'node:fs';
import {describe,expect,it,vi} from 'vitest';
import {decodeCursor,encodeCursor,type PageCursor,type SyncCursor} from '../src/preview/cursors.js';
import type {PreviewRepository,ResourceRow} from '../src/preview/repository.js';
import {previewReadRoutes} from '../src/routes/previewRead.js';

const SECRET='preview-cursor-test-secret-at-least-32-characters';
const NOW=new Date('2026-08-22T12:00:00.000Z');
const ids=['57000000-0000-4000-8000-000000000101','57000000-0000-4000-8000-000000000102','57000000-0000-4000-8000-000000000103'];
const rows:ResourceRow[]=ids.map((resourceId,index)=>({resourceType:'event',resourceId,revision:index+1,lifecycle:'active',promotedAt:NOW.toISOString(),sortKey:`2026-09-0${index+1}T12:00:00.000Z`,state:{resourceKind:'event',name:`Race ${index+1}`,sessionType:'race',sessionLabel:'Race',status:'scheduled',meetingId:ids[2],championshipId:'f1',championshipSeasonId:ids[0],circuitId:'legacy-circuit',venueId:ids[1],venueLayoutId:ids[2],startsAt:`2026-09-0${index+1}T12:00:00.000Z`,endsAt:null,timezone:'UTC',presence:'seen',provider_key:'must-not-leak',provenance:{private:true}}}));

function repository(overrides:Partial<PreviewRepository>={}):PreviewRepository{return {snapshotBoundary:vi.fn().mockResolvedValue(20),oldestSnapshotSequence:vi.fn().mockResolvedValue(0),oldestChangeSequence:vi.fn().mockResolvedValue(1),resolveChampionship:vi.fn().mockResolvedValue(ids[0]),list:vi.fn().mockImplementation(async input=>rows.slice(0,input.limit+1)),detail:vi.fn().mockResolvedValue(rows[0]),changes:vi.fn().mockResolvedValue([{sequence:13,resourceType:'event',resourceId:ids[0],revision:2,operation:'updated',changedFields:['startsAt'],occurredAt:NOW.toISOString(),current:rows[0]}]),...overrides};}
async function application(repo=repository(),clientId?:string){const app=Fastify({logger:false});await app.register(previewReadRoutes,{repository:repo,cursorSecret:SECRET,now:()=>NOW,...(clientId?{principal:()=>({clientId,championshipIds:new Set(['f1']),pageLimit:100,changesPageLimit:500} as never)}:{})});return app;}

describe('5.7-P-D Preview read API',()=>{
  it('returns an enveloped bounded canonical collection with distinct opaque cursors and no internal fields',async()=>{const repo=repository(),app=await application(repo);const response=await app.inject('/api/v1/events?limit=2&status=scheduled&session_type=race');expect(response.statusCode).toBe(200);const body=response.json();expect(body.data).toHaveLength(2);expect(body.data[0]).toMatchObject({id:ids[0],meeting_id:ids[2],championship_season_id:ids[0],venue_id:ids[1],venue_layout_id:ids[2],legacy_circuit_id:'legacy-circuit',session:{type:'race',type_key:'race',title:'Race'},status:'scheduled'});expect(body.pagination.has_more).toBe(true);expect(body.pagination.next_cursor).not.toBe(body.pagination.sync_cursor);expect(JSON.stringify(body)).not.toMatch(/provider|provenance|payload|score|correction/i);expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({resourceType:'event',limit:2,status:'scheduled',sessionType:'race',from:NOW.toISOString()}));await app.close();});
  it.each([
    ['/api/v1/championship-seasons','championshipSeason',{championship_id:'f1',key:'winter-2026',label:'Winter 2026',start_year:2026,end_year:2026,starts_on:null,ends_on:null}],
    ['/api/v1/venues','venue',{key:'monza',name:'Monza',kind_key:'circuit',city:null,region:null,country_code:'IT',timezone:null,latitude:null,longitude:null}],
    ['/api/v1/venue-layouts','venueLayout',{venue_id:ids[1],key:'gp',name:'Grand Prix'}]
  ] as const)('publishes the first-class canonical catalog on %s',async(url,resourceType,state)=>{const catalogRow:ResourceRow={resourceType,resourceId:ids[0],revision:1,lifecycle:'active',promotedAt:NOW.toISOString(),sortKey:'catalog',championshipId:resourceType==='championshipSeason'?'f1':null,state};const repo=repository({list:vi.fn().mockResolvedValue([catalogRow])}),app=await application(repo);const response=await app.inject(url);expect(response.statusCode).toBe(200);expect(response.json().data[0].id).toBe(ids[0]);expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({resourceType}));await app.close();});
  it.each(['practice','practice_1','practice_2','practice_3','qualifying','sprint_qualifying','sprint','warmup','race','test','stage','special_stage','other','future_session'])('accepts the extensible canonical session filter %s',async sessionType=>{const repo=repository(),app=await application(repo);expect((await app.inject(`/api/v1/events?session_type=${sessionType}`)).statusCode).toBe(200);expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({sessionType}));await app.close();});
  it.each(['scheduled','confirmed','postponed','cancelled','completed'])('accepts canonical status %s',async status=>{const repo=repository(),app=await application(repo);expect((await app.inject(`/api/v1/events?status=${status}`)).statusCode).toBe(200);expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({status}));await app.close();});
  it('rejects unknown, mutually exclusive, oversized and forged inputs before querying',async()=>{const repo=repository(),app=await application(repo);for(const url of [`/api/v1/events?unknown=x`,`/api/v1/events?championship=f1&championship_id=${ids[0]}`,`/api/v1/events?limit=101`,`/api/v1/events?cursor=${'x'.repeat(2049)}`,`/api/v1/events?cursor=forged.value`])expect((await app.inject(url)).statusCode,url).toBe(400);expect(repo.list).not.toHaveBeenCalled();await app.close();});
  it('keeps page, checkpoint and continuation cursors type-separated, bounded and signed',async()=>{
    const app=await application();
    const page=encodeCursor({kind:'page',resourceType:'event',snapshotSequence:12,sortKey:rows[0].sortKey,resourceId:ids[0],filterHash:'a'.repeat(43),issuedAt:1},SECRET);
    const continuation=encodeCursor({kind:'sync',role:'continuation',sequence:12,snapshotSequence:20,issuedAt:1},SECRET);
    const checkpoint=encodeCursor({kind:'sync',role:'checkpoint',sequence:12,issuedAt:1},SECRET);
    expect((await app.inject(`/api/v1/events?cursor=${continuation}`)).statusCode).toBe(400);
    expect((await app.inject(`/api/v1/changes?cursor=${page}`)).statusCode).toBe(400);
    expect(()=>decodeCursor(`${checkpoint}x`,'sync',SECRET)).toThrow('cursor_invalid');
    for(const invalid of [
      {kind:'sync',role:'continuation',sequence:12,snapshotSequence:11,issuedAt:1},
      {kind:'sync',role:'checkpoint',sequence:12,snapshotSequence:20,issuedAt:1},
      {kind:'sync',role:'unknown',sequence:12,issuedAt:1},
      {kind:'sync',sequence:12,issuedAt:1},
      {kind:'sync',sequence:12,snapshotSequence:20,issuedAt:1}
    ]){
      const token=encodeCursor(invalid as never,SECRET);
      const response=await app.inject(`/api/v1/changes?cursor=${encodeURIComponent(token)}`);
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('invalid_sync_cursor');
    }
    for(const original of [checkpoint,continuation]){
      const [payload,mac]=original.split('.'),decoded=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
      for(const mutation of [(value:Record<string,unknown>)=>{value.sequence=13;},(value:Record<string,unknown>)=>{value.role=value.role==='checkpoint'?'continuation':'checkpoint';},(value:Record<string,unknown>)=>{value.snapshotSequence=21;}]){
        const changed={...decoded};mutation(changed);
        const tampered=`${Buffer.from(JSON.stringify(changed)).toString('base64url')}.${mac}`;
        expect((await app.inject(`/api/v1/changes?cursor=${encodeURIComponent(tampered)}`)).statusCode).toBe(400);
      }
    }
    await app.close();
  });
  it('binds a page cursor to the original filters and effective future boundary',async()=>{const repo=repository(),app=await application(repo);const first=(await app.inject('/api/v1/events?limit=2&status=scheduled')).json();expect((await app.inject(`/api/v1/events?limit=2&status=completed&cursor=${first.pagination.next_cursor}`)).statusCode).toBe(400);const continued=await app.inject(`/api/v1/events?limit=2&status=scheduled&cursor=${first.pagination.next_cursor}`);expect(continued.statusCode).toBe(200);expect(repo.list).toHaveBeenLastCalledWith(expect.objectContaining({from:NOW.toISOString(),status:'scheduled'}));await app.close();});
  it('continues within one immutable snapshot and returns a reusable terminal checkpoint',async()=>{
    const changes=[13,14].map(sequence=>({sequence,resourceType:'event' as const,resourceId:ids[0],revision:2,operation:'updated' as const,changedFields:['startsAt'],occurredAt:NOW.toISOString(),current:rows[0]}));
    let latest=20;
    const repo=repository({snapshotBoundary:vi.fn(async()=>latest),changes:vi.fn(async(after:number,snapshot:number,limit:number)=>changes.filter(change=>change.sequence>after&&change.sequence<=snapshot).slice(0,limit+1))}),app=await application(repo);
    const first=(await app.inject('/api/v1/changes?include=data&limit=1')).json();
    expect(first.data[0]).toMatchObject({sequence:13,resource_type:'event',operation:'updated',changed_fields:['startsAt']});
    expect(first.data[0].current.id).toBe(ids[0]);
    expect(decodeCursor(first.pagination.next_cursor,'sync',SECRET)).toMatchObject({role:'continuation',sequence:13,snapshotSequence:20});
    expect(repo.changes).toHaveBeenCalledWith(0,20,1,true,undefined);
    const second=(await app.inject(`/api/v1/changes?include=data&limit=1&cursor=${encodeURIComponent(first.pagination.next_cursor)}`)).json();
    expect(repo.changes).toHaveBeenLastCalledWith(13,20,1,true,undefined);
    expect(second.data.map((change:{sequence:number})=>change.sequence)).toEqual([14]);
    expect(decodeCursor(second.pagination.next_cursor,'sync',SECRET)).toMatchObject({role:'checkpoint',sequence:20});
    latest=21;
    await app.inject(`/api/v1/changes?cursor=${encodeURIComponent(second.pagination.next_cursor)}`);
    expect(repo.changes).toHaveBeenLastCalledWith(20,21,100,false,undefined);
    await app.close();
  });
  it.each([[0,2],[1,2],[2,2],[3,2]] as const)('returns every sequence exactly once for a %i-change snapshot with page size %i',async(count,limit)=>{
    const changes=Array.from({length:count},(_,index)=>({sequence:index+1,resourceType:'event' as const,resourceId:ids[index%ids.length],revision:1,operation:'created' as const,changedFields:[],occurredAt:NOW.toISOString(),current:rows[index%rows.length]}));
    const repo=repository({snapshotBoundary:vi.fn().mockResolvedValue(count),oldestChangeSequence:vi.fn().mockResolvedValue(count?1:null),changes:vi.fn().mockImplementation(async(after:number,snapshot:number,pageLimit:number)=>changes.filter(change=>change.sequence>after&&change.sequence<=snapshot).slice(0,pageLimit+1))}),app=await application(repo);
    let cursor:string|undefined;const sequences:number[]=[],snapshots:number[]=[];
    do{
      const response=await app.inject(`/api/v1/changes?limit=${limit}${cursor?`&cursor=${encodeURIComponent(cursor)}`:''}`);
      expect(response.statusCode).toBe(200);
      const body=response.json(),decoded=decodeCursor(body.pagination.next_cursor,'sync',SECRET) as SyncCursor;
      sequences.push(...body.data.map((change:{sequence:number})=>change.sequence));
      if(body.pagination.has_more){expect(decoded.role).toBe('continuation');if(decoded.role==='continuation')snapshots.push(decoded.snapshotSequence);}
      else expect(decoded).toMatchObject({role:'checkpoint',sequence:count});
      cursor=body.pagination.has_more?body.pagination.next_cursor:undefined;
    }while(cursor);
    expect(sequences).toEqual(Array.from({length:count},(_,index)=>index+1));
    expect(new Set(sequences).size).toBe(sequences.length);
    expect(new Set(snapshots)).toEqual(count>limit?new Set([count]):new Set());
    await app.close();
  });
  it('rejects cursors bound to another client',async()=>{const firstClient='57000000-0000-4000-8000-000000000201',secondClient='57000000-0000-4000-8000-000000000202',app=await application(repository(),firstClient);const first=(await app.inject('/api/v1/changes?limit=1')).json(),cursor=first.pagination.next_cursor as string;await app.close();const other=await application(repository(),secondClient);expect((await other.inject(`/api/v1/changes?cursor=${encodeURIComponent(cursor)}`)).statusCode).toBe(400);await other.close();});
  it('includes first-class canonical catalog resources in the existing change journal',async()=>{const venue:ResourceRow={resourceType:'venue',resourceId:ids[1],revision:2,lifecycle:'active',promotedAt:NOW.toISOString(),sortKey:'monza',state:{key:'monza',name:'Monza',kind_key:'circuit',city:'Monza',region:null,country_code:'IT',timezone:'Europe/Rome',latitude:null,longitude:null}};const repo=repository({changes:vi.fn().mockResolvedValue([{sequence:14,resourceType:'venue',resourceId:ids[1],revision:2,operation:'updated',changedFields:['name'],occurredAt:NOW.toISOString(),current:venue}])}),app=await application(repo);const response=await app.inject('/api/v1/changes?include=data');expect(response.statusCode).toBe(200);expect(response.json().data[0]).toMatchObject({sequence:14,resource_type:'venue',resource_id:ids[1],operation:'updated',changed_fields:['name'],current:{id:ids[1],key:'monza',name:'Monza',timezone:'Europe/Rome'}});await app.close();});
  it('uses the retained journal boundary rather than issuedAt for sync expiry',async()=>{const old=Math.floor(new Date('2026-01-01T00:00:00Z').valueOf()/1000),retained=encodeCursor({kind:'sync',role:'checkpoint',sequence:12,issuedAt:old},SECRET),expired=encodeCursor({kind:'sync',role:'continuation',sequence:11,snapshotSequence:20,issuedAt:Math.floor(NOW.valueOf()/1000)},SECRET);const app=await application(repository({oldestChangeSequence:vi.fn().mockResolvedValue(12)}));expect((await app.inject(`/api/v1/changes?cursor=${retained}`)).statusCode).toBe(200);const gone=await app.inject(`/api/v1/changes?cursor=${expired}`);expect(gone.statusCode).toBe(410);expect(gone.json().error).toMatchObject({code:'sync_cursor_expired',request_id:expect.any(String)});await app.close();});
  it('returns safe structured errors for future snapshots, expired snapshots and database failures',async()=>{const future=encodeCursor({kind:'sync',role:'continuation',sequence:13,snapshotSequence:21,issuedAt:1},SECRET),futureCheckpoint=encodeCursor({kind:'sync',role:'checkpoint',sequence:21,issuedAt:1},SECRET),bounded=await application(repository({oldestSnapshotSequence:vi.fn().mockResolvedValue(5)}));for(const token of [future,futureCheckpoint])expect((await bounded.inject(`/api/v1/changes?cursor=${token}`)).statusCode).toBe(400);const first=(await bounded.inject('/api/v1/events?limit=2')).json(),decoded=decodeCursor(first.pagination.next_cursor,'page',SECRET) as PageCursor,expiredPage=encodeCursor({...decoded,snapshotSequence:4},SECRET);expect((await bounded.inject(`/api/v1/events?limit=2&cursor=${expiredPage}`)).statusCode).toBe(410);await bounded.close();const failed=await application(repository({list:vi.fn().mockRejectedValue(new Error('SQL secret stack'))}));const response=await failed.inject('/api/v1/events');expect(response.statusCode).toBe(500);expect(response.json().error).toMatchObject({code:'internal_error'});expect(response.body).not.toMatch(/SQL|secret|stack/);await failed.close();});
  it('returns tombstones as null current data and validates UUID details',async()=>{const repo=repository({changes:vi.fn().mockResolvedValue([{sequence:14,resourceType:'event',resourceId:ids[0],revision:3,operation:'removed',changedFields:[],occurredAt:NOW.toISOString(),current:null}])}),app=await application(repo);expect((await app.inject('/api/v1/changes?include=data')).json().data[0].current).toBeNull();expect((await app.inject('/api/v1/events/not-a-uuid')).statusCode).toBe(400);await app.close();});
  it('keeps the OpenAPI contract synchronized with typed responses on the definitive V1 routes',()=>{const document=JSON.parse(readFileSync(new URL('../../../docs/api-v1-preview.openapi.json',import.meta.url),'utf8'));expect(Object.keys(document.paths).sort()).toEqual(['/championship-seasons','/championship-seasons/{id}','/championships','/championships/{id}','/changes','/events','/events/{id}','/meetings','/meetings/{id}','/venue-layouts','/venue-layouts/{id}','/venues','/venues/{id}']);expect(JSON.stringify(document)).not.toContain('/preview');expect(document.paths['/events'].get.parameters.find((item:{name?:string})=>item.name==='limit')??document.components.parameters.Limit).toBeDefined();expect(document.paths['/changes'].get.responses['410'].description).toBe('sync_cursor_expired');expect(document.components.schemas.CanonicalEventStatus.enum).toEqual(['scheduled','confirmed','postponed','cancelled','completed']);for(const schema of ['CanonicalIdentity','ChampionshipIdentity','Championship','ChampionshipSeason','Venue','VenueLayout','CanonicalMeeting','CanonicalEvent','SessionType'])expect(document.components.schemas[schema]).toBeDefined();for(const [path,response] of [['/championship-seasons','ChampionshipSeasonCollection'],['/venues','VenueCollection'],['/venue-layouts','VenueLayoutCollection']] as const)expect(document.paths[path].get.responses['200'].$ref).toBe(`#/components/responses/${response}`);expect(document.paths['/events'].get.responses['200'].$ref).toBe('#/components/responses/EventCollection');expect(document.paths['/events/{id}'].get.responses['200'].$ref).toBe('#/components/responses/EventResource');expect(document.paths['/meetings'].get.responses['200'].$ref).toBe('#/components/responses/MeetingCollection');expect(document.paths['/meetings/{id}'].get.responses['200'].$ref).toBe('#/components/responses/MeetingResource');expect(document.paths['/championships'].get.responses['200'].$ref).toBe('#/components/responses/ChampionshipCollection');expect(document.paths['/championships/{id}'].get.responses['200'].$ref).toBe('#/components/responses/ChampionshipResource');});
});
