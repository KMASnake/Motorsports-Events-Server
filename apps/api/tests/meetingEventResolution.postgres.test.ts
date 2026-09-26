import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {pool} from '../src/lib/db.js';
import {MeetingEventResolutionService} from '../src/normalization/meetingEventResolutionService.js';
import {PostgresPublicationService} from '../src/normalization/postgresPublicationService.js';

const enabled=process.env.RUN_F5_MEETING_EVENT_POSTGRES==='1',suite=enabled?describe:describe.skip;
const service=new MeetingEventResolutionService();
const provider='56000000-0000-4000-8000-000000000001',providerChampionship='56000000-0000-4000-8000-000000000002';
const season='56000000-0000-4000-8000-000000000003',venue='56000000-0000-4000-8000-000000000004';
const canonicalMeeting='56000000-0000-4000-8000-000000000010',secondMeeting='56000000-0000-4000-8000-000000000014',canonicalEvent='56000000-0000-4000-8000-000000000011';
const canonicalEventUuid='56000000-0000-4000-8000-000000000012',parentSource='56000000-0000-4000-8000-000000000013';

async function candidate(suffix:number){
  const source=`56000000-0000-4000-8000-${String(100000000000+suffix).padStart(12,'0')}`;
  const id=`56000000-0000-4000-8001-${String(100000000000+suffix).padStart(12,'0')}`;
  const proposed=`56000000-0000-4000-8002-${String(100000000000+suffix).padStart(12,'0')}`;
  await pool.query(`insert into provider_source_entities(id,provider_instance_id,provider_championship_id,entity_kind,external_id,season,source_data,source_hash,first_observed_at,last_observed_at,last_changed_at)
    values($1,$2,$3,'meeting',$4,2026,$5::jsonb,$6,now(),now(),now())`,[source,provider,providerChampionship,`meeting-${suffix}`,JSON.stringify({name:`Meeting ${suffix}`,external_season_id:'f1-2026'}),`hash-${suffix}`]);
  const normalized={resourceKind:'meeting',name:`Meeting ${suffix}`,sessionType:'other',sessionLabel:null,status:'scheduled',championshipId:'f1',championshipSeasonId:season,circuitId:null,venueId:venue,venueLayoutId:null,season:2026,round:String(suffix),startsAt:`2026-0${Math.min(suffix,9)}-01T10:00:00.000Z`,endsAt:null,timezone:'UTC',presence:'seen'};
  await pool.query(`insert into normalized_candidates(id,source_entity_id,source_hash,normalization_version,resource_kind,candidate_data)
    values($1,$2,$3,'f5-5-test','meeting',$4::jsonb)`,[id,source,`hash-${suffix}`,JSON.stringify({normalized,resolution:{decision:'review',reason:'ambiguous_meeting'},proposed_uuid:proposed,checksum:`checksum-${suffix}`})]);
  await pool.query(`insert into normalization_decisions(id,source_entity_id,candidate_id,candidate_revision,decision,target_kind,target_id,normalization_version,actor_id,reason,idempotency_key,decision_fingerprint)
    values($1,$2,$3,1,'review',null,null,'f5-5-test','deterministic-normalizer','ambiguous_meeting',$4,$5)`,[`56000000-0000-4000-8003-${String(100000000000+suffix).padStart(12,'0')}`,source,id,`review-${suffix}`,'a'.repeat(64)]);
  return {id,proposed};
}
async function eventCandidate(suffix:number,parent=parentSource){
  const source=`56000000-0000-4000-8004-${String(100000000000+suffix).padStart(12,'0')}`;
  const id=`56000000-0000-4000-8005-${String(100000000000+suffix).padStart(12,'0')}`;
  const proposed=`56000000-0000-4000-8006-${String(100000000000+suffix).padStart(12,'0')}`;
  await pool.query(`insert into provider_source_entities(id,provider_instance_id,provider_championship_id,entity_kind,external_id,parent_source_entity_id,season,source_data,source_hash,first_observed_at,last_observed_at,last_changed_at)
    values($1,$2,$3,'event',$4,$5,2026,$6::jsonb,$7,now(),now(),now())`,[source,provider,providerChampionship,`event-${suffix}`,parent,JSON.stringify({name:`Changed Event ${suffix}`,session_type:'practice'}),`event-hash-${suffix}`]);
  const normalized={resourceKind:'event',name:`Changed Event ${suffix}`,sessionType:'practice',sessionLabel:'FP1',status:'scheduled',championshipId:'f1',championshipSeasonId:season,circuitId:null,venueId:venue,venueLayoutId:null,season:2026,round:null,startsAt:`2026-10-${String(Math.min(suffix,28)).padStart(2,'0')}T10:00:00.000Z`,endsAt:null,timezone:'UTC',presence:'seen'};
  await pool.query(`insert into normalized_candidates(id,source_entity_id,source_hash,normalization_version,resource_kind,candidate_data)
    values($1,$2,$3,'f5-5-test','event',$4::jsonb)`,[id,source,`event-hash-${suffix}`,JSON.stringify({normalized,resolution:{decision:'review',reason:'manual_review'},proposed_uuid:proposed,checksum:`event-checksum-${suffix}`})]);
  await pool.query(`insert into normalization_decisions(id,source_entity_id,candidate_id,candidate_revision,decision,target_kind,target_id,normalization_version,actor_id,reason,idempotency_key,decision_fingerprint)
    values($1,$2,$3,1,'review',null,null,'f5-5-test','deterministic-normalizer','manual_review',$4,$5)`,[`56000000-0000-4000-8007-${String(100000000000+suffix).padStart(12,'0')}`,source,id,`event-review-${suffix}`,'b'.repeat(64)]);
  return {id,proposed,source};
}

suite('F5-5 PostgreSQL Meeting/Event decision safety',()=>{
  beforeAll(async()=>{
    await pool.query(`insert into championship_seasons(id,championship_id,key,label,start_year,end_year) values($1,'f1','f5-pg-2026','F5 PG 2026',2026,2026)`,[season]);
    await pool.query(`insert into venues(id,key,name,kind_key) values($1,'f5-pg-venue','F5 PG Venue','rally_location')`,[venue]);
    await pool.query(`insert into provider_instances(id,adapter_key,name,enabled,state) values($1,'f5-meeting-event-test','F5 Meeting Event Test',false,'paused')`,[provider]);
    await pool.query(`insert into provider_championships(id,provider_instance_id,championship_id,external_championship_id,sync_state) values($1,$2,'f1','f5-f1','inactive')`,[providerChampionship,provider]);
    await pool.query(`insert into provider_source_entities(id,provider_instance_id,provider_championship_id,entity_kind,external_id,season,source_data,source_hash,first_observed_at,last_observed_at,last_changed_at)
      values($1,$2,$3,'meeting','parent',2026,'{}','parent-hash',now(),now(),now())`,[parentSource,provider,providerChampionship]);
    await pool.query(`insert into meetings(id,championship_id,championship_season_id,name,season,timezone,venue_id) values($1,'f1',$2,'Original Meeting',2026,'UTC',$3)`,[canonicalMeeting,season,venue]);
    await pool.query(`insert into meetings(id,championship_id,championship_season_id,name,season,timezone,venue_id) values($1,'f1',$2,'Second Meeting',2026,'UTC',$3)`,[secondMeeting,season,venue]);
    await pool.query(`insert into meeting_source_links(source_entity_id,meeting_id,normalization_version) values($1,$2,'f5-5-test')`,[parentSource,canonicalMeeting]);
    await pool.query(`with inserted as (
      insert into events(id,championship_id,name,slug,category,session_type_key,starts_at,timezone,status,published,origin,normalized_uuid,venue_id)
      values($1,'f1','Original Event','f5-original-event','race','race','2026-10-01T10:00:00Z','UTC','scheduled',true,'provider',$2,$3) returning id)
      insert into meeting_events(meeting_id,event_id) select $4,id from inserted`,[canonicalEvent,canonicalEventUuid,venue,canonicalMeeting]);
  });
  afterAll(async()=>{await pool.end();});

  it('resolves once, keeps UUID stable and replays the same idempotency fingerprint',async()=>{
    const item=await candidate(1),input={expectedRevision:1,idempotencyKey:'create-meeting-1',action:'create' as const,reason:'Explicit canonical creation'};
    const first=await service.decide(item.id,input,{actor:'maintainer',requestId:'request-1',occurredAt:new Date('2026-09-26T10:00:00Z')});
    expect(first).toMatchObject({replayed:false,publication:{outcome:'created',revision:1}});
    const replay=await service.decide(item.id,input,{actor:'maintainer',requestId:'request-2',occurredAt:new Date('2026-09-26T10:01:00Z')});
    expect(replay).toMatchObject({replayed:true});
    expect((await pool.query('select id from meetings where id=$1',[item.proposed])).rowCount).toBe(1);
    expect((await pool.query('select count(*) count from public_change_log where resource_id=$1',[item.proposed])).rows[0].count).toBe('1');
  });
  it('rejects same key/different fingerprint, stale revision and terminal mutation',async()=>{
    const item=await candidate(2),base={expectedRevision:1,idempotencyKey:'create-meeting-2',action:'create' as const,reason:'Create'};
    await service.decide(item.id,base,{actor:'maintainer',requestId:'request-3',occurredAt:new Date()});
    await expect(service.decide(item.id,{...base,reason:'Different'}, {actor:'maintainer',requestId:'request-4',occurredAt:new Date()})).rejects.toMatchObject({statusCode:409});
    await expect(service.decide(item.id,{...base,action:'reject',reason:'Reject'}, {actor:'maintainer',requestId:'request-4a',occurredAt:new Date()})).rejects.toMatchObject({statusCode:409});
    await expect(service.decide(item.id,{...base,expectedRevision:2}, {actor:'maintainer',requestId:'request-4b',occurredAt:new Date()})).rejects.toMatchObject({statusCode:409});
    const stale=await candidate(3);
    await expect(service.decide(stale.id,{...base,idempotencyKey:'stale',expectedRevision:2},{actor:'maintainer',requestId:'request-5',occurredAt:new Date()})).rejects.toMatchObject({statusCode:409});
    await expect(service.decide(item.id,{...base,idempotencyKey:'second-decision'},{actor:'maintainer',requestId:'request-6',occurredAt:new Date()})).rejects.toMatchObject({statusCode:409});
  });
  it('serializes concurrent decisions so only one terminal outcome commits',async()=>{
    const item=await candidate(4),context={actor:'maintainer',requestId:'concurrent',occurredAt:new Date()};
    const results=await Promise.allSettled([
      service.decide(item.id,{expectedRevision:1,idempotencyKey:'concurrent-a',action:'create',reason:'Create A'},context),
      service.decide(item.id,{expectedRevision:1,idempotencyKey:'concurrent-b',action:'create',reason:'Create B'},context)
    ]);
    expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
    expect(results.filter(result=>result.status==='rejected')).toHaveLength(1);
    expect((await pool.query("select count(*) count from normalization_decisions where candidate_id=$1 and decision='create'",[item.id])).rows[0].count).toBe('1');
  });
  it('rolls back a terminal decision when an Event parent is unresolved',async()=>{
    const unresolved='56000000-0000-4000-8008-100000000001';
    await pool.query(`insert into provider_source_entities(id,provider_instance_id,provider_championship_id,entity_kind,external_id,season,source_data,source_hash,first_observed_at,last_observed_at,last_changed_at)
      values($1,$2,$3,'meeting','unresolved-parent',2026,'{}','unresolved-parent-hash',now(),now(),now())`,[unresolved,provider,providerChampionship]);
    const item=await eventCandidate(10,unresolved);
    await expect(service.decide(item.id,{expectedRevision:1,idempotencyKey:'unresolved-create',action:'create',reason:'Create after review'},{actor:'maintainer',requestId:'unresolved',occurredAt:new Date()})).rejects.toMatchObject({statusCode:409});
    expect((await pool.query('select resolution_state from normalized_candidates where id=$1',[item.id])).rows[0].resolution_state).toBe('REVIEW_REQUIRED');
    expect((await pool.query("select count(*) count from normalization_decisions where candidate_id=$1 and decision='create'",[item.id])).rows[0].count).toBe('0');
    expect((await pool.query('select count(*) count from events where normalized_uuid=$1',[item.proposed])).rows[0].count).toBe('0');
  });
  it('does not terminalize when the publication kill switch blocks materialization',async()=>{
    const item=await candidate(11);await pool.query("update publication_controls set enabled=false where control_key='promotion'");
    try{await expect(service.decide(item.id,{expectedRevision:1,idempotencyKey:'kill-switch',action:'create',reason:'Blocked'},{actor:'maintainer',requestId:'kill',occurredAt:new Date()})).rejects.toMatchObject({statusCode:409});}
    finally{await pool.query("update publication_controls set enabled=true where control_key='promotion'");}
    expect((await pool.query('select resolution_state from normalized_candidates where id=$1',[item.id])).rows[0].resolution_state).toBe('REVIEW_REQUIRED');
  });
  it('links existing Meeting and Event identities without overwriting canonical fields',async()=>{
    const meetingItem=await candidate(12);await service.decide(meetingItem.id,{expectedRevision:1,idempotencyKey:'link-meeting',action:'link',reason:'Same identity',targetCanonicalId:canonicalMeeting},{actor:'maintainer',requestId:'link-m',occurredAt:new Date()});
    expect((await pool.query('select name from meetings where id=$1',[canonicalMeeting])).rows[0].name).toBe('Original Meeting');
    expect((await pool.query('select count(*) count from public_change_log where resource_id=$1',[canonicalMeeting])).rows[0].count).toBe('0');
    const eventItem=await eventCandidate(13);await service.decide(eventItem.id,{expectedRevision:1,idempotencyKey:'link-event',action:'link',reason:'Same identity',targetCanonicalId:canonicalEventUuid},{actor:'maintainer',requestId:'link-e',occurredAt:new Date()});
    expect((await pool.query('select name from events where id=$1',[canonicalEvent])).rows[0].name).toBe('Original Event');
    expect((await pool.query('select event_id from event_source_links where source_entity_id=$1',[eventItem.source])).rows[0].event_id).toBe(canonicalEvent);
    expect((await pool.query('select count(*) count from public_change_log where resource_id=$1',[canonicalEventUuid])).rows[0].count).toBe('0');
  });
  it('serializes concurrent Event decisions and replays one concurrent idempotency key',async()=>{
    const item=await eventCandidate(14),input={expectedRevision:1,idempotencyKey:'event-create-same',action:'create' as const,reason:'Create event'},context={actor:'maintainer',requestId:'event-concurrent',occurredAt:new Date()};
    const same=await Promise.all([service.decide(item.id,input,context),service.decide(item.id,input,context)]);
    expect(same.filter(result=>result.replayed)).toHaveLength(1);
    expect((await pool.query('select count(*) count from events where normalized_uuid=$1',[item.proposed])).rows[0].count).toBe('1');
    expect((await pool.query('select count(*) count from public_change_log where resource_id=$1',[item.proposed])).rows[0].count).toBe('1');
  });
  it('scopes one idempotency key per candidate and rejects changed canonical fields',async()=>{
    const first=await candidate(15),second=await candidate(16),input={expectedRevision:1,idempotencyKey:'shared-key',action:'create' as const,reason:'Create'},context={actor:'maintainer',requestId:'scope',occurredAt:new Date()};
    await service.decide(first.id,input,context);await service.decide(second.id,input,context);
    await pool.query(`update normalized_candidates set candidate_data=jsonb_set(candidate_data,'{checksum}','"changed-checksum"') where id=$1`,[first.id]);
    await expect(service.decide(first.id,input,{...context,requestId:'changed-fields'})).rejects.toMatchObject({statusCode:409});
  });
  it('rejects reuse of one key with a different canonical target',async()=>{
    const item=await candidate(21),context={actor:'maintainer',requestId:'target-conflict',occurredAt:new Date()},base={expectedRevision:1,idempotencyKey:'target-key',action:'link' as const,reason:'Link',targetCanonicalId:canonicalMeeting};
    await service.decide(item.id,base,context);
    await expect(service.decide(item.id,{...base,targetCanonicalId:secondMeeting},context)).rejects.toMatchObject({statusCode:409});
  });
  it('rolls back canonical writes, source links and decisions after an injected publication failure',async()=>{
    const item=await candidate(17),publication=new PostgresPublicationService();
    const failing=new MeetingEventResolutionService({publishCandidateInTransaction:(client,input)=>publication.publishCandidateInTransaction(client,{...input,failBeforeCommit:true})} as PostgresPublicationService);
    await expect(failing.decide(item.id,{expectedRevision:1,idempotencyKey:'fail-after-write',action:'create',reason:'Inject rollback'},{actor:'maintainer',requestId:'rollback',occurredAt:new Date()})).rejects.toThrow('publication_injected_failure');
    expect((await pool.query('select count(*) count from meetings where id=$1',[item.proposed])).rows[0].count).toBe('0');
    expect((await pool.query("select count(*) count from normalization_decisions where candidate_id=$1 and decision='create'",[item.id])).rows[0].count).toBe('0');
    expect((await pool.query('select resolution_state from normalized_candidates where id=$1',[item.id])).rows[0].resolution_state).toBe('REVIEW_REQUIRED');
  });
  it.each([['meeting',18],['event',19]] as const)('serializes concurrent %s links',async(kind,suffix)=>{
    const item=kind==='meeting'?await candidate(suffix):await eventCandidate(suffix),target=kind==='meeting'?canonicalMeeting:canonicalEventUuid;
    const context={actor:'maintainer',requestId:`${kind}-link-concurrent`,occurredAt:new Date()};
    const results=await Promise.allSettled([
      service.decide(item.id,{expectedRevision:1,idempotencyKey:`${kind}-link-a`,action:'link',reason:'Link A',targetCanonicalId:target},context),
      service.decide(item.id,{expectedRevision:1,idempotencyKey:`${kind}-link-b`,action:'link',reason:'Link B',targetCanonicalId:target},context)
    ]);
    expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);expect(results.filter(result=>result.status==='rejected')).toHaveLength(1);
  });
  it('serializes a concurrent conflicting idempotency key',async()=>{
    const item=await candidate(20),context={actor:'maintainer',requestId:'conflicting-key',occurredAt:new Date()};
    const results=await Promise.allSettled([
      service.decide(item.id,{expectedRevision:1,idempotencyKey:'same-conflicting-key',action:'create',reason:'Create'},context),
      service.decide(item.id,{expectedRevision:1,idempotencyKey:'same-conflicting-key',action:'reject',reason:'Reject'},context)
    ]);
    expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);expect(results.filter(result=>result.status==='rejected')).toHaveLength(1);
  });
});
