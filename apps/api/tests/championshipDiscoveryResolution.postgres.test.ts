import { randomUUID } from 'node:crypto';
import { describe,expect,it } from 'vitest';
import { pool } from '../src/lib/db.js';
import { ChampionshipDiscoveryResolutionService } from '../src/providers/championshipDiscoveryResolutionService.js';

const enabled=process.env.RUN_F5_DISCOVERY_POSTGRES==='1',suite=enabled?describe:describe.skip;
suite('F5-4 PostgreSQL resolution certification',()=>{
  const providerA='35000000-0000-4000-8000-000000000001',providerB='35000000-0000-4000-8000-000000000002';
  const runA='35000000-0000-4000-8000-000000000011',runA2='35000000-0000-4000-8000-000000000012';
  const service=new ChampionshipDiscoveryResolutionService();
  const catalog=(id:string,name=id)=>({catalog:{id,name}});
  const observation=(run=runA)=>({providerInstanceId:providerA,discoveryRunId:run,provenance:'test_fixture' as const,externalChampionshipId:'fixture-formula-one',externalSeasonId:'fixture-2026',championshipName:'Formula One Fixture',seasonLabel:'2026',startYear:2026,endYear:2026,discipline:'single_seater',payload:{championship:{id:'fixture-formula-one',name:'Formula One Fixture'},season:{id:'fixture-2026',label:'2026'}},observedAt:new Date('2026-01-01T00:00:00Z')});

  it('certifies immutable observations, idempotence, decisions, concurrency and isolation',async()=>{
    await pool.query(`insert into provider_instances(id,adapter_key,name,enabled,state,config) values
      ($1,'fixture','F5 fixture A',false,'draft','{}'),($2,'fixture','F5 fixture B',false,'draft','{}')`,[providerA,providerB]);
    await pool.query(`insert into provider_discovery_runs(id,provider_instance_id,origin,status,is_complete) values
      ($1,$3,'manual','completed',true),($2,$3,'manual','completed',true)`,[runA,runA2,providerA]);
    const before=(await pool.query(`select
      (select count(*) from provider_championships)::int provider_championships,
      (select count(*) from sync_streams)::int streams,(select count(*) from sync_runs)::int runs,
      (select count(*) from provider_acquisition_traversals)::int traversals,
      (select count(*) from public_change_log)::int changes,(select count(*) from public_resource_states)::int resources,
      (select count(*) from public_resource_versions)::int versions,
      (select md5(coalesce(string_agg(to_jsonb(state)::text,'|' order by resource_type,resource_id),'')) from public_resource_states state) resource_state_fingerprint,
      (select md5(coalesce(string_agg(to_jsonb(change)::text,'|' order by sequence),'')) from public_change_log change) change_fingerprint,
      (select md5(coalesce(string_agg(to_jsonb(version)::text,'|' order by resource_type,resource_id,revision),'')) from public_resource_versions version) version_fingerprint,
      (select count(*) from provider_instances where enabled)::int enabled`)).rows[0];
    const first=await service.ingestObservation(observation());const replay=await service.ingestObservation(observation());
    expect(replay.observation.id).toBe(first.observation.id);expect(replay.candidate.id).toBe(first.candidate.id);expect(Number(replay.candidate.revision)).toBe(1);expect(replay.candidate.resolution_state).toBe('REVIEW_REQUIRED');
    const secondRun=await service.ingestObservation(observation(runA2));expect(secondRun.observation.id).not.toBe(first.observation.id);expect(secondRun.observation.observation_fingerprint).toBe(first.observation.observation_fingerprint);expect(secondRun.candidate.id).toBe(first.candidate.id);expect(Number(secondRun.candidate.revision)).toBe(1);
    await expect(pool.query('update provider_discovery_observations set raw_championship_name=$2 where id=$1',[first.observation.id,'mutated'])).rejects.toThrow();
    await expect(pool.query('delete from provider_discovery_observations where id=$1',[first.observation.id])).rejects.toThrow();
    await expect(service.ingestObservation({...observation(),externalChampionshipId:'oversized',payload:{championship:{name:'x'.repeat(70000)}}})).rejects.toMatchObject({statusCode:400});
    await expect(service.ingestObservation({...observation(),externalChampionshipId:'sensitive',payload:{api_key:'forbidden'}})).rejects.toThrow(/Sensitive/);
    await expect(service.ingestObservation({...observation(),externalChampionshipId:'event-payload',payload:{events:[{id:'event-1'}]} as never})).rejects.toMatchObject({statusCode:400});
    await expect(service.ingestObservation({...observation(),externalChampionshipId:'unknown-payload',payload:{unknown:{id:'unknown'}} as never})).rejects.toMatchObject({statusCode:400});
    await expect(pool.query(`insert into provider_discovery_observations(
      id,provider_instance_id,provider_discovery_run_id,provenance,external_championship_id,raw_championship_name,
      payload,payload_checksum,observation_fingerprint,observed_at)
      values($1,$2,$3,'untrusted',$4,$5,'{}',$6,$6,now())`,[randomUUID(),providerA,runA,'invalid-provenance','Invalid provenance','0'.repeat(64)])).rejects.toThrow();

    const revisionOne=await service.ingestObservation({...observation(),externalChampionshipId:'revision-source',externalSeasonId:null,championshipName:'Revision source A',payload:catalog('revision-source','Revision source A')});
    const revisionTwo=await service.ingestObservation({...observation(),externalChampionshipId:'revision-source',externalSeasonId:null,championshipName:'Revision source B',payload:catalog('revision-source','Revision source B'),observedAt:new Date('2026-01-02T00:00:00Z')});
    expect(revisionTwo.candidate.id).toBe(revisionOne.candidate.id);expect(Number(revisionTwo.candidate.revision)).toBe(2);

    const atomicCandidate=await service.ingestObservation({...observation(),externalChampionshipId:'atomic-failure',externalSeasonId:null,championshipName:'Atomic failure',payload:catalog('atomic-failure')});
    await expect(service.decide(atomicCandidate.candidate.id,{decision:'create',expectedRevision:1,idempotencyKey:'atomic-failure',championship:{name:'Must roll back',slug:'formula-1'}},{actor:'admin-a',requestId:randomUUID()})).rejects.toThrow();
    expect((await pool.query("select count(*)::int count from championships where name='Must roll back'")).rows[0].count).toBe(0);
    expect((await pool.query('select count(*)::int count from championship_discovery_decisions where candidate_id=$1',[atomicCandidate.candidate.id])).rows[0].count).toBe(0);
    expect((await pool.query("select count(*)::int count from championship_source_links where external_championship_id='atomic-failure'")).rows[0].count).toBe(0);

    const pendingCandidate=await service.ingestObservation({...observation(),externalChampionshipId:'pending-create',externalSeasonId:null,championshipName:'Pending create',payload:catalog('pending-create')});
    await pool.query("update championship_discovery_candidates set resolution_state='PENDING' where id=$1",[pendingCandidate.candidate.id]);
    await expect(service.decide(pendingCandidate.candidate.id,{decision:'create',expectedRevision:1,idempotencyKey:'pending-create',championship:{name:'Pending forbidden',slug:'pending-forbidden'}},{actor:'admin-a',requestId:randomUUID()})).rejects.toMatchObject({statusCode:409});
    expect((await pool.query("select count(*)::int count from championships where name='Pending forbidden'")).rows[0].count).toBe(0);
    expect((await pool.query('select count(*)::int count from championship_discovery_decisions where candidate_id=$1',[pendingCandidate.candidate.id])).rows[0].count).toBe(0);

    const concurrentConflict=await service.ingestObservation({...observation(),externalChampionshipId:'concurrent-conflict',externalSeasonId:null,championshipName:'Concurrent conflict',payload:catalog('concurrent-conflict')});
    const conflicts=await Promise.allSettled([
      service.decide(concurrentConflict.candidate.id,{decision:'reject',expectedRevision:1,idempotencyKey:'same-key',reason:'Reason A'},{actor:'admin-a',requestId:randomUUID()}),
      service.decide(concurrentConflict.candidate.id,{decision:'reject',expectedRevision:1,idempotencyKey:'same-key',reason:'Reason B'},{actor:'admin-a',requestId:randomUUID()})
    ]);
    expect(conflicts.filter(result=>result.status==='fulfilled')).toHaveLength(1);
    const conflictFailure=conflicts.find(result=>result.status==='rejected');
    expect(conflictFailure).toMatchObject({status:'rejected',reason:{statusCode:409}});
    expect((await pool.query('select count(*)::int count from championship_discovery_decisions where candidate_id=$1',[concurrentConflict.candidate.id])).rows[0].count).toBe(1);

    const decisionInput={decision:'create' as const,expectedRevision:1,idempotencyKey:'create-fixture',reason:'Explicit fixture decision',championship:{name:'Formula One Fixture',disciplineKey:'single_seater',season:2026},season:{key:'fixture-2026',label:'2026',startYear:2026,endYear:2026}};
    const [left,right]=await Promise.all([service.decide(first.candidate.id,decisionInput,{actor:'admin-a',requestId:randomUUID()}),service.decide(first.candidate.id,decisionInput,{actor:'admin-a',requestId:randomUUID()})]);
    const created=left.candidate??right.candidate;expect([left.replayed,right.replayed].sort()).toEqual([false,true]);
    const exactReplay=await service.decide(first.candidate.id,decisionInput,{actor:'admin-a',requestId:randomUUID()});
    expect(exactReplay.replayed).toBe(true);expect(exactReplay.decision.id).toBe(left.decision.id);expect(exactReplay.candidate.id).toBe(first.candidate.id);
    expect((await pool.query('select count(*)::int count from championships where id=$1',[created.proposed_championship_id])).rows[0].count).toBe(1);
    expect((await pool.query('select count(*)::int count from championship_seasons where id=$1',[created.proposed_championship_season_id])).rows[0].count).toBe(1);
    expect((await pool.query('select count(*)::int count from championship_discovery_decisions where candidate_id=$1',[first.candidate.id])).rows[0].count).toBe(1);
    for(const conflicting of [
      {...decisionInput,decision:'reject' as const,reason:'Different action'},
      {...decisionInput,reason:'Different reason'},
      {...decisionInput,expectedRevision:2},
      {...decisionInput,championship:{...decisionInput.championship,name:'Different target'}}
    ])await expect(service.decide(first.candidate.id,conflicting,{actor:'admin-a',requestId:randomUUID()})).rejects.toMatchObject({statusCode:409});
    await expect(pool.query('update championship_discovery_decisions set reason=$2 where candidate_id=$1',[first.candidate.id,'mutated'])).rejects.toThrow();
    await expect(service.decide(first.candidate.id,{...decisionInput,idempotencyKey:'stale',expectedRevision:1},{actor:'admin-b',requestId:randomUUID()})).rejects.toMatchObject({statusCode:409});

    await pool.query('update championships set name=$2,slug=$3 where id=$1',[created.proposed_championship_id,'Renamed Formula Fixture','renamed-formula-fixture']);
    await pool.query('update championship_seasons set label=$2 where id=$1',[created.proposed_championship_season_id,'Renamed 2026 season']);
    const linkedReplay=await service.ingestObservation({...observation(runA2),observedAt:new Date('2026-02-01T00:00:00Z')});
    expect(linkedReplay.candidate.proposed_championship_id).toBe(created.proposed_championship_id);expect(linkedReplay.candidate.proposed_championship_season_id).toBe(created.proposed_championship_season_id);expect(linkedReplay.candidate.resolution_state).toBe('RESOLVED_CREATED');

    const manualLink=await service.ingestObservation({...observation(),externalChampionshipId:'manual-link',externalSeasonId:null,championshipName:'Manual link source',payload:catalog('manual-link')});
    const linked=await service.decide(manualLink.candidate.id,{decision:'link',expectedRevision:1,idempotencyKey:'manual-link',reason:'Explicit link',championshipId:'f1'},{actor:'admin-a',requestId:randomUUID()});
    expect(linked.candidate.resolution_state).toBe('RESOLVED_LINKED');expect(linked.candidate.proposed_championship_id).toBe('f1');
    await expect(service.decide(manualLink.candidate.id,{decision:'reject',expectedRevision:2,idempotencyKey:'linked-terminal',reason:'Forbidden terminal transition'},{actor:'admin-a',requestId:randomUUID()})).rejects.toMatchObject({statusCode:409});
    const rejectedInput=await service.ingestObservation({...observation(),externalChampionshipId:'rejected',externalSeasonId:null,championshipName:'Rejected source',payload:catalog('rejected')});
    const rejected=await service.decide(rejectedInput.candidate.id,{decision:'reject',expectedRevision:1,idempotencyKey:'reject',reason:'Not a championship'},{actor:'admin-a',requestId:randomUUID()});
    expect(rejected.candidate.resolution_state).toBe('REJECTED');
    await expect(service.decide(rejectedInput.candidate.id,{decision:'link',expectedRevision:2,idempotencyKey:'rejected-terminal',championshipId:'f1'},{actor:'admin-a',requestId:randomUUID()})).rejects.toMatchObject({statusCode:409});
    await expect(service.decide(first.candidate.id,{decision:'link',expectedRevision:2,idempotencyKey:'created-terminal',championshipId:'f1'},{actor:'admin-a',requestId:randomUUID()})).rejects.toMatchObject({statusCode:409});

    const yearOnly=await service.ingestObservation({...observation(),externalChampionshipId:'year-only',externalSeasonId:'year-only-2026',championshipName:'Formula One Fixture',seasonLabel:null,payload:catalog('year-only'),startYear:2026,endYear:2026});
    expect(yearOnly.candidate.proposed_championship_season_id).toBeNull();expect(yearOnly.candidate.resolution_state).toBe('REVIEW_REQUIRED');

    await pool.query(`insert into championships(id,slug,name,season,active,sync_enabled,discipline_key) values
      ('ambiguous-a','ambiguous-a','Regional Formula',2026,true,false,'single_seater'),
      ('ambiguous-b','ambiguous-b','Regional Formula',2026,true,false,'single_seater'),
      ('wrong-discipline','wrong-discipline','World Challenge',2026,true,false,'rally'),
      ('worldsbk','worldsbk','WorldSBK',2026,true,false,'motorcycle_racing')`);
    const ambiguous=await service.ingestObservation({...observation(),externalChampionshipId:'ambiguous',externalSeasonId:null,championshipName:'Regional Formula',payload:catalog('ambiguous')});
    expect(ambiguous.candidate.proposed_championship_id).toBeNull();expect(ambiguous.candidate.review_reason).toBe('ambiguous_championship');
    const incompatible=await service.ingestObservation({...observation(),externalChampionshipId:'wrong-discipline-source',externalSeasonId:null,championshipName:'World Challenge',payload:catalog('wrong-discipline'),discipline:'single_seater'});
    expect(incompatible.candidate.proposed_championship_id).toBeNull();expect(incompatible.candidate.resolution_state).toBe('REVIEW_REQUIRED');
    const worldSsp=await service.ingestObservation({...observation(),externalChampionshipId:'worldssp-source',externalSeasonId:null,championshipName:'WorldSSP',payload:catalog('worldssp'),discipline:'motorcycle_racing'});
    expect(worldSsp.candidate.proposed_championship_id).toBeNull();expect(worldSsp.candidate.resolution_state).toBe('REVIEW_REQUIRED');

    await pool.query(`insert into championship_seasons(id,championship_id,key,label,start_year,end_year) values
      ('35000000-0000-4000-8000-000000000101','f1','edition-a','2026/27',2026,2027),
      ('35000000-0000-4000-8000-000000000102','f1','edition-b','2026/27',2026,2027)`);
    const ambiguousSeason=await service.ingestObservation({...observation(),externalChampionshipId:'f1-discovery',externalSeasonId:'ambiguous-season',championshipName:'Formule 1',seasonLabel:'2026-2027',startYear:2026,endYear:2027,payload:catalog('ambiguous-season')});
    expect(ambiguousSeason.candidate.proposed_championship_season_id).toBeNull();expect(ambiguousSeason.candidate.resolution_state).toBe('REVIEW_REQUIRED');

    await pool.query(`insert into championship_source_links(id,provider_instance_id,external_championship_id,championship_id,created_by)
      values($1,$2,'same-series',$3,'admin')`,[randomUUID(),providerB,created.proposed_championship_id]);
    expect((await pool.query('select count(*)::int count from championship_source_links where championship_id=$1',[created.proposed_championship_id])).rows[0].count).toBe(2);
    await expect(pool.query(`insert into championship_season_source_links(id,championship_source_link_id,provider_instance_id,external_championship_id,external_season_id,championship_id,championship_season_id,created_by)
      select $1,id,provider_instance_id,external_championship_id,'wrong-season','f1',$2,'admin' from championship_source_links where provider_instance_id=$3`,[randomUUID(),created.proposed_championship_season_id,providerB])).rejects.toThrow();
    const after=(await pool.query(`select
      (select count(*) from provider_championships)::int provider_championships,
      (select count(*) from sync_streams)::int streams,(select count(*) from sync_runs)::int runs,
      (select count(*) from provider_acquisition_traversals)::int traversals,
      (select count(*) from public_change_log)::int changes,(select count(*) from public_resource_states)::int resources,
      (select count(*) from public_resource_versions)::int versions,
      (select md5(coalesce(string_agg(to_jsonb(state)::text,'|' order by resource_type,resource_id),'')) from public_resource_states state) resource_state_fingerprint,
      (select md5(coalesce(string_agg(to_jsonb(change)::text,'|' order by sequence),'')) from public_change_log change) change_fingerprint,
      (select md5(coalesce(string_agg(to_jsonb(version)::text,'|' order by resource_type,resource_id,revision),'')) from public_resource_versions version) version_fingerprint,
      (select count(*) from provider_instances where enabled)::int enabled`)).rows[0];
    expect(after).toEqual(before);
  },30000);
});
