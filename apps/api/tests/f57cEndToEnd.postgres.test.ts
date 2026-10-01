import Fastify from 'fastify';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {pool} from '../src/lib/db.js';
import {CanonicalCatalogPublicationService} from '../src/public/canonicalCatalogPublicationService.js';
import {championshipPublicId} from '../src/public/canonicalPublicContract.js';
import {PostgresPublicationService} from '../src/normalization/postgresPublicationService.js';
import {PostgresDeterministicNormalizationService} from '../src/normalization/postgresDeterministicNormalizationService.js';
import {PostgresReconciliationService} from '../src/reconciliation/postgresReconciliationService.js';
import {AcquisitionTransactionService} from '../src/providers/acquisitionTransactionService.js';
import type {AcquiredProviderSourceItem,JsonObject,ProviderAdapter} from '../src/providers/contracts.js';
import {PersistentSchedulerService} from '../src/providers/schedulerService.js';
import {PreviewClientSecurityService} from '../src/preview/clientSecurity.js';
import {PostgresPreviewRepository} from '../src/preview/repository.js';
import {decodeCursor,type SyncCursor} from '../src/preview/cursors.js';
import {previewSecurityRoutes} from '../src/routes/previewSecurity.js';
import {eventRoutes} from '../src/routes/events.js';

const enabled=process.env.RUN_F57C_POSTGRES==='1',suite=enabled?describe:describe.skip;
const ids={championship:'f57c',season:'57c00000-0000-4000-8000-000000000001',venue:'57c00000-0000-4000-8000-000000000002',layout:'57c00000-0000-4000-8000-000000000003',provider:'57c00000-0000-4000-8000-000000000004',providerChampionship:'57c00000-0000-4000-8000-000000000005',meeting:'57c00000-0000-4000-8000-000000000010',event:'57c00000-0000-4000-8000-000000000011'};
const now=new Date('2026-09-30T12:00:00.000Z'),pepper='f57c-local-certification-pepper-000000',cursorSecret='f57c-local-certification-cursor-secret-000000';

suite('F5-7C deterministic public pipeline certification',()=>{
  const clock={now:()=>now},catalog=new CanonicalCatalogPublicationService(),acquisition=new AcquisitionTransactionService(new PersistentSchedulerService(clock),clock),normalization=new PostgresDeterministicNormalizationService(),publication=new PostgresPublicationService(),reconciliation=new PostgresReconciliationService(),security=new PreviewClientSecurityService(pepper),repository=new PostgresPreviewRepository();
  let app:ReturnType<typeof Fastify>|undefined,legacyApp:ReturnType<typeof Fastify>|undefined,key:string,deniedKey:string;
  let meetingSourceId='',eventSourceId='',explicitMeetingSourceId='',explicitEventSourceId='',utcMeetingSourceId='',utcEventSourceId='',referenceSourceId='',failureSourceId='',meetingId=ids.meeting,eventId=ids.event,eventCandidateId='';
  beforeAll(async()=>{
    // Network access is forbidden for this certification process. The tested path is
    // database-backed and must never attempt to use fetch.
    globalThis.fetch=async()=>{throw new Error('f57c_unexpected_network_attempt');};
    await pool.query(`insert into championships(id,slug,name,season,active,sync_enabled) values($1,'f57c','F57C Championship',2026,true,false)`,[ids.championship]);
    await pool.query(`insert into championship_seasons(id,championship_id,key,label,start_year,end_year) values($1,$2,'2026','2026',2026,2026)`,[ids.season,ids.championship]);
    await pool.query(`insert into venues(id,key,name,kind_key,timezone) values($1,'f57c-venue','F57C Venue','circuit',null)`,[ids.venue]);
    await pool.query(`insert into venue_layouts(id,venue_id,key,name) values($1,$2,'gp','Grand Prix')`,[ids.layout,ids.venue]);
    await pool.query(`insert into circuits(id,name,country_code,timezone) values('f57c-circuit','F57C Circuit','FR','Europe/Paris')`);
    await pool.query(`insert into circuit_venue_links(circuit_id,venue_id,venue_layout_id) values('f57c-circuit',$1,$2)`,[ids.venue,ids.layout]);
    await pool.query(`insert into provider_instances(id,adapter_key,name,enabled,state) values($1,'f57c-fixture','F57C Fixture',true,'active')`,[ids.provider]);
    await pool.query(`insert into provider_championships(id,provider_instance_id,championship_id,external_championship_id,sync_state) values($1,$2,$3,'fixture-championship','inactive')`,[ids.providerChampionship,ids.provider,ids.championship]);
    const championshipLink='57c00000-0000-4000-8000-000000000012',seasonLink='57c00000-0000-4000-8000-000000000013',stream='57c00000-0000-4000-8000-000000000014',run='57c00000-0000-4000-8000-000000000017';
    await pool.query(`insert into championship_source_links(id,provider_instance_id,external_championship_id,championship_id,created_by) values($1,$2,'fixture-championship',$3,'f57c')`,[championshipLink,ids.provider,ids.championship]);
    await pool.query(`insert into championship_season_source_links(id,championship_source_link_id,provider_instance_id,external_championship_id,external_season_id,championship_id,championship_season_id,created_by) values($1,$2,$3,'fixture-championship','2026',$4,$5,'f57c')`,[seasonLink,championshipLink,ids.provider,ids.championship,ids.season]);
    const expires=new Date(now.getTime()+60_000);
    await pool.query(`insert into sync_streams(id,provider_championship_id,phase,state,cursor_version,lease_owner,lease_acquired_at,lease_expires_at,lease_generation) values($1,$2,'current','running',1,'f57c-certification',$3,$4,1)`,[stream,ids.providerChampionship,now,expires]);
    await pool.query(`insert into sync_runs(id,stream_id,worker_id,lease_generation,work_class,cursor_before,status,request_id) values($1,$2,'f57c-certification',1,'current','{}','running','f57c-certification')`,[run,stream]);
    const items:AcquiredProviderSourceItem[]=[
      {entityKind:'meeting',externalId:'fixture-meeting',identityIsSynthetic:false,parentExternalId:null,parentEntityKind:null,season:2026,sourceData:{name:'F57C Meeting',championship_id:'fixture-championship',external_season_id:'2026',circuit_id:'fixture-circuit',starts_at:'2026-10-01T09:00:00.000Z',ends_at:'2026-10-01T12:00:00.000Z',timezone:null,status:'Scheduled',round:'1'}},
      {entityKind:'event',externalId:'fixture-event',identityIsSynthetic:false,parentExternalId:'fixture-meeting',parentEntityKind:'meeting',season:2026,sourceData:{name:'F57C Race',championship_id:'fixture-championship',circuit_id:'fixture-circuit',starts_at:'2026-10-01T10:00:00.000Z',ends_at:'2026-10-01T11:30:00.000Z',timezone:null,status:'Confirmed',session_type:'Race'}},
      {entityKind:'meeting',externalId:'fixture-meeting-explicit',identityIsSynthetic:false,parentExternalId:null,parentEntityKind:null,season:2026,sourceData:{name:'F57C Explicit Meeting',championship_id:'fixture-championship',external_season_id:'2026',circuit_id:'fixture-circuit',starts_at:'2026-10-02T09:00:00.000Z',ends_at:'2026-10-02T12:00:00.000Z',timezone:'Europe/Paris',status:'Scheduled',round:'2'}},
      {entityKind:'event',externalId:'fixture-event-explicit',identityIsSynthetic:false,parentExternalId:'fixture-meeting-explicit',parentEntityKind:'meeting',season:2026,sourceData:{name:'F57C Explicit Race',championship_id:'fixture-championship',circuit_id:'fixture-circuit',starts_at:'2026-10-02T10:00:00.000Z',ends_at:'2026-10-02T11:30:00.000Z',timezone:'Europe/Paris',status:'Confirmed',session_type:'Race'}},
      {entityKind:'meeting',externalId:'fixture-meeting-utc',identityIsSynthetic:false,parentExternalId:null,parentEntityKind:null,season:2026,sourceData:{name:'F57C UTC Meeting',championship_id:'fixture-championship',external_season_id:'2026',circuit_id:'fixture-circuit',starts_at:'2026-10-03T09:00:00.000Z',ends_at:'2026-10-03T12:00:00.000Z',timezone:'UTC',status:'Scheduled',round:'3'}},
      {entityKind:'event',externalId:'fixture-event-utc',identityIsSynthetic:false,parentExternalId:'fixture-meeting-utc',parentEntityKind:'meeting',season:2026,sourceData:{name:'F57C UTC Race',championship_id:'fixture-championship',circuit_id:'fixture-circuit',starts_at:'2026-10-03T10:00:00.000Z',ends_at:'2026-10-03T11:30:00.000Z',timezone:'UTC',status:'Confirmed',session_type:'Race'}},
      ...['reference','failure'].map(label=>({entityKind:'meeting' as const,externalId:`fixture-meeting-atomic-${label}`,identityIsSynthetic:false,parentExternalId:null,parentEntityKind:null,season:2026,sourceData:{name:'F57C Atomic Meeting',championship_id:'fixture-championship',external_season_id:'2026',circuit_id:'fixture-circuit',starts_at:'2026-10-04T09:00:00.000Z',ends_at:'2026-10-04T12:00:00.000Z',timezone:'UTC',status:'Scheduled',round:'4'}}))
    ];
    const adapter={key:'f57c-fixture',capabilities:{supportsChampionshipDiscovery:false,supportsSeasonDiscovery:false,supportsQuotaHeaders:false,supportsConnectionTest:false},providerConfigVersion:1,sourceConfigVersion:1,cursorVersion:1,providerForm:()=>[],championshipForm:()=>[],validateProviderConfig:()=>({}),validateSourceConfig:()=>({}),initialCursor:()=>({}),validateCursor:()=>({}),serializeCursor:cursor=>cursor,restoreCursor:()=>({}),fetchWorkUnit:async()=>({status:'complete' as const,items,itemAnomalies:[],nextCursor:{done:true},requestCount:0,complete:true,completionReason:'end_of_collection' as const}),normalize:()=>({accepted:[],rejected:[]}),confirmEmptySeason:async()=>({confirmedEmpty:false,reason:'not empty'})} satisfies ProviderAdapter<JsonObject,JsonObject,JsonObject,AcquiredProviderSourceItem>;
    const acquired=await acquisition.executeUnit({providerInstanceId:ids.provider,providerChampionshipId:ids.providerChampionship,season:2026,workClass:'current_global',safeUnitKey:'f57c',lease:{streamId:stream,runId:run,workerId:'f57c-certification',generation:1},adapter,fetchInput:{providerInstanceId:ids.provider,providerChampionshipId:ids.providerChampionship,championshipId:ids.championship,providerConfig:{},credentials:{},sourceConfig:{},phase:'current',season:2026,cursor:{},signal:new AbortController().signal}});
    expect(acquired).toMatchObject({checkpointAdvanced:true,result:{requestCount:0,complete:true}});
    const sources=(await pool.query(`select id,external_id from provider_source_entities where provider_championship_id=$1`,[ids.providerChampionship])).rows;
    meetingSourceId=sources.find(row=>row.external_id==='fixture-meeting').id;eventSourceId=sources.find(row=>row.external_id==='fixture-event').id;
    explicitMeetingSourceId=sources.find(row=>row.external_id==='fixture-meeting-explicit').id;explicitEventSourceId=sources.find(row=>row.external_id==='fixture-event-explicit').id;
    utcMeetingSourceId=sources.find(row=>row.external_id==='fixture-meeting-utc').id;utcEventSourceId=sources.find(row=>row.external_id==='fixture-event-utc').id;
    referenceSourceId=sources.find(row=>row.external_id==='fixture-meeting-atomic-reference').id;failureSourceId=sources.find(row=>row.external_id==='fixture-meeting-atomic-failure').id;
    const client=await security.createClient({name:'F57C entitled',scopes:['championships:read','meetings:read','events:read','changes:read'],championshipIds:[ids.championship],pageLimit:2,changesPageLimit:100});
    key=(await security.createKey(client.id,'test','F57C')).api_key;
    const denied=await security.createClient({name:'F57C denied',scopes:['championships:read','meetings:read','events:read','changes:read'],championshipIds:[]});
    deniedKey=(await security.createKey(denied.id,'test','F57C denied')).api_key;
    app=Fastify({logger:false});
    await app.register(previewSecurityRoutes,{security,repository,cursorSecret,now:()=>now});
    await app.ready();
    legacyApp=Fastify({logger:false});
    await legacyApp.register(eventRoutes);
    await legacyApp.ready();
  });
  afterAll(async()=>{if(app)await app.close();if(legacyApp)await legacyApp.close();await pool.end();});

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
    const mapping={version:'f57c-v1',rulesVersion:'f57c-r1',championshipIds:{'fixture-championship':ids.championship},circuitIds:{'fixture-circuit':'f57c-circuit'},sessionTypes:{Race:'race' as const},statuses:{Scheduled:'scheduled' as const,Confirmed:'confirmed' as const}};
    const candidate=async(sourceId:string,kind:'meeting'|'event')=>{
      const normalized=await normalization.normalizeUnit({sourceEntityId:sourceId,scopeKey:`f57c:${kind}`,expectedFenceGeneration:0,normalizationNow:now,mapping});
      expect(normalized.resolution.decision).toBe('create');
      const result=await publication.publishCandidate({candidateId:normalized.candidateId,occurredAt:now});
      expect(result).toMatchObject({outcome:'created',revision:1});
      return normalized;
    };
    meetingId=(await candidate(meetingSourceId,'meeting')).proposedUuid;
    const normalizedEvent=await candidate(eventSourceId,'event');eventId=normalizedEvent.proposedUuid;eventCandidateId=normalizedEvent.candidateId;
    const explicitMeetingId=(await candidate(explicitMeetingSourceId,'meeting')).proposedUuid;
    const explicitEventId=(await candidate(explicitEventSourceId,'event')).proposedUuid;
    const utcMeetingId=(await candidate(utcMeetingSourceId,'meeting')).proposedUuid;
    const utcEventId=(await candidate(utcEventSourceId,'event')).proposedUuid;
    const policy='57c00000-0000-4000-8000-000000000016';
    await pool.query(`insert into reconciliation_policies(id,championship_id,championship_season_id,resource_kind,version,status,checksum,idempotency_key,request_fingerprint,actor_id,activated_at) values($1,$2,$3,'event',1,'active',$4,'f57c-policy',$4,'f57c',$5)`,[policy,ids.championship,ids.season,'e'.repeat(64),now]);
    for(const [field,klass] of [['name','DISPLAY'],['sessionLabel','DISPLAY'],['sessionType','DISPLAY'],['startsAt','SCHEDULE'],['endsAt','SCHEDULE'],['status','STATUS'],['venueId','REFERENCE'],['venueLayoutId','REFERENCE']] as const)await pool.query(`insert into reconciliation_policy_field_rules(id,policy_id,field_name,field_class,provider_priority,status_rules) values(gen_random_uuid(),$1,$2,$3,'[["f57c-fixture"]]'::jsonb,$4::jsonb)`,[policy,field,klass,JSON.stringify(field==='status'?{confirmed:['confirmed']}:{})]);
    const preview=await reconciliation.preview({entityKind:'event',entityUuid:eventId,policyId:policy,evaluationAt:now.toISOString()});
    expect(preview.result.effectiveState).toMatchObject({status:'confirmed',timezone:null,meetingId:meetingId});
    expect(await reconciliation.apply({entityKind:'event',entityUuid:eventId,policyId:policy,evaluationAt:now.toISOString(),previewChecksum:preview.previewChecksum,idempotencyKey:'f57c-confirmed',actorId:'f57c'})).toMatchObject({outcome:'no_op',replay:false});
    const initial=await pool.query(`select state.revision::int,(select count(*)::int from public_resource_versions where resource_type='event' and resource_id=$1) versions,(select count(*)::int from public_change_log where resource_type='event' and resource_id=$1) changes from public_resource_states state where state.resource_type='event' and state.resource_id=$1`,[eventId]);
    expect(initial.rows[0]).toMatchObject({revision:1,versions:1,changes:1});
    expect(await publication.publishCandidate({candidateId:eventCandidateId,occurredAt:new Date('2026-09-30T12:01:00Z')})).toMatchObject({outcome:'created',revision:1});
    expect((await pool.query(`select state.revision::int,(select count(*)::int from public_resource_versions where resource_type='event' and resource_id=$1) versions,(select count(*)::int from public_change_log where resource_type='event' and resource_id=$1) changes from public_resource_states state where state.resource_type='event' and state.resource_id=$1`,[eventId])).rows[0]).toEqual(initial.rows[0]);
    expect((await app.inject({method:'GET',url:'/api/v1/championship-seasons'})).statusCode).toBe(401);
    expect((await app.inject({method:'GET',url:'/api/v1/championship-seasons',headers:{authorization:'Bearer invalid'}})).statusCode).toBe(401);
    const list=await app.inject({method:'GET',url:`/api/v1/championship-seasons/${ids.season}`,headers:{authorization:`Bearer ${key}`}});
    expect(list.statusCode).toBe(200);expect(list.headers.etag).toBeTruthy();
    expect(list.json()).toMatchObject({id:ids.season,championship_id:championshipPublicId(ids.championship)});
    const championship=await app.inject({method:'GET',url:`/api/v1/championships/${championshipPublicId(ids.championship)}`,headers:{authorization:`Bearer ${key}`}});
    expect(championship.statusCode).toBe(200);expect(championship.headers.etag).toBeTruthy();expect(championship.json()).toMatchObject({id:championshipPublicId(ids.championship),legacy_id:ids.championship,name:'F57C Championship'});
    const venue=await app.inject({method:'GET',url:`/api/v1/venues/${ids.venue}`,headers:{authorization:`Bearer ${key}`}});
    expect(venue.statusCode).toBe(200);expect(venue.json()).toMatchObject({id:ids.venue,timezone:null});
    const layout=await app.inject({method:'GET',url:`/api/v1/venue-layouts/${ids.layout}`,headers:{authorization:`Bearer ${key}`}});
    expect(layout.statusCode).toBe(200);expect(layout.headers.etag).toBeTruthy();expect(layout.json()).toMatchObject({id:ids.layout,venue_id:ids.venue,name:'Grand Prix'});
    const meeting=await app.inject({method:'GET',url:`/api/v1/meetings/${meetingId}`,headers:{authorization:`Bearer ${key}`}});
    expect(meeting.statusCode).toBe(200);expect(meeting.json()).toMatchObject({id:meetingId,championship_season_id:ids.season,venue_id:ids.venue,venue_layout_id:ids.layout,timezone:null});
    const event=await app.inject({method:'GET',url:`/api/v1/events/${eventId}`,headers:{authorization:`Bearer ${key}`}});
    expect(event.statusCode).toBe(200);expect(event.json()).toMatchObject({id:eventId,meeting_id:meetingId,status:'confirmed',starts_at:'2026-10-01T10:00:00.000Z',ends_at:'2026-10-01T11:30:00.000Z',timezone:null,session:{type_key:'race',title:'F57C Race'}});
    expect((await pool.query('select timezone from meetings where id=$1',[meetingId])).rows[0].timezone).toBeNull();
    expect((await pool.query('select timezone from events where normalized_uuid=$1',[eventId])).rows[0].timezone).toBeNull();
    expect((await pool.query('select timezone from meetings where id=$1',[explicitMeetingId])).rows[0].timezone).toBe('Europe/Paris');
    expect((await pool.query('select timezone from events where normalized_uuid=$1',[explicitEventId])).rows[0].timezone).toBe('Europe/Paris');
    const explicitMeeting=await app.inject({method:'GET',url:`/api/v1/meetings/${explicitMeetingId}`,headers:{authorization:`Bearer ${key}`}});
    expect(explicitMeeting.statusCode).toBe(200);expect(explicitMeeting.json()).toMatchObject({id:explicitMeetingId,timezone:'Europe/Paris'});
    const explicitEvent=await app.inject({method:'GET',url:`/api/v1/events/${explicitEventId}`,headers:{authorization:`Bearer ${key}`}});
    expect(explicitEvent.statusCode).toBe(200);expect(explicitEvent.json()).toMatchObject({id:explicitEventId,meeting_id:explicitMeetingId,timezone:'Europe/Paris'});
    const utcMeetingDb=(await pool.query('select timezone,starts_at,ends_at from meetings where id=$1',[utcMeetingId])).rows[0];
    const utcEventDb=(await pool.query('select timezone,starts_at,ends_at from events where normalized_uuid=$1',[utcEventId])).rows[0];
    expect(utcMeetingDb.timezone).toBe('UTC');expect(utcEventDb.timezone).toBe('UTC');
    expect(utcMeetingDb.starts_at.toISOString()).toBe('2026-10-03T09:00:00.000Z');
    expect(utcMeetingDb.ends_at.toISOString()).toBe('2026-10-03T12:00:00.000Z');
    expect(utcEventDb.starts_at.toISOString()).toBe('2026-10-03T10:00:00.000Z');
    expect(utcEventDb.ends_at.toISOString()).toBe('2026-10-03T11:30:00.000Z');
    const utcMeetingApi=await app.inject({method:'GET',url:`/api/v1/meetings/${utcMeetingId}`,headers:{authorization:`Bearer ${key}`}});
    const utcEventApi=await app.inject({method:'GET',url:`/api/v1/events/${utcEventId}`,headers:{authorization:`Bearer ${key}`}});
    expect(utcMeetingApi.statusCode).toBe(200);expect(utcEventApi.statusCode).toBe(200);
    expect(utcMeetingApi.json()).toMatchObject({timezone:'UTC',starts_at:'2026-10-03T09:00:00.000Z',ends_at:'2026-10-03T12:00:00.000Z'});
    expect(utcEventApi.json()).toMatchObject({timezone:'UTC',starts_at:'2026-10-03T10:00:00.000Z',ends_at:'2026-10-03T11:30:00.000Z'});
    console.info('F57C_EXPLICIT_UTC_EVIDENCE',JSON.stringify({sourceTimezone:'UTC',dbTimezone:utcEventDb.timezone,apiTimezone:utcEventApi.json().timezone,startExpected:'2026-10-03T10:00:00.000Z',startDb:utcEventDb.starts_at.toISOString(),startApi:utcEventApi.json().starts_at,endExpected:'2026-10-03T11:30:00.000Z',endDb:utcEventDb.ends_at.toISOString(),endApi:utcEventApi.json().ends_at}));
    if(!legacyApp)throw new Error('f57c_legacy_http_app_not_ready');
    const legacyId=(await pool.query('select id from events where normalized_uuid=$1 and timezone is null',[eventId])).rows[0]?.id;
    expect(legacyId).toBeTruthy();
    const readSnapshot=async()=>({event:(await pool.query('select id,timezone,updated_at from events where id=$1',[legacyId])).rows[0],meeting:(await pool.query('select id,timezone,updated_at from meetings where id=$1',[meetingId])).rows[0],candidate:(await pool.query('select id,state,updated_at from normalized_candidates where id=$1',[eventCandidateId])).rows[0],state:(await pool.query("select resource_type,resource_id,revision,state_checksum,promoted_at from public_resource_states where resource_type='event' and resource_id=$1",[eventId])).rows[0],versions:(await pool.query("select revision,publication_sequence,state_checksum from public_resource_versions where resource_type='event' and resource_id=$1 order by revision",[eventId])).rows,changes:(await pool.query("select sequence,resource_revision,state_checksum from public_change_log where resource_type='event' and resource_id=$1 order by sequence",[eventId])).rows,receipts:(await pool.query('select candidate_id,resource_revision,change_sequence,outcome from publication_receipts where candidate_id=$1',[eventCandidateId])).rows});
    const legacyBefore=await readSnapshot();
    const legacyResponse=await legacyApp.inject({method:'GET',url:`/api/v1/events/${legacyId}`});
    expect(legacyResponse.statusCode).toBe(200);
    expect(legacyResponse.json().timezone).toBeNull();
    expect(await readSnapshot()).toEqual(legacyBefore);
    console.info('F57C_LEGACY_NULL_READ_EVIDENCE',JSON.stringify({dbBefore:legacyBefore.event.timezone,response:legacyResponse.json().timezone,dbMutation:0,publicationMutation:0}));
    const confirmed=await app.inject({method:'GET',url:'/api/v1/events?status=confirmed&from=2026-09-01T00:00:00.000Z',headers:{authorization:`Bearer ${key}`}});
    expect(confirmed.statusCode).toBe(200);expect(confirmed.json().data.map((row:{id:string})=>row.id)).toContain(eventId);
    const confirmedChanges=await app.inject({method:'GET',url:'/api/v1/changes?limit=100&include=data',headers:{authorization:`Bearer ${key}`}});
    const confirmedChange=confirmedChanges.json().data.find((row:{resource_id:string})=>row.resource_id===eventId);
    expect(confirmedChange).toMatchObject({resource_type:'event',resource_id:eventId,revision:1,operation:'created',current:{id:eventId,meeting_id:meetingId,status:'confirmed',starts_at:'2026-10-01T10:00:00.000Z',ends_at:'2026-10-01T11:30:00.000Z',timezone:null}});
    const denied=await app.inject({method:'GET',url:`/api/v1/championship-seasons/${ids.season}`,headers:{authorization:`Bearer ${deniedKey}`}});
    expect(denied.statusCode).toBe(404);
    for(const headers of [{},{authorization:'Bearer invalid'}]){
      const unauthorized=await app.inject({method:'GET',url:'/api/v1/changes?limit=100',headers});
      expect(unauthorized.statusCode).toBe(401);
      expect(unauthorized.json()).not.toHaveProperty('data');
    }
    const deniedChanges=await app.inject({method:'GET',url:'/api/v1/changes?limit=100',headers:{authorization:`Bearer ${deniedKey}`}});
    expect(deniedChanges.statusCode).toBe(200);
    expect(deniedChanges.json().data.length).toBeGreaterThan(0);
    expect(deniedChanges.json().data.every((change:{resource_type:string})=>['venue','venueLayout'].includes(change.resource_type))).toBe(true);
    const first=await app.inject({method:'GET',url:'/api/v1/changes?limit=2&include=data',headers:{authorization:`Bearer ${key}`}});
    expect(first.statusCode).toBe(200);const page=first.json();expect(page.data).toHaveLength(2);expect(page.pagination.has_more).toBe(true);
    expect(page.data[0].sequence).toBeLessThan(page.data[1].sequence);
    const firstCursor=decodeCursor(page.pagination.next_cursor,'sync',cursorSecret) as SyncCursor;
    expect(firstCursor.role).toBe('continuation');
    if(firstCursor.role!=='continuation')throw new Error('f57c_initial_continuation_missing');
    const initialExpected=(await pool.query(`select c.sequence::int from public_change_log c join public_resource_versions v on v.publication_sequence=c.sequence where c.sequence>0 and c.sequence<=$1 and (v.resource_type in ('venue','venueLayout') or v.championship_id=$2) order by c.sequence`,[firstCursor.snapshotSequence,ids.championship])).rows.map(row=>row.sequence as number);
    await pool.query('update venues set name=$2 where id=$1',[ids.venue,'F57C Venue snapshot mutation']);
    const postBoundary=await catalog.publish({resourceType:'venue',canonicalId:ids.venue,occurredAt:new Date('2026-09-30T12:01:30Z')});
    expect(postBoundary).toMatchObject({outcome:'updated'});
    const postBoundarySequence=Number((await pool.query(`select max(sequence)::int sequence from public_change_log where resource_type='venue' and resource_id=$1`,[ids.venue])).rows[0].sequence);
    expect(postBoundarySequence).toBeGreaterThan(firstCursor.snapshotSequence);
    const originalSnapshot=[...page.data];let continuation=page.pagination.next_cursor,previous=firstCursor.sequence,initialPages=1,initialCheckpoint='';
    while(continuation){
      const response=await app.inject({method:'GET',url:`/api/v1/changes?limit=2&include=data&cursor=${encodeURIComponent(continuation)}`,headers:{authorization:`Bearer ${key}`}});
      expect(response.statusCode).toBe(200);const body=response.json(),decoded=decodeCursor(body.pagination.next_cursor,'sync',cursorSecret) as SyncCursor;
      initialPages++;
      expect(decoded.clientId).toBe(firstCursor.clientId);
      for(const change of body.data){expect(change.sequence).toBeGreaterThan(previous);expect(change.sequence).toBeLessThanOrEqual(firstCursor.snapshotSequence);previous=change.sequence;}
      originalSnapshot.push(...body.data);
      if(body.pagination.has_more){expect(decoded).toMatchObject({role:'continuation',sequence:previous,snapshotSequence:firstCursor.snapshotSequence});continuation=body.pagination.next_cursor;}
      else{expect(decoded).toMatchObject({role:'checkpoint',sequence:firstCursor.snapshotSequence});initialCheckpoint=body.pagination.next_cursor;continuation=null;}
    }
    expect(initialPages).toBeGreaterThanOrEqual(3);
    expect(originalSnapshot.map((change:{sequence:number})=>change.sequence)).toEqual(initialExpected);
    expect(originalSnapshot.some((change:{sequence:number})=>change.sequence===postBoundarySequence)).toBe(false);
    expect(new Set(originalSnapshot.map((change:{sequence:number})=>change.sequence)).size).toBe(originalSnapshot.length);
    expect(new Set(originalSnapshot.map((change:{resource_type:string})=>change.resource_type))).toEqual(new Set(['championship','championshipSeason','venue','venueLayout','meeting','event']));
    const canonicalIds:Record<string,Set<string>>={
      championship:new Set([championshipPublicId(ids.championship)]),
      championshipSeason:new Set([ids.season]),
      venue:new Set([ids.venue]),
      venueLayout:new Set([ids.layout]),
      meeting:new Set([meetingId,explicitMeetingId,utcMeetingId]),
      event:new Set([eventId,explicitEventId,utcEventId])
    };
    for(const change of originalSnapshot as {resource_type:string;resource_id:string}[]){
      expect(canonicalIds[change.resource_type]?.has(change.resource_id)).toBe(true);
    }
    for(const [index,name] of ['F57C Venue incremental 1','F57C Venue incremental 2','F57C Venue incremental 3'].entries()){
      await pool.query('update venues set name=$2 where id=$1',[ids.venue,name]);
      expect(await catalog.publish({resourceType:'venue',canonicalId:ids.venue,occurredAt:new Date(`2026-09-30T12:01:${31+index}Z`)})).toMatchObject({outcome:'updated'});
    }
    const incrementalFirst=await app.inject({method:'GET',url:`/api/v1/changes?limit=1&cursor=${encodeURIComponent(initialCheckpoint)}`,headers:{authorization:`Bearer ${key}`}});
    expect(incrementalFirst.statusCode).toBe(200);
    const incrementalPage=incrementalFirst.json(),incrementalCursor=decodeCursor(incrementalPage.pagination.next_cursor,'sync',cursorSecret) as SyncCursor;
    expect(incrementalPage.pagination.has_more).toBe(true);
    expect(incrementalCursor.role).toBe('continuation');
    if(incrementalCursor.role!=='continuation')throw new Error('f57c_incremental_continuation_missing');
    expect(incrementalCursor.snapshotSequence).toBeGreaterThanOrEqual(postBoundarySequence);
    const incrementalExpected=(await pool.query(`select c.sequence::int from public_change_log c join public_resource_versions v on v.publication_sequence=c.sequence where c.sequence>$1 and c.sequence<=$2 and (v.resource_type in ('venue','venueLayout') or v.championship_id=$3) order by c.sequence`,[firstCursor.snapshotSequence,incrementalCursor.snapshotSequence,ids.championship])).rows.map(row=>row.sequence as number);
    await pool.query('update venues set name=$2 where id=$1',[ids.venue,'F57C Venue after incremental boundary']);
    expect(await catalog.publish({resourceType:'venue',canonicalId:ids.venue,occurredAt:new Date('2026-09-30T12:01:40Z')})).toMatchObject({outcome:'updated'});
    const laterSequence=Number((await pool.query(`select max(sequence)::int sequence from public_change_log where resource_type='venue' and resource_id=$1`,[ids.venue])).rows[0].sequence);
    expect(laterSequence).toBeGreaterThan(incrementalCursor.snapshotSequence);
    const incrementalActual:number[]=incrementalPage.data.map((change:{sequence:number})=>change.sequence);
    let incrementalPages=1,incrementalNext=incrementalPage.pagination.next_cursor,incrementalPrevious=incrementalCursor.sequence,finalCheckpoint='';
    while(incrementalNext){
      const response=await app.inject({method:'GET',url:`/api/v1/changes?limit=1&cursor=${encodeURIComponent(incrementalNext)}`,headers:{authorization:`Bearer ${key}`}});
      expect(response.statusCode).toBe(200);
      const body=response.json(),decoded=decodeCursor(body.pagination.next_cursor,'sync',cursorSecret) as SyncCursor;
      incrementalPages++;
      expect(decoded.clientId).toBe(incrementalCursor.clientId);
      for(const change of body.data){expect(change.sequence).toBeGreaterThan(incrementalPrevious);expect(change.sequence).toBeLessThanOrEqual(incrementalCursor.snapshotSequence);incrementalPrevious=change.sequence;incrementalActual.push(change.sequence);}
      if(body.pagination.has_more){expect(decoded).toMatchObject({role:'continuation',sequence:incrementalPrevious,snapshotSequence:incrementalCursor.snapshotSequence});incrementalNext=body.pagination.next_cursor;}
      else{expect(decoded).toMatchObject({role:'checkpoint',sequence:incrementalCursor.snapshotSequence});finalCheckpoint=body.pagination.next_cursor;incrementalNext=null;}
    }
    expect(incrementalPages).toBeGreaterThanOrEqual(3);
    expect(incrementalActual).toEqual(incrementalExpected);
    expect(incrementalActual).not.toContain(laterSequence);
    expect(new Set(incrementalActual).size).toBe(incrementalActual.length);
    const afterCompletion=await app.inject({method:'GET',url:`/api/v1/changes?limit=100&cursor=${encodeURIComponent(finalCheckpoint)}`,headers:{authorization:`Bearer ${key}`}});
    expect(afterCompletion.statusCode).toBe(200);
    expect(afterCompletion.json().data.map((change:{sequence:number})=>change.sequence)).toContain(laterSequence);
    const afterCompletionCursor=decodeCursor(afterCompletion.json().pagination.next_cursor,'sync',cursorSecret) as SyncCursor;
    expect(afterCompletionCursor).toMatchObject({role:'checkpoint',sequence:laterSequence});
    const venueList=await app.inject({method:'GET',url:'/api/v1/venues',headers:{authorization:`Bearer ${key}`}});
    expect(venueList.statusCode).toBe(200);
    const listCheckpoint=decodeCursor(venueList.json().pagination.sync_cursor,'sync',cursorSecret) as SyncCursor;
    expect(listCheckpoint).toMatchObject({role:'checkpoint',sequence:laterSequence});
    await pool.query('update venues set name=$2 where id=$1',[ids.venue,'F57C Venue after list checkpoint']);
    expect(await catalog.publish({resourceType:'venue',canonicalId:ids.venue,occurredAt:new Date('2026-09-30T12:01:41Z')})).toMatchObject({outcome:'updated'});
    const afterList=await app.inject({method:'GET',url:`/api/v1/changes?cursor=${encodeURIComponent(venueList.json().pagination.sync_cursor)}`,headers:{authorization:`Bearer ${key}`}});
    expect(afterList.statusCode).toBe(200);
    expect(afterList.json().data).toHaveLength(1);
    expect(afterList.json().data[0].sequence).toBeGreaterThan(listCheckpoint.sequence);
    const fresh=await app.inject({method:'GET',url:'/api/v1/changes?limit=100&include=data',headers:{authorization:`Bearer ${key}`}});
    expect(fresh.statusCode).toBe(200);const freshBody=fresh.json(),freshCursor=decodeCursor(freshBody.pagination.next_cursor,'sync',cursorSecret) as SyncCursor;
    expect(freshCursor).toMatchObject({role:'checkpoint'});
    expect(freshCursor.sequence).toBeGreaterThan(firstCursor.snapshotSequence);
    expect(freshBody.data.some((change:{sequence:number})=>change.sequence===postBoundarySequence)).toBe(true);
    console.info('F57C_INCREMENTAL_CURSOR_EVIDENCE',JSON.stringify({completedSyncCheckpointSequence:firstCursor.snapshotSequence,laterChangeSequence:postBoundarySequence,newIncrementalLowerBound:firstCursor.snapshotSequence,newIncrementalSnapshotBoundary:incrementalCursor.snapshotSequence,expectedEligibleSequences:incrementalExpected,actualReturnedSequences:incrementalActual,pageCount:incrementalPages,postBoundarySequence:laterSequence,finalCheckpointSequence:incrementalCursor.snapshotSequence}));
  });

  it('rolls back injected publication failure, converges on retry, and exposes one tombstone',async()=>{
    await pool.query('update venues set name=$2 where id=$1',[ids.venue,'F57C Venue revised']);
    const metrics=async()=>({canonical:(await pool.query('select name from venues where id=$1',[ids.venue])).rows[0].name,state:(await pool.query(`select revision::int,state_checksum from public_resource_states where resource_type='venue' and resource_id=$1`,[ids.venue])).rows[0],versions:Number((await pool.query(`select count(*) from public_resource_versions where resource_type='venue' and resource_id=$1`,[ids.venue])).rows[0].count),changes:Number((await pool.query(`select count(*) from public_change_log where resource_type='venue' and resource_id=$1`,[ids.venue])).rows[0].count),receipts:Number((await pool.query(`select count(*) from publication_receipts where resource_type='venue' and resource_id=$1`,[ids.venue])).rows[0].count)});
    const snapshot=await metrics(),before=snapshot.state.revision;
    await expect(catalog.publish({resourceType:'venue',canonicalId:ids.venue,occurredAt:now,failBeforeCommit:true})).rejects.toThrow('catalog_publication_injected_failure');
    expect(await metrics()).toEqual(snapshot);
    expect(await catalog.publish({resourceType:'venue',canonicalId:ids.venue,occurredAt:new Date('2026-09-30T12:02:00Z')})).toMatchObject({outcome:'updated',revision:before+1});
    const removed=await catalog.remove({resourceType:'venueLayout',resourceId:ids.layout,occurredAt:new Date('2026-09-30T12:03:00Z')});
    expect(removed).toMatchObject({outcome:'removed'});expect(await catalog.remove({resourceType:'venueLayout',resourceId:ids.layout,occurredAt:new Date('2026-09-30T12:04:00Z')})).toMatchObject({outcome:'unchanged'});
    if(!app)throw new Error('f57c_http_app_not_ready');
    const changes=await app.inject({method:'GET',url:'/api/v1/changes?limit=100',headers:{authorization:`Bearer ${key}`}});
    const tombstones=changes.json().data.filter((row:{resource_id:string;operation:string})=>row.resource_id===ids.layout&&row.operation==='removed');
    expect(tombstones).toHaveLength(1);
    const orphans=await pool.query(`select count(*)::int count from public_resource_versions version left join public_change_log change on change.sequence=version.publication_sequence where change.sequence is null`);
    expect(orphans.rows[0].count).toBe(0);
    const dangling=await pool.query(`select
      (select count(*) from championship_seasons season left join championships championship on championship.id=season.championship_id where championship.id is null)::int season,
      (select count(*) from venue_layouts layout left join venues venue on venue.id=layout.venue_id where venue.id is null)::int layout,
      (select count(*) from meetings meeting left join championships championship on championship.id=meeting.championship_id left join championship_seasons season on season.id=meeting.championship_season_id left join venues venue on venue.id=meeting.venue_id left join venue_layouts layout on layout.id=meeting.venue_layout_id where championship.id is null or season.id is null or (meeting.venue_id is not null and venue.id is null) or (meeting.venue_layout_id is not null and layout.id is null))::int meeting,
      (select count(*) from events event left join meeting_events relation on relation.event_id=event.id left join venues venue on venue.id=event.venue_id left join venue_layouts layout on layout.id=event.venue_layout_id where relation.event_id is null or (event.venue_id is not null and venue.id is null) or (event.venue_layout_id is not null and layout.id is null))::int event,
      (select count(*) from public_resource_versions version left join public_resource_states state on state.resource_type=version.resource_type and state.resource_id=version.resource_id where state.resource_id is null)::int public`);
    expect(dangling.rows[0]).toEqual({season:0,layout:0,meeting:0,event:0,public:0});
    const duplicates=await pool.query(`select count(*)::int count from (select normalized_uuid from events where normalized_uuid is not null group by normalized_uuid having count(*)>1) duplicate`);
    expect(duplicates.rows[0].count).toBe(0);
  });

  it('compares an independently successful Meeting publication with a fully rolled-back fault and retry',async()=>{
    const mapping={version:'f57c-v1',rulesVersion:'f57c-r1',championshipIds:{'fixture-championship':ids.championship},circuitIds:{'fixture-circuit':'f57c-circuit'},sessionTypes:{Race:'race' as const},statuses:{Scheduled:'scheduled' as const,Confirmed:'confirmed' as const}};
    const reference=await normalization.normalizeUnit({sourceEntityId:referenceSourceId,scopeKey:'f57c:atomic-reference',expectedFenceGeneration:0,normalizationNow:now,mapping});
    const failing=await normalization.normalizeUnit({sourceEntityId:failureSourceId,scopeKey:'f57c:atomic-failure',expectedFenceGeneration:0,normalizationNow:now,mapping});
    expect(reference.resolution.decision).toBe('create');expect(failing.resolution.decision).toBe('create');
    expect(reference.proposedUuid).not.toBe(failing.proposedUuid);
    const sourceInputs=(await pool.query('select id,source_data from provider_source_entities where id=any($1::uuid[]) order by id',[[referenceSourceId,failureSourceId]])).rows;
    expect(sourceInputs).toHaveLength(2);expect(sourceInputs[0].source_data).toEqual(sourceInputs[1].source_data);
    const normalizedInputs=(await pool.query('select id,candidate_data->\'normalized\' normalized from normalized_candidates where id=any($1::uuid[]) order by id',[[reference.candidateId,failing.candidateId]])).rows;
    expect(normalizedInputs).toHaveLength(2);
    const normalizeSourceIdentity=(value:Record<string,any>)=>({...value,provenance:{...value.provenance,sourceEntityId:'<scenario-source>'}});
    expect(new Set(normalizedInputs.map(row=>row.normalized.provenance.sourceEntityId))).toEqual(new Set([referenceSourceId,failureSourceId]));
    expect(normalizeSourceIdentity(normalizedInputs[0].normalized)).toEqual(normalizeSourceIdentity(normalizedInputs[1].normalized));
    const snapshot=async(candidate:{candidateId:string;proposedUuid:string},sourceId:string)=>{
      const query=async(sql:string,params:unknown[]) => (await pool.query(sql,params)).rows;
      const resource=[candidate.proposedUuid],source=[sourceId],id=[candidate.candidateId];
      return {
        canonical:await query('select id,championship_id,championship_season_id,name,season,round,starts_at,ends_at,timezone,venue_id,venue_layout_id from meetings where id=$1',resource),
        relation:await query('select meeting_id,event_id,position from meeting_events where meeting_id=$1',resource),
        sourceLink:await query('select source_entity_id,meeting_id,normalization_version from meeting_source_links where source_entity_id=$1',source),
        contribution:await query('select source_entity_id,meeting_id,normalized_values,structural_references,source_revision from meeting_source_contributions where source_entity_id=$1',source),
        candidate:await query('select id,state from normalized_candidates where id=$1',id),
        state:await query("select resource_type,resource_id,revision,lifecycle,canonical_state,state_checksum,promoted_candidate_id from public_resource_states where resource_type='meeting' and resource_id=$1",resource),
        versions:await query("select resource_type,resource_id,revision,publication_sequence,operation,lifecycle,canonical_state,state_checksum from public_resource_versions where resource_type='meeting' and resource_id=$1",resource),
        changes:await query("select sequence,resource_type,resource_id,resource_revision,operation,state_checksum from public_change_log where resource_type='meeting' and resource_id=$1",resource),
        receipts:await query('select candidate_id,resource_type,resource_id,effective_checksum,resource_revision,change_sequence,outcome from publication_receipts where candidate_id=$1',id),
        checkpoints:await query('select scope_key,last_candidate_id,revision from publication_rebuild_checkpoints order by scope_key',[]),
        controls:await query('select control_key,enabled,revision from publication_controls order by control_key',[])
      };
    };
    const beforeReference=await snapshot(reference,referenceSourceId),beforeFailure=await snapshot(failing,failureSourceId);
    for(const field of ['canonical','relation','sourceLink','contribution','state','versions','changes','receipts'] as const){expect(beforeReference[field]).toHaveLength(0);expect(beforeFailure[field]).toHaveLength(0);}
    expect(beforeReference.candidate).toMatchObject([{id:reference.candidateId,state:'pending'}]);
    expect(beforeFailure.candidate).toMatchObject([{id:failing.candidateId,state:'pending'}]);
    expect(beforeFailure.checkpoints).toEqual(beforeReference.checkpoints);expect(beforeFailure.controls).toEqual(beforeReference.controls);
    expect(await publication.publishCandidate({candidateId:reference.candidateId,occurredAt:now})).toMatchObject({outcome:'created',revision:1});
    const success=await snapshot(reference,referenceSourceId);
    for(const field of ['canonical','sourceLink','contribution','state','versions','changes','receipts'] as const)expect(success[field]).toHaveLength(1);
    expect(success.relation).toHaveLength(0);expect(success.candidate).toMatchObject([{state:'promoted'}]);
    expect(success.state[0].canonical_state).toMatchObject({name:'F57C Atomic Meeting',timezone:'UTC'});
    expect(success.versions[0].publication_sequence).toBe(success.changes[0].sequence);
    expect(success.receipts[0].change_sequence).toBe(success.changes[0].sequence);
    const beforeInjected=await snapshot(failing,failureSourceId);
    await expect(publication.publishCandidate({candidateId:failing.candidateId,occurredAt:now,failBeforeCommit:true})).rejects.toThrow('publication_injected_failure');
    const afterInjected=await snapshot(failing,failureSourceId);
    expect(afterInjected).toEqual(beforeInjected);
    const orphanCounts=(await pool.query(`select
      (select count(*)::int from public_resource_states s left join public_resource_versions v on v.resource_type=s.resource_type and v.resource_id=s.resource_id and v.revision=s.revision where v.resource_id is null) state,
      (select count(*)::int from public_resource_versions v left join public_resource_states s on s.resource_type=v.resource_type and s.resource_id=v.resource_id where s.resource_id is null) version,
      (select count(*)::int from public_change_log c left join public_resource_versions v on v.publication_sequence=c.sequence where v.publication_sequence is null) change,
      (select count(*)::int from publication_receipts r left join public_resource_states s on s.resource_type=r.resource_type and s.resource_id=r.resource_id where s.resource_id is null) receipt`)).rows[0];
    expect(orphanCounts).toEqual({state:0,version:0,change:0,receipt:0});
    expect(await publication.publishCandidate({candidateId:failing.candidateId,occurredAt:now})).toMatchObject({outcome:'created',revision:1});
    const retry=await snapshot(failing,failureSourceId);
    for(const field of ['canonical','sourceLink','contribution','state','versions','changes','receipts'] as const)expect(retry[field]).toHaveLength(1);
    expect(retry.relation).toHaveLength(0);expect(retry.candidate).toMatchObject([{state:'promoted'}]);
    expect(retry.canonical[0]).toMatchObject({championship_id:success.canonical[0].championship_id,championship_season_id:success.canonical[0].championship_season_id,name:success.canonical[0].name,season:success.canonical[0].season,round:success.canonical[0].round,starts_at:success.canonical[0].starts_at,ends_at:success.canonical[0].ends_at,timezone:success.canonical[0].timezone,venue_id:success.canonical[0].venue_id,venue_layout_id:success.canonical[0].venue_layout_id});
    expect(retry.state[0]).toMatchObject({revision:success.state[0].revision,lifecycle:success.state[0].lifecycle,canonical_state:success.state[0].canonical_state,state_checksum:success.state[0].state_checksum});
    expect(retry.sourceLink[0]).toMatchObject({meeting_id:failing.proposedUuid,normalization_version:success.sourceLink[0].normalization_version});
    expect(normalizeSourceIdentity(retry.contribution[0].normalized_values)).toEqual(normalizeSourceIdentity(success.contribution[0].normalized_values));
    expect(retry.contribution[0]).toMatchObject({structural_references:success.contribution[0].structural_references,source_revision:success.contribution[0].source_revision});
    expect(retry.versions[0]).toMatchObject({revision:success.versions[0].revision,operation:success.versions[0].operation,lifecycle:success.versions[0].lifecycle,canonical_state:success.versions[0].canonical_state,state_checksum:success.versions[0].state_checksum});
    expect(retry.changes[0]).toMatchObject({resource_revision:success.changes[0].resource_revision,operation:success.changes[0].operation,state_checksum:success.changes[0].state_checksum});
    expect(retry.receipts[0]).toMatchObject({effective_checksum:success.receipts[0].effective_checksum,resource_revision:success.receipts[0].resource_revision,outcome:success.receipts[0].outcome});
    expect(retry.versions[0].publication_sequence).toBe(retry.changes[0].sequence);
    expect(retry.receipts[0].change_sequence).toBe(retry.changes[0].sequence);
    console.info('F57C_ATOMICITY_EVIDENCE',JSON.stringify({successReferenceCaptured:true,injection:'publication_injected_failure_after_canonical_and_public_writes',partialCanonical:afterInjected.canonical.length,partialEffective:afterInjected.contribution.length,partialStates:afterInjected.state.length,partialVersions:afterInjected.versions.length,partialChanges:afterInjected.changes.length,partialReceipts:afterInjected.receipts.length,partialCheckpointAdvances:0,orphanCounts,retryEqualsReference:true}));
  });

  it('certifies the publication graph bidirectionally across all six resource types',async()=>{
    const counts=(await pool.query(`select
      (select count(*)::int from public_resource_states s left join public_resource_versions v on v.resource_type=s.resource_type and v.resource_id=s.resource_id and v.revision=s.revision and v.state_checksum=s.state_checksum and v.lifecycle=s.lifecycle where v.resource_id is null) state_without_current_version,
      (select count(*)::int from public_resource_versions v left join public_resource_states s on s.resource_type=v.resource_type and s.resource_id=v.resource_id where v.revision=(select max(v2.revision) from public_resource_versions v2 where v2.resource_type=v.resource_type and v2.resource_id=v.resource_id) and (s.resource_id is null or s.revision<>v.revision or s.state_checksum<>v.state_checksum or s.lifecycle<>v.lifecycle)) current_version_without_state,
      (select count(*)::int from public_resource_versions v left join public_resource_states s on s.resource_type=v.resource_type and s.resource_id=v.resource_id where s.resource_id is null) version_without_state,
      (select count(*)::int from public_change_log c left join public_resource_versions v on v.publication_sequence=c.sequence and v.resource_type=c.resource_type and v.resource_id=c.resource_id and v.revision=c.resource_revision and v.state_checksum=c.state_checksum where v.resource_id is null) change_without_version,
      (select count(*)::int from public_resource_versions v left join public_change_log c on c.sequence=v.publication_sequence and c.resource_type=v.resource_type and c.resource_id=v.resource_id and c.resource_revision=v.revision and c.state_checksum=v.state_checksum where c.sequence is null) version_without_expected_change,
      (select count(*)::int from publication_receipts r left join public_resource_states s on s.resource_type=r.resource_type and s.resource_id=r.resource_id where s.resource_id is null) receipt_without_state,
      (select count(*)::int from publication_receipts r left join public_resource_versions v on v.resource_type=r.resource_type and v.resource_id=r.resource_id and v.revision=r.resource_revision and v.state_checksum=r.effective_checksum where v.resource_id is null) receipt_without_version,
      (select count(*)::int from publication_receipts r left join public_change_log c on c.sequence=r.change_sequence and c.resource_type=r.resource_type and c.resource_id=r.resource_id and c.resource_revision=r.resource_revision where r.change_sequence is not null and c.sequence is null) receipt_without_change,
      (select count(*)::int from public_resource_states s left join publication_receipts r on r.candidate_id=s.promoted_candidate_id and r.resource_type=s.resource_type and r.resource_id=s.resource_id and r.resource_revision=s.revision where s.resource_type in ('meeting','event') and s.promoted_candidate_id is not null and r.candidate_id is null) expected_publication_without_receipt,
      (select count(*)::int from public_resource_states s where s.revision<>(select max(v.revision) from public_resource_versions v where v.resource_type=s.resource_type and v.resource_id=s.resource_id)) invalid_current_pointers,
      (select count(*)::int from (select normalized_uuid from events where normalized_uuid is not null group by normalized_uuid having count(*)>1) d) duplicate_effective_identities,
      (select count(*)::int from public_resource_states s where
        (s.resource_type='championship' and not exists(select 1 from championships c where c.id=s.canonical_state->>'championshipId')) or
        (s.resource_type='championshipSeason' and not exists(select 1 from championship_seasons c where c.id=s.resource_id)) or
        (s.resource_type='venue' and not exists(select 1 from venues c where c.id=s.resource_id)) or
        (s.resource_type='venueLayout' and not exists(select 1 from venue_layouts c where c.id=s.resource_id)) or
        (s.resource_type='meeting' and not exists(select 1 from meetings c where c.id=s.resource_id)) or
        (s.resource_type='event' and not exists(select 1 from events c where c.normalized_uuid=s.resource_id))) dangling_canonical_references,
      (select count(*)::int from public_resource_states s where s.lifecycle='active' and (
        (s.resource_type='championshipSeason' and not exists(select 1 from public_resource_states p where p.resource_type='championship' and p.resource_id=$1)) or
        (s.resource_type='venueLayout' and not exists(select 1 from public_resource_states p where p.resource_type='venue' and p.resource_id=(s.canonical_state->>'venue_id')::uuid)) or
        (s.resource_type='meeting' and (not exists(select 1 from public_resource_states p where p.resource_type='championshipSeason' and p.resource_id=(s.canonical_state->>'championshipSeasonId')::uuid) or not exists(select 1 from public_resource_states p where p.resource_type='venue' and p.resource_id=(s.canonical_state->>'venueId')::uuid))) or
        (s.resource_type='event' and not exists(select 1 from public_resource_states p where p.resource_type='meeting' and p.resource_id=(s.canonical_state->>'meetingId')::uuid)))) dangling_public_references`,[championshipPublicId(ids.championship)])).rows[0];
    expect(counts).toEqual({
      state_without_current_version:0,current_version_without_state:0,version_without_state:0,
      change_without_version:0,version_without_expected_change:0,receipt_without_state:0,
      receipt_without_version:0,receipt_without_change:0,expected_publication_without_receipt:0,
      invalid_current_pointers:0,duplicate_effective_identities:0,
      dangling_canonical_references:0,dangling_public_references:0
    });
    const coverage=(await pool.query(`select resource_type,count(*)::int count,count(*) filter(where lifecycle='removed')::int tombstones from public_resource_states group by resource_type order by resource_type`)).rows;
    expect(coverage.map(row=>row.resource_type)).toEqual(['championship','championshipSeason','event','meeting','venue','venueLayout']);
    expect(coverage.find(row=>row.resource_type==='venueLayout')?.tombstones).toBe(1);
    expect((await pool.query("select count(*)::int count from public_resource_states where resource_type='event' and canonical_state->>'status'='confirmed'")).rows[0].count).toBeGreaterThanOrEqual(1);
    console.info('F57C_PUBLICATION_GRAPH_EVIDENCE',JSON.stringify({counts,coverage}));
  });
});
