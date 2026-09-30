import Fastify from 'fastify';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {pool} from '../src/lib/db.js';
import {CanonicalCatalogPublicationService} from '../src/public/canonicalCatalogPublicationService.js';
import {championshipPublicId} from '../src/public/canonicalPublicContract.js';
import {PostgresPublicationService} from '../src/normalization/postgresPublicationService.js';
import {PreviewClientSecurityService} from '../src/preview/clientSecurity.js';
import {PostgresPreviewRepository} from '../src/preview/repository.js';
import {previewSecurityRoutes} from '../src/routes/previewSecurity.js';

const enabled=process.env.RUN_F57C_POSTGRES==='1',suite=enabled?describe:describe.skip;
const ids={championship:'f57c',season:'57c00000-0000-4000-8000-000000000001',venue:'57c00000-0000-4000-8000-000000000002',layout:'57c00000-0000-4000-8000-000000000003',provider:'57c00000-0000-4000-8000-000000000004',providerChampionship:'57c00000-0000-4000-8000-000000000005',meetingSource:'57c00000-0000-4000-8000-000000000006',eventSource:'57c00000-0000-4000-8000-000000000007',meetingCandidate:'57c00000-0000-4000-8000-000000000008',eventCandidate:'57c00000-0000-4000-8000-000000000009',meeting:'57c00000-0000-4000-8000-000000000010',event:'57c00000-0000-4000-8000-000000000011'};
const now=new Date('2026-09-30T12:00:00.000Z'),pepper='f57c-local-certification-pepper-000000',cursorSecret='f57c-local-certification-cursor-secret-000000';

suite('F5-7C deterministic public pipeline certification',()=>{
  const catalog=new CanonicalCatalogPublicationService(),publication=new PostgresPublicationService(),security=new PreviewClientSecurityService(pepper),repository=new PostgresPreviewRepository();
  let app:ReturnType<typeof Fastify>|undefined,key:string,deniedKey:string;
  beforeAll(async()=>{
    // Network access is forbidden for this certification process. The tested path is
    // database-backed and must never attempt to use fetch.
    globalThis.fetch=async()=>{throw new Error('f57c_unexpected_network_attempt');};
    await pool.query(`insert into championships(id,slug,name,season,active,sync_enabled) values($1,'f57c','F57C Championship',2026,true,false)`,[ids.championship]);
    await pool.query(`insert into championship_seasons(id,championship_id,key,label,start_year,end_year) values($1,$2,'2026','2026',2026,2026)`,[ids.season,ids.championship]);
    await pool.query(`insert into venues(id,key,name,kind_key,timezone) values($1,'f57c-venue','F57C Venue','circuit',null)`,[ids.venue]);
    await pool.query(`insert into venue_layouts(id,venue_id,key,name) values($1,$2,'gp','Grand Prix')`,[ids.layout,ids.venue]);
    await pool.query(`insert into provider_instances(id,adapter_key,name,enabled,state) values($1,'f57c-fixture','F57C Fixture',false,'paused')`,[ids.provider]);
    await pool.query(`insert into provider_championships(id,provider_instance_id,championship_id,external_championship_id,sync_state) values($1,$2,$3,'fixture-championship','inactive')`,[ids.providerChampionship,ids.provider,ids.championship]);
    const source=async(id:string,kind:'meeting'|'event',external:string,parent:string|null,hash:string)=>pool.query(`insert into provider_source_entities(id,provider_instance_id,provider_championship_id,entity_kind,external_id,parent_source_entity_id,season,source_data,source_hash,first_observed_at,last_observed_at,last_changed_at) values($1,$2,$3,$4,$5,$6,2026,'{}',$7,$8,$8,$8)`,[id,ids.provider,ids.providerChampionship,kind,external,parent,hash,now]);
    await source(ids.meetingSource,'meeting','fixture-meeting',null,'a'.repeat(64));
    await source(ids.eventSource,'event','fixture-event',ids.meetingSource,'b'.repeat(64));
    const client=await security.createClient({name:'F57C entitled',scopes:['championships:read','meetings:read','events:read','changes:read'],championshipIds:[ids.championship],pageLimit:2,changesPageLimit:100});
    key=(await security.createKey(client.id,'test','F57C')).api_key;
    const denied=await security.createClient({name:'F57C denied',scopes:['championships:read','meetings:read','events:read','changes:read'],championshipIds:[]});
    deniedKey=(await security.createKey(denied.id,'test','F57C denied')).api_key;
    app=Fastify({logger:false});
    await app.register(previewSecurityRoutes,{security,repository,cursorSecret,now:()=>now});
    await app.ready();
  });
  afterAll(async()=>{if(app)await app.close();await pool.end();});

  it('fails closed then atomically establishes canonical catalogs and replays without changes',async()=>{
    await pool.query("update publication_controls set enabled=false where control_key='promotion'");
    await expect(catalog.establish(now)).rejects.toThrow('canonical_publication_establishment_disabled');
    expect((await pool.query("select count(*)::int count from public_resource_states where resource_type=any(array['championship','championshipSeason','venue','venueLayout']) and (canonical_state->>'championshipId'=$1 or championship_id=$1)",[ids.championship])).rows[0].count).toBe(0);
    await pool.query("update publication_controls set enabled=true where control_key='promotion'");
    const first=await catalog.establish(now);expect(first.changed).toBeGreaterThanOrEqual(4);
    const before=(await pool.query(`select (select count(*)::int from public_resource_versions) versions,(select count(*)::int from public_change_log) changes`)).rows[0];
    expect(await catalog.establish(new Date('2026-09-30T12:01:00Z'))).toMatchObject({changed:0});
    expect((await pool.query(`select (select count(*)::int from public_resource_versions) versions,(select count(*)::int from public_change_log) changes`)).rows[0]).toEqual(before);
    const rows=(await pool.query(`select resource_type,resource_id,canonical_state from public_resource_states where resource_id=any($1::uuid[]) or resource_id=$2 order by resource_type`,[[ids.season,ids.venue,ids.layout],championshipPublicId(ids.championship)])).rows;
    expect(rows.map(row=>row.resource_type)).toEqual(['championship','championshipSeason','venue','venueLayout']);
    expect(rows.find(row=>row.resource_type==='championshipSeason').canonical_state.championship_id).toBe(ids.championship);
    expect(rows.find(row=>row.resource_type==='venueLayout').canonical_state.venue_id).toBe(ids.venue);
    expect(rows.find(row=>row.resource_type==='venue').canonical_state.timezone).toBeNull();
  });

  it('serves actual authenticated HTTP resources, pagination, cursors and changes',async()=>{
    if(!app)throw new Error('f57c_http_app_not_ready');
    const candidate=async(id:string,sourceId:string,kind:'meeting'|'event',proposed:string,normalized:Record<string,unknown>)=>{
      await pool.query(`insert into normalized_candidates(id,source_entity_id,source_hash,normalization_version,resource_kind,candidate_data) values($1,$2,$3,'f57c-v1',$4,$5::jsonb)`,[id,sourceId,kind==='meeting'?'a'.repeat(64):'b'.repeat(64),kind,JSON.stringify({normalized,resolution:{decision:'create'},proposed_uuid:proposed,source_revision:1})]);
      await pool.query(`insert into normalization_decisions(id,source_entity_id,candidate_id,candidate_revision,decision,target_kind,target_id,normalization_version,actor_id,reason,idempotency_key,decision_fingerprint) values(gen_random_uuid(),$1,$2,1,'create',null,null,'f57c-v1','f57c-certification','deterministic fixture',$3,$4)`,[sourceId,id,`f57c-${kind}`,(kind==='meeting'?'c':'d').repeat(64)]);
      const result=await publication.publishCandidate({candidateId:id,occurredAt:now});
      expect(result).toMatchObject({outcome:'created',revision:1});
      return result;
    };
    await candidate(ids.meetingCandidate,ids.meetingSource,'meeting',ids.meeting,{resourceKind:'meeting',name:'F57C Meeting',championshipId:ids.championship,championshipSeasonId:ids.season,venueId:ids.venue,venueLayoutId:ids.layout,season:2026,round:'1',startsAt:'2026-10-01T09:00:00.000Z',endsAt:'2026-10-01T12:00:00.000Z',timezone:null,status:'scheduled',sessionType:'other',sessionLabel:null,presence:'seen'});
    await candidate(ids.eventCandidate,ids.eventSource,'event',ids.event,{resourceKind:'event',name:'F57C Race',championshipId:ids.championship,championshipSeasonId:ids.season,venueId:ids.venue,venueLayoutId:ids.layout,season:2026,startsAt:'2026-10-01T10:00:00.000Z',endsAt:'2026-10-01T11:30:00.000Z',timezone:null,status:'confirmed',sessionType:'race',sessionLabel:'Race',presence:'seen'});
    const initial=await pool.query(`select state.revision::int,(select count(*)::int from public_resource_versions where resource_type='event' and resource_id=$1) versions,(select count(*)::int from public_change_log where resource_type='event' and resource_id=$1) changes from public_resource_states state where state.resource_type='event' and state.resource_id=$1`,[ids.event]);
    expect(initial.rows[0]).toMatchObject({revision:1,versions:1,changes:1});
    expect(await publication.publishCandidate({candidateId:ids.eventCandidate,occurredAt:new Date('2026-09-30T12:01:00Z')})).toMatchObject({outcome:'created',revision:1});
    expect((await pool.query(`select state.revision::int,(select count(*)::int from public_resource_versions where resource_type='event' and resource_id=$1) versions,(select count(*)::int from public_change_log where resource_type='event' and resource_id=$1) changes from public_resource_states state where state.resource_type='event' and state.resource_id=$1`,[ids.event])).rows[0]).toEqual(initial.rows[0]);
    expect((await app.inject({method:'GET',url:'/api/v1/championship-seasons'})).statusCode).toBe(401);
    expect((await app.inject({method:'GET',url:'/api/v1/championship-seasons',headers:{authorization:'Bearer invalid'}})).statusCode).toBe(401);
    const list=await app.inject({method:'GET',url:`/api/v1/championship-seasons/${ids.season}`,headers:{authorization:`Bearer ${key}`}});
    expect(list.statusCode).toBe(200);expect(list.headers.etag).toBeTruthy();
    expect(list.json()).toMatchObject({id:ids.season,championship_id:championshipPublicId(ids.championship)});
    const venue=await app.inject({method:'GET',url:`/api/v1/venues/${ids.venue}`,headers:{authorization:`Bearer ${key}`}});
    expect(venue.statusCode).toBe(200);expect(venue.json()).toMatchObject({id:ids.venue,timezone:null});
    const meeting=await app.inject({method:'GET',url:`/api/v1/meetings/${ids.meeting}`,headers:{authorization:`Bearer ${key}`}});
    expect(meeting.statusCode).toBe(200);expect(meeting.json()).toMatchObject({id:ids.meeting,championship_season_id:ids.season,venue_id:ids.venue,venue_layout_id:ids.layout,timezone:null});
    const event=await app.inject({method:'GET',url:`/api/v1/events/${ids.event}`,headers:{authorization:`Bearer ${key}`}});
    expect(event.statusCode).toBe(200);expect(event.json()).toMatchObject({id:ids.event,meeting_id:ids.meeting,status:'confirmed',timezone:null,session:{type_key:'race',title:'Race'}});
    const confirmed=await app.inject({method:'GET',url:'/api/v1/events?status=confirmed&from=2026-09-01T00:00:00.000Z',headers:{authorization:`Bearer ${key}`}});
    expect(confirmed.statusCode).toBe(200);expect(confirmed.json().data.map((row:{id:string})=>row.id)).toContain(ids.event);
    const confirmedChanges=await app.inject({method:'GET',url:'/api/v1/changes?limit=100&include=data',headers:{authorization:`Bearer ${key}`}});
    const confirmedChange=confirmedChanges.json().data.find((row:{resource_id:string})=>row.resource_id===ids.event);
    expect(confirmedChange).toMatchObject({resource_type:'event',resource_id:ids.event,revision:1,operation:'created',current:{id:ids.event,meeting_id:ids.meeting,status:'confirmed',timezone:null}});
    const denied=await app.inject({method:'GET',url:`/api/v1/championship-seasons/${ids.season}`,headers:{authorization:`Bearer ${deniedKey}`}});
    expect(denied.statusCode).toBe(404);
    const first=await app.inject({method:'GET',url:'/api/v1/changes?limit=2&include=data',headers:{authorization:`Bearer ${key}`}});
    expect(first.statusCode).toBe(200);const page=first.json();expect(page.data).toHaveLength(2);expect(page.pagination.has_more).toBe(true);
    expect(page.data[0].sequence).toBeLessThan(page.data[1].sequence);
    const second=await app.inject({method:'GET',url:`/api/v1/changes?limit=2&include=data&cursor=${encodeURIComponent(page.pagination.next_cursor)}`,headers:{authorization:`Bearer ${key}`}});
    expect(second.statusCode).toBe(200);expect(second.json().data[0].sequence).toBeGreaterThan(page.data[1].sequence);
  });

  it('rolls back injected publication failure, converges on retry, and exposes one tombstone',async()=>{
    await pool.query('update venues set name=$2 where id=$1',[ids.venue,'F57C Venue revised']);
    const before=(await pool.query(`select revision::int from public_resource_states where resource_type='venue' and resource_id=$1`,[ids.venue])).rows[0].revision;
    await expect(catalog.publish({resourceType:'venue',canonicalId:ids.venue,occurredAt:now,failBeforeCommit:true})).rejects.toThrow('catalog_publication_injected_failure');
    expect((await pool.query(`select revision::int from public_resource_states where resource_type='venue' and resource_id=$1`,[ids.venue])).rows[0].revision).toBe(before);
    expect(await catalog.publish({resourceType:'venue',canonicalId:ids.venue,occurredAt:new Date('2026-09-30T12:02:00Z')})).toMatchObject({outcome:'updated',revision:before+1});
    const removed=await catalog.remove({resourceType:'venueLayout',resourceId:ids.layout,occurredAt:new Date('2026-09-30T12:03:00Z')});
    expect(removed).toMatchObject({outcome:'removed'});expect(await catalog.remove({resourceType:'venueLayout',resourceId:ids.layout,occurredAt:new Date('2026-09-30T12:04:00Z')})).toMatchObject({outcome:'unchanged'});
    if(!app)throw new Error('f57c_http_app_not_ready');
    const changes=await app.inject({method:'GET',url:'/api/v1/changes?limit=100',headers:{authorization:`Bearer ${key}`}});
    const tombstones=changes.json().data.filter((row:{resource_id:string;operation:string})=>row.resource_id===ids.layout&&row.operation==='removed');
    expect(tombstones).toHaveLength(1);
    const orphans=await pool.query(`select count(*)::int count from public_resource_versions version left join public_change_log change on change.sequence=version.publication_sequence where change.sequence is null`);
    expect(orphans.rows[0].count).toBe(0);
  });
});
