import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {pool} from '../src/lib/db.js';
import {PostgresReconciliationService,StaleReconciliationPreviewError} from '../src/reconciliation/postgresReconciliationService.js';
import {lockEvent} from '../src/lib/eventCorrections.js';
import {reconcileAdministrativePatch,resolveCorrection} from '../src/lib/eventCorrections.js';
import {CanonicalFieldOverrideService,OverrideConflictError} from '../src/reconciliation/canonicalFieldOverrideService.js';
import {withTransaction} from '../src/lib/db.js';
import {PostgresDeterministicNormalizationService} from '../src/normalization/postgresDeterministicNormalizationService.js';
import {PostgresPublicationService} from '../src/normalization/postgresPublicationService.js';
import {SourceProtectionService} from '../src/providers/sourceProtectionService.js';
import {reconcile} from '../src/reconciliation/deterministicReconciliation.js';

const enabled=process.env.RUN_F5_RECONCILIATION_POSTGRES==='1',suite=enabled?describe:describe.skip,service=new PostgresReconciliationService();
const provider='57000000-0000-4000-8000-000000000001',providerChampionship='57000000-0000-4000-8000-000000000002',season='57000000-0000-4000-8000-000000000003',meeting='57000000-0000-4000-8000-000000000004',source='57000000-0000-4000-8000-000000000005',contribution='57000000-0000-4000-8000-000000000006',policy='57000000-0000-4000-8000-000000000007';
const evaluationAt='2026-09-26T12:00:00.000Z';
const eventId='f56-targeted-event',eventUuid='57000000-0000-4000-8000-000000000090';
const proofEventId='f56-service-proof',proofEventUuid='57000000-0000-4000-8000-000000000092',overrideService=new CanonicalFieldOverrideService();
const eventPolicy='57000000-0000-4000-8000-000000000109';
const normalizationService=new PostgresDeterministicNormalizationService(),publicationService=new PostgresPublicationService(),sourceProtectionService=new SourceProtectionService();
const providerB='57000000-0000-4000-8000-000000000101',providerChampionshipB='57000000-0000-4000-8000-000000000102',meetingSourceB='57000000-0000-4000-8000-000000000103';
const eventSourceA='57000000-0000-4000-8000-000000000104',eventSourceB='57000000-0000-4000-8000-000000000105';

suite('F5-6 PostgreSQL exact preview/apply',()=>{
  beforeAll(async()=>{
    await pool.query(`insert into championship_seasons(id,championship_id,key,label,start_year,end_year) values($1,'f1','f56-2026','F5-6 2026',2026,2026)`,[season]);
    await pool.query(`insert into provider_instances(id,adapter_key,name,enabled,state) values($1,'f56-a','F5-6 A',true,'active')`,[provider]);
    await pool.query(`insert into provider_championships(id,provider_instance_id,championship_id,external_championship_id,sync_state,is_primary) values($1,$2,'f1','f56','active',true)`,[providerChampionship,provider]);
    await pool.query(`insert into provider_instances(id,adapter_key,name,enabled,state) values($1,'f56-b','F5-6 B',true,'active')`,[providerB]);
    await pool.query(`insert into provider_championships(id,provider_instance_id,championship_id,external_championship_id,sync_state,is_primary) values($1,$2,'f1','f56-b','paused',false)`,[providerChampionshipB,providerB]);
    await pool.query(`insert into provider_source_entities(id,provider_instance_id,provider_championship_id,entity_kind,external_id,season,source_data,source_hash,first_observed_at,last_observed_at,last_changed_at) values($1,$2,$3,'meeting','meeting',2026,'{}','${'a'.repeat(64)}',$4,$4,$4)`,[source,provider,providerChampionship,evaluationAt]);
    await pool.query(`insert into meetings(id,championship_id,championship_season_id,name,season,timezone) values($1,'f1',$2,'Before',2026,'UTC')`,[meeting,season]);
    await pool.query(`insert into meeting_source_links(source_entity_id,meeting_id,normalization_version) values($1,$2,'f56')`,[source,meeting]);
    await pool.query(`insert into provider_source_entities(id,provider_instance_id,provider_championship_id,entity_kind,external_id,season,source_data,source_hash,first_observed_at,last_observed_at,last_changed_at) values($1,$2,$3,'meeting','meeting-b',2026,'{}','${'1'.repeat(64)}',$4,$4,$4)`,[meetingSourceB,providerB,providerChampionshipB,evaluationAt]);
    await pool.query(`insert into meeting_source_links(source_entity_id,meeting_id,normalization_version) values($1,$2,'f56')`,[meetingSourceB,meeting]);
    await pool.query(`insert into meeting_source_contributions(id,source_entity_id,source_link_id,meeting_id,normalization_version,source_checksum,contribution_checksum,normalized_values,structural_references,observed_at,received_at) values($1,$2,$2,$3,'f56',$4,$5,$6::jsonb,$7::jsonb,$8,$8)`,[contribution,source,meeting,'a'.repeat(64),'b'.repeat(64),JSON.stringify({name:'After'}),JSON.stringify({championshipSeasonId:season}),evaluationAt]);
    await pool.query(`insert into reconciliation_policies(id,championship_id,championship_season_id,resource_kind,version,status,checksum,idempotency_key,request_fingerprint,actor_id,activated_at) values($1,'f1',$2,'meeting',1,'active',$3,'policy',$3,'test',$4)`,[policy,season,'c'.repeat(64),evaluationAt]);
    await pool.query(`insert into reconciliation_policy_field_rules(id,policy_id,field_name,field_class,provider_priority) values('57000000-0000-4000-8000-000000000008',$1,'name','DISPLAY','[["f56-a"]]')`,[policy]);
    await pool.query(`insert into reconciliation_policies(id,championship_id,championship_season_id,resource_kind,version,status,checksum,idempotency_key,request_fingerprint,actor_id,activated_at) values($1,'f1',$2,'event',1,'active',$3,'event-policy',$3,'test',$4)`,[eventPolicy,season,'9'.repeat(64),evaluationAt]);
    await pool.query(`insert into reconciliation_policy_field_rules(id,policy_id,field_name,field_class,provider_priority,stale_after_seconds) values('57000000-0000-4000-8000-000000000110',$1,'name','DISPLAY','[["f56-a"],["f56-b"]]',60)`,[eventPolicy]);
    await pool.query(`insert into events(id,championship_id,name,slug,starts_at,timezone,status,published,origin,provider_key,external_id,session_type_key) values($1,'f1','Provider 19:00','f56-targeted-event','2026-09-26T19:00:00Z','UTC','scheduled',true,'provider','f56-a','targeted','other')`,[eventId]);
    await pool.query(`insert into meeting_events(meeting_id,event_id,position) values($1,$2,0)`,[meeting,eventId]);
    await pool.query(`update events set normalized_uuid=$2 where id=$1`,[eventId,eventUuid]);
    for(const [id,instance,championship,external] of [[eventSourceA,provider,providerChampionship,'event-a'],[eventSourceB,providerB,providerChampionshipB,'event-b']] as const){
      await pool.query(`insert into provider_source_entities(id,provider_instance_id,provider_championship_id,entity_kind,external_id,season,parent_source_entity_id,source_data,source_hash,first_observed_at,last_observed_at,last_changed_at) values($1,$2,$3,'event',$4,2026,$5,'{}',$6,$7,$7,$7)`,[id,instance,championship,external,id===eventSourceA?source:meetingSourceB,id===eventSourceA?'2'.repeat(64):'3'.repeat(64),evaluationAt]);
      await pool.query(`insert into event_source_links(source_entity_id,event_id,normalized_event_uuid,normalization_version) values($1,$2,$3,'f56')`,[id,eventId,eventUuid]);
    }
    await pool.query(`insert into events(id,championship_id,name,slug,starts_at,timezone,status,published,origin,provider_key,external_id,session_type_key) values($1,'f1','Provider','f56-service-proof','2026-09-26T20:00:00Z','UTC','scheduled',true,'provider','f56-a','service-proof','other')`,[proofEventId]);
    await pool.query(`insert into meeting_events(meeting_id,event_id,position) values($1,$2,1)`,[meeting,proofEventId]);
    await pool.query(`update events set normalized_uuid=$2 where id=$1`,[proofEventId,proofEventUuid]);
  });
  afterAll(async()=>pool.end());

  it('F7 bridges an imported legacy correction without writing legacy storage',async()=>{
    const legacyBefore=Number((await pool.query(`select count(*) count from event_corrections where id='legacy-active'`)).rows[0].count);
    const imported=(await pool.query(`select * from canonical_field_overrides where legacy_event_correction_id='legacy-active'`)).rows[0];
    expect(imported).toMatchObject({canonical_record_id:'f56-legacy-active',status:'active',legacy_status:'active'});
    await withTransaction(async client=>{const current=await lockEvent(client,'f56-legacy-active');await reconcileAdministrativePatch(client,current!,{name:'Bridge Replace'},'legacy-admin');});
    const replaced=(await pool.query('select * from canonical_field_overrides where id=$1',[imported.id])).rows[0];expect(replaced.override_value).toBe('Bridge Replace');expect(Number(replaced.revision)).toBe(2);
    await withTransaction(client=>resolveCorrection(client,'legacy-active','accept-provider'));
    const revoked=(await pool.query('select status,revision from canonical_field_overrides where id=$1',[imported.id])).rows[0];expect(revoked.status).toBe('revoked');expect(Number(revoked.revision)).toBe(3);
    expect(Number((await pool.query(`select count(*) count from event_corrections where id='legacy-active'`)).rows[0].count)).toBe(legacyBefore);
    expect(Number((await pool.query('select count(*) count from canonical_field_override_history where override_id=$1',[imported.id])).rows[0].count)).toBe(3);
  });

  it('F8 resolves a legacy conflict even when the override value is unchanged',async()=>{
    const imported=(await pool.query(`select * from canonical_field_overrides where legacy_event_correction_id='legacy-conflict'`)).rows[0];
    expect(imported.legacy_status).toBe('conflict');expect(Number(imported.revision)).toBe(1);
    const result=await withTransaction(client=>resolveCorrection(client,'legacy-conflict','keep-override'));
    expect(result.correction?.legacy_status).toBe('active');expect(Number(result.correction?.revision)).toBe(2);
    const resolved=(await pool.query('select legacy_status,revision from canonical_field_overrides where id=$1',[imported.id])).rows[0];expect(resolved.legacy_status).toBe('active');expect(Number(resolved.revision)).toBe(2);
    expect(Number((await pool.query('select count(*) count from canonical_field_override_history where override_id=$1',[imported.id])).rows[0].count)).toBe(2);
  });

  it('A1-A3 persist concurrent contributions idempotently and reconcile independently of commit order',async()=>{
    const canonicalBefore=(await pool.query('select name from meetings where id=$1',[meeting])).rows[0].name;
    const revisionBefore=Number((await pool.query(`select coalesce(max(revision),0) revision from public_resource_states where resource_type='meeting' and resource_id=$1`,[meeting])).rows[0].revision);
    const changesBefore=Number((await pool.query(`select count(*) count from public_change_log where resource_type='meeting' and resource_id=$1`,[meeting])).rows[0].count);
    const insertMeeting=`insert into meeting_source_contributions(id,source_entity_id,source_link_id,meeting_id,normalization_version,source_checksum,contribution_checksum,normalized_values,structural_references,observed_at,received_at,source_revision) values($1,$2,$2,$3,'f56',$4,$5,$6::jsonb,'{}',$7,$7,$8) on conflict(source_entity_id,contribution_checksum) do nothing`;
    const first=await pool.connect(),second=await pool.connect();
    try{
      await first.query('begin');await second.query('begin');
      const checksum='4'.repeat(64),aId='57000000-0000-4000-8000-000000000106',bId='57000000-0000-4000-8000-000000000107';
      expect((await first.query(insertMeeting,[aId,meetingSourceB,meeting,'1'.repeat(64),checksum,JSON.stringify({name:'Replay'}),evaluationAt,1])).rowCount).toBe(1);
      let settled=false;const blocked=second.query(insertMeeting,[bId,meetingSourceB,meeting,'1'.repeat(64),checksum,JSON.stringify({name:'Replay'}),evaluationAt,1]).then(result=>{settled=true;return result;});
      await new Promise(resolve=>setTimeout(resolve,100));expect(settled).toBe(false);
      await first.query('commit');expect((await blocked).rowCount).toBe(0);await second.query('commit');
      expect(Number((await pool.query('select count(*) count from meeting_source_contributions where source_entity_id=$1 and contribution_checksum=$2',[meetingSourceB,checksum])).rows[0].count)).toBe(1);
    }finally{await first.query('rollback');await second.query('rollback');first.release();second.release();}

    const persistPair=async(kind:'meeting'|'event',reverse:boolean,ids:[string,string],checksums:[string,string],sourceRevision:number)=>{
      const one=await pool.connect(),two=await pool.connect();
      try{await one.query('begin');await two.query('begin');
        if(kind==='meeting'){
          await one.query(insertMeeting,[ids[0],source,meeting,'5'.repeat(64),checksums[0],JSON.stringify({name:'Provider A'}),evaluationAt,sourceRevision]);
          await two.query(insertMeeting,[ids[1],meetingSourceB,meeting,'6'.repeat(64),checksums[1],JSON.stringify({name:'Provider B'}),evaluationAt,sourceRevision]);
        }else{
          const sql=`insert into event_source_contributions(id,source_entity_id,source_link_id,event_uuid,event_id,meeting_id,normalization_version,source_checksum,contribution_checksum,normalized_values,structural_references,observed_at,received_at,source_revision) values($1,$2,$2,$3,$4,$5,'f56',$6,$7,$8::jsonb,$9::jsonb,$10,$10,$11)`;
          await one.query(sql,[ids[0],eventSourceA,eventUuid,eventId,meeting,'7'.repeat(64),checksums[0],JSON.stringify({name:'Event A'}),JSON.stringify({meetingId:meeting,championshipSeasonId:season}),evaluationAt,sourceRevision]);
          await two.query(sql,[ids[1],eventSourceB,eventUuid,eventId,meeting,'8'.repeat(64),checksums[1],JSON.stringify({name:'Event B'}),JSON.stringify({meetingId:meeting,championshipSeasonId:season}),evaluationAt,sourceRevision]);
        }
        if(reverse){await two.query('commit');await one.query('commit');}else{await one.query('commit');await two.query('commit');}
      }finally{await one.query('rollback');await two.query('rollback');one.release();two.release();}
    };
    const meetingIds:[string,string]=[randomUUID(),randomUUID()],meetingChecksums:[string,string]=['a1'.padEnd(64,'a'),'b1'.padEnd(64,'b')];
    await persistPair('meeting',false,meetingIds,meetingChecksums,2);
    const meetingForward=await service.preview({entityKind:'meeting',entityUuid:meeting,policyId:policy,evaluationAt});
    await pool.query('update meeting_source_contributions set withdrawn_at=$2 where id=any($1::uuid[])',[meetingIds,evaluationAt]);
    const reverseMeetingIds:[string,string]=[randomUUID(),randomUUID()],reverseMeetingChecksums:[string,string]=['a2'.padEnd(64,'a'),'b2'.padEnd(64,'b')];
    await persistPair('meeting',true,reverseMeetingIds,reverseMeetingChecksums,3);
    const meetingReverse=await service.preview({entityKind:'meeting',entityUuid:meeting,policyId:policy,evaluationAt});
    expect(meetingReverse.result.effectiveState.name).toBe(meetingForward.result.effectiveState.name);
    expect(meetingReverse.result.decisions.find(item=>item.field==='name')?.outcome).toBe(meetingForward.result.decisions.find(item=>item.field==='name')?.outcome);
    expect(Number((await pool.query('select count(*) count from meeting_source_contributions where id=any($1::uuid[])',[meetingIds])).rows[0].count)).toBe(2);
    const meetingWinner=meetingReverse.result.decisions.find(item=>item.field==='name')?.winnerContributionId;
    expect((await pool.query(`select instance.adapter_key from meeting_source_contributions contribution join provider_source_entities source on source.id=contribution.source_entity_id join provider_instances instance on instance.id=source.provider_instance_id where contribution.id=$1`,[meetingWinner])).rows[0].adapter_key).toBe('f56-a');
    expect((await pool.query('select name from meetings where id=$1',[meeting])).rows[0].name).toBe(canonicalBefore);
    expect(Number((await pool.query(`select coalesce(max(revision),0) revision from public_resource_states where resource_type='meeting' and resource_id=$1`,[meeting])).rows[0].revision)).toBe(revisionBefore);
    expect(Number((await pool.query(`select count(*) count from public_change_log where resource_type='meeting' and resource_id=$1`,[meeting])).rows[0].count)).toBe(changesBefore);
    const eventIds:[string,string]=[randomUUID(),randomUUID()],eventChecksums:[string,string]=['c1'.padEnd(64,'c'),'d1'.padEnd(64,'d')];
    await persistPair('event',false,eventIds,eventChecksums,1);const eventForward=await service.preview({entityKind:'event',entityUuid:eventUuid,policyId:eventPolicy,evaluationAt});
    await pool.query('update event_source_contributions set withdrawn_at=$2 where id=any($1::uuid[])',[eventIds,evaluationAt]);
    const reverseEventIds:[string,string]=[randomUUID(),randomUUID()],reverseEventChecksums:[string,string]=['c2'.padEnd(64,'c'),'d2'.padEnd(64,'d')];
    await persistPair('event',true,reverseEventIds,reverseEventChecksums,2);const eventReverse=await service.preview({entityKind:'event',entityUuid:eventUuid,policyId:eventPolicy,evaluationAt});
    expect(eventReverse.result.effectiveChecksum).toBe(eventForward.result.effectiveChecksum);
    expect(eventReverse.result.effectiveState.name).toBe(eventForward.result.effectiveState.name);
    expect(Number((await pool.query('select count(*) count from event_source_contributions where id=any($1::uuid[])',[eventIds])).rows[0].count)).toBe(2);
    expect((await pool.query('select normalized_uuid from events where id=$1',[eventId])).rows[0].normalized_uuid).toBe(eventUuid);
    expect((await pool.query('select meeting_id from meeting_events where event_id=$1',[eventId])).rows[0].meeting_id).toBe(meeting);
    expect((await pool.query('select championship_id,championship_season_id from meetings where id=$1',[meeting])).rows[0]).toMatchObject({championship_id:'f1',championship_season_id:season});
    await pool.query('update meeting_source_contributions set withdrawn_at=$2 where id=any($1::uuid[]) or id=any($3::uuid[])',[reverseMeetingIds,evaluationAt,meetingIds]);
    await pool.query(`update meeting_source_contributions set withdrawn_at=$3 where source_entity_id=$1 and contribution_checksum=$2`,[meetingSourceB,'4'.repeat(64),evaluationAt]);
    await pool.query('update event_source_contributions set withdrawn_at=$2 where id=any($1::uuid[]) or id=any($3::uuid[])',[reverseEventIds,evaluationAt,eventIds]);
    await pool.query(insertMeeting,[randomUUID(),source,meeting,'a'.repeat(64),'af'.padEnd(64,'f'),JSON.stringify({name:'After'}),evaluationAt,4]);
  });

  it('C1-C5 serialize APPLY against replay, contributions, policies and overrides',async()=>{
    const cMeeting=randomUUID(),cSource=randomUUID(),cPolicy=randomUUID(),cContribution=randomUUID();
    await pool.query(`insert into provider_source_entities(id,provider_instance_id,provider_championship_id,entity_kind,external_id,season,source_data,source_hash,first_observed_at,last_observed_at,last_changed_at) values($1,$2,$3,'meeting',$4,2026,'{}',$5,$6,$6,$6)`,[cSource,provider,providerChampionship,`c-${cSource}`,'a'.repeat(64),evaluationAt]);
    await pool.query(`insert into meetings(id,championship_id,championship_season_id,name,season,timezone) values($1,'f1',$2,'C Before',2026,'UTC')`,[cMeeting,season]);
    await pool.query(`insert into meeting_source_links(source_entity_id,meeting_id,normalization_version) values($1,$2,'f56')`,[cSource,cMeeting]);
    await pool.query(`insert into meeting_source_contributions(id,source_entity_id,source_link_id,meeting_id,normalization_version,source_checksum,contribution_checksum,normalized_values,structural_references,observed_at,received_at) values($1,$2,$2,$3,'f56',$4,$5,'{"name":"C One"}','{}',$6,$6)`,[cContribution,cSource,cMeeting,'a'.repeat(64),'b'.repeat(64),evaluationAt]);
    await pool.query(`insert into reconciliation_policies(id,championship_id,championship_season_id,resource_kind,version,status,checksum,idempotency_key,request_fingerprint,actor_id,activated_at) values($1,'f1',null,'meeting',1,'active',$2,$3,$2,'test',$4)`,[cPolicy,'c'.repeat(64),`c-${cPolicy}`,evaluationAt]);
    await pool.query(`insert into reconciliation_policy_field_rules(id,policy_id,field_name,field_class,provider_priority) values($1,$2,'name','DISPLAY','[["f56-a"]]')`,[randomUUID(),cPolicy]);
    const request=(preview:any,key:string)=>({entityKind:'meeting' as const,entityUuid:cMeeting,policyId:cPolicy,evaluationAt,previewChecksum:preview.previewChecksum,idempotencyKey:key,actorId:'test'});
    const concurrentApply=async(preview:any,key:string)=>{const one=await pool.connect(),two=await pool.connect();try{await one.query('begin');await two.query('begin');const first=await (service as any).applyInTransaction(one,request(preview,key));let settled=false;const second=(service as any).applyInTransaction(two,request(preview,key)).then((value:any)=>{settled=true;return value;});await new Promise(resolve=>setTimeout(resolve,75));expect(settled).toBe(false);await one.query('commit');const replay=await second;await two.query('commit');return [first,replay];}finally{await one.query('rollback');await two.query('rollback');one.release();two.release();}};
    const beforeRevision=Number((await pool.query(`select coalesce(max(revision),0) value from public_resource_states where resource_id=$1`,[cMeeting])).rows[0].value),beforeChanges=Number((await pool.query('select count(*) value from public_change_log where resource_id=$1',[cMeeting])).rows[0].value);
    const c1Preview=await service.preview({entityKind:'meeting',entityUuid:cMeeting,policyId:cPolicy,evaluationAt}),c1=await concurrentApply(c1Preview,'c1');expect(c1.map((item:any)=>item.replay).sort()).toEqual([false,true]);expect(Number((await pool.query(`select max(revision) value from public_resource_states where resource_id=$1`,[cMeeting])).rows[0].value)-beforeRevision).toBeLessThanOrEqual(1);expect(Number((await pool.query('select count(*) value from public_change_log where resource_id=$1',[cMeeting])).rows[0].value)-beforeChanges).toBeLessThanOrEqual(1);

    const c2Preview=await service.preview({entityKind:'meeting',entityUuid:cMeeting,policyId:cPolicy,evaluationAt}),applyClient=await pool.connect(),contributionClient=await pool.connect(),newContribution=randomUUID();
    try{await applyClient.query('begin');await contributionClient.query('begin');const applied=await (service as any).applyInTransaction(applyClient,request(c2Preview,'c2'));let contributionSettled=false;const persisted=contributionClient.query(`insert into meeting_source_contributions(id,source_entity_id,source_link_id,meeting_id,normalization_version,source_checksum,contribution_checksum,normalized_values,structural_references,observed_at,received_at,source_revision) values($1,$2,$2,$3,'f56',$4,$5,'{"name":"C Two"}','{}',$6,$6,2)`,[newContribution,cSource,cMeeting,'d'.repeat(64),'e'.repeat(64),'2026-09-26T12:01:00Z']).then(value=>{contributionSettled=true;return value;});await new Promise(resolve=>setTimeout(resolve,75));expect(contributionSettled).toBe(false);await applyClient.query('commit');await persisted;await contributionClient.query('commit');expect(['applied','no_op']).toContain(applied.outcome);expect((await service.preview({entityKind:'meeting',entityUuid:cMeeting,policyId:cPolicy,evaluationAt})).result.effectiveState.name).toBe('C Two');}finally{await applyClient.query('rollback');await contributionClient.query('rollback');applyClient.release();contributionClient.release();}

    const c4Preview=await service.preview({entityKind:'meeting',entityUuid:cMeeting,policyId:cPolicy,evaluationAt}),c4Apply=await pool.connect(),c4Override=await pool.connect();let c4Settled=false;
    try{await c4Apply.query('begin');await c4Override.query('begin');await (service as any).applyInTransaction(c4Apply,request(c4Preview,'c4'));const setting=overrideService.setInTransaction(c4Override,{entityKind:'meeting',entityUuid:cMeeting,canonicalRecordId:cMeeting,fieldName:'name',value:'C Admin',actorId:'admin',reason:'C4',expectedRevision:0,idempotencyKey:'c4-set'}).then(value=>{c4Settled=true;return value;});await new Promise(resolve=>setTimeout(resolve,75));expect(c4Settled).toBe(false);await c4Apply.query('commit');const set=await setting;await c4Override.query('commit');expect(set.override.override_value).toBe('C Admin');}finally{await c4Apply.query('rollback');await c4Override.query('rollback');c4Apply.release();c4Override.release();}
    const active=(await pool.query(`select * from canonical_field_overrides where entity_uuid=$1 and field_name='name' and status='active'`,[cMeeting])).rows[0],c5Preview=await service.preview({entityKind:'meeting',entityUuid:cMeeting,policyId:cPolicy,evaluationAt}),c5Apply=await pool.connect(),c5Revoke=await pool.connect();let c5Settled=false;
    try{await c5Apply.query('begin');await c5Revoke.query('begin');await (service as any).applyInTransaction(c5Apply,request(c5Preview,'c5'));const revoking=overrideService.revokeInTransaction(c5Revoke,{entityKind:'meeting',entityUuid:cMeeting,overrideId:String(active.id),actorId:'admin',reason:'C5',expectedRevision:Number(active.revision),idempotencyKey:'c5-revoke'}).then(value=>{c5Settled=true;return value;});await new Promise(resolve=>setTimeout(resolve,75));expect(c5Settled).toBe(false);await c5Apply.query('commit');await revoking;await c5Revoke.query('commit');expect((await pool.query('select status from canonical_field_overrides where id=$1',[active.id])).rows[0].status).toBe('revoked');}finally{await c5Apply.query('rollback');await c5Revoke.query('rollback');c5Apply.release();c5Revoke.release();}

    const p2=randomUUID(),c3Preview=await service.preview({entityKind:'meeting',entityUuid:cMeeting,policyId:cPolicy,evaluationAt}),c3Apply=await pool.connect(),c3Policy=await pool.connect();
    await pool.query(`insert into reconciliation_policies(id,championship_id,championship_season_id,resource_kind,version,status,checksum,idempotency_key,request_fingerprint,actor_id) values($1,'f1',null,'meeting',2,'draft',$2,$3,$2,'test')`,[p2,'f'.repeat(64),`c3-${p2}`]);await pool.query(`insert into reconciliation_policy_field_rules(id,policy_id,field_name,field_class,provider_priority) values($1,$2,'name','DISPLAY','[["f56-b"],["f56-a"]]')`,[randomUUID(),p2]);
    try{await c3Apply.query('begin');await c3Policy.query('begin');const applied=await (service as any).applyInTransaction(c3Apply,request(c3Preview,'c3'));let policySettled=false;const activation=(async()=>{await c3Policy.query(`update reconciliation_policies set status='retired',retired_at=now() where id=$1`,[cPolicy]);await c3Policy.query(`update reconciliation_policies set status='active',activated_at=now() where id=$1`,[p2]);policySettled=true;})();await new Promise(resolve=>setTimeout(resolve,75));expect(policySettled).toBe(false);await c3Apply.query('commit');await activation;await c3Policy.query('commit');expect(['applied','no_op']).toContain(applied.outcome);expect((await pool.query(`select id from reconciliation_policies where status='active' and championship_id='f1' and championship_season_id is null and resource_kind='meeting'`)).rows[0].id).toBe(p2);}finally{await c3Apply.query('rollback');await c3Policy.query('rollback');c3Apply.release();c3Policy.release();}
  },20000);

  it('D1-D6 serialize all override transitions through the shared service',async()=>{
    const entityUuid=randomUUID(),recordId=entityUuid;
    await pool.query(`insert into meetings(id,championship_id,championship_season_id,name,season,timezone) values($1,'f1',$2,'D override target',2026,'UTC')`,[entityUuid,season]);
    const connections=async<T>(first:(client:any)=>Promise<T>,second:(client:any)=>Promise<unknown>)=>{const one=await pool.connect(),two=await pool.connect();try{await one.query('begin');await two.query('begin');const winner=await first(one);let settled=false;const competing=second(two).then(value=>{settled=true;return value;},error=>{settled=true;throw error;});await new Promise(resolve=>setTimeout(resolve,75));expect(settled).toBe(false);await one.query('commit');let loser:unknown;try{loser=await competing;await two.query('commit');}catch(error){loser=error;await two.query('rollback');}return {winner,loser};}finally{await one.query('rollback');await two.query('rollback');one.release();two.release();}};
    const command=(value:string,key:string,revision=0)=>({entityKind:'meeting' as const,entityUuid,canonicalRecordId:recordId,fieldName:'name',value,actorId:'admin',reason:key,expectedRevision:revision,idempotencyKey:key});
    const d1=await connections(client=>overrideService.setInTransaction(client,command('D1 A','d1-a')),client=>overrideService.setInTransaction(client,command('D1 B','d1-b')));expect(d1.loser).toBeInstanceOf(OverrideConflictError);let active=(await pool.query(`select * from canonical_field_overrides where entity_uuid=$1 and status='active'`,[entityUuid])).rows[0];expect(active.override_value).toBe('D1 A');expect(Number((await pool.query('select count(*) value from canonical_field_override_history where override_id=$1',[active.id])).rows[0].value)).toBe(1);
    const d2=await connections(client=>overrideService.revokeInTransaction(client,{entityKind:'meeting',entityUuid,overrideId:String(active.id),actorId:'admin',reason:'D2',expectedRevision:1,idempotencyKey:'d2'}),client=>overrideService.revokeInTransaction(client,{entityKind:'meeting',entityUuid,overrideId:String(active.id),actorId:'admin',reason:'D2',expectedRevision:1,idempotencyKey:'d2'}));expect((d2.loser as any).replay).toBe(true);expect(Number((await pool.query(`select count(*) value from canonical_field_override_history where override_id=$1 and operation='revoked'`,[active.id])).rows[0].value)).toBe(1);
    active=(await overrideService.set(command('D3 Base','d3-base'))).override;const d3=await connections(client=>overrideService.setInTransaction(client,command('D3 Replace','d3-set',1)),client=>overrideService.revokeInTransaction(client,{entityKind:'meeting',entityUuid,overrideId:String(active.id),actorId:'admin',reason:'D3 revoke',expectedRevision:1,idempotencyKey:'d3-revoke'}));expect(d3.loser).toBeInstanceOf(OverrideConflictError);expect((await pool.query('select status,override_value from canonical_field_overrides where id=$1',[active.id])).rows[0]).toMatchObject({status:'active',override_value:'D3 Replace'});
    await overrideService.revoke({entityKind:'meeting',entityUuid,overrideId:String(active.id),actorId:'admin',reason:'D4 prep',expectedRevision:2,idempotencyKey:'d4-prep'});
    const d4=await connections(client=>overrideService.setInTransaction(client,command('D4','d4-same')),client=>overrideService.setInTransaction(client,command('D4','d4-same')));expect((d4.loser as any).replay).toBe(true);active=(d4.winner as any).override;expect(Number((await pool.query('select count(*) value from canonical_field_override_history where override_id=$1',[active.id])).rows[0].value)).toBe(1);
    await overrideService.revoke({entityKind:'meeting',entityUuid,overrideId:String(active.id),actorId:'admin',reason:'D5 prep',expectedRevision:1,idempotencyKey:'d5-prep'});
    const d5=await connections(client=>overrideService.setInTransaction(client,command('D5 A','d5-key')),client=>overrideService.setInTransaction(client,command('D5 B','d5-key')));expect(d5.loser).toBeInstanceOf(OverrideConflictError);active=(d5.winner as any).override;const historyBefore=Number((await pool.query('select count(*) value from canonical_field_override_history where override_id=$1',[active.id])).rows[0].value);
    const revisionBefore=Number((await pool.query('select coalesce(sum(revision),0) value from public_resource_states')).rows[0].value),changesBefore=Number((await pool.query('select count(*) value from public_change_log')).rows[0].value);
    await expect(overrideService.set(command('D6 stale','d6-stale',0))).rejects.toBeInstanceOf(OverrideConflictError);expect(Number((await pool.query('select count(*) value from canonical_field_override_history where override_id=$1',[active.id])).rows[0].value)).toBe(historyBefore);expect(Number((await pool.query('select coalesce(sum(revision),0) value from public_resource_states')).rows[0].value)).toBe(revisionBefore);expect(Number((await pool.query('select count(*) value from public_change_log')).rows[0].value)).toBe(changesBefore);
  });

  it('E1-E6 atomically bind materialization, evidence and publication',async()=>{
    const eSeason=randomUUID(),eProviderChampA=randomUUID(),eProviderChampB=randomUUID(),ePolicy=randomUUID();
    await pool.query(`insert into championship_seasons(id,championship_id,key,label,start_year,end_year) values($1,'motogp',$2,'F5-6 E 2026',2026,2026)`,[eSeason,`e-${eSeason}`]);
    await pool.query(`insert into provider_championships(id,provider_instance_id,championship_id,external_championship_id,sync_state,is_primary) values($1,$2,'motogp',$3,'active',true)`,[eProviderChampA,provider,`e-a-${eSeason}`]);
    await pool.query(`insert into provider_championships(id,provider_instance_id,championship_id,external_championship_id,sync_state,is_primary) values($1,$2,'motogp',$3,'paused',false)`,[eProviderChampB,providerB,`e-b-${eSeason}`]);
    await pool.query(`insert into reconciliation_policies(id,championship_id,championship_season_id,resource_kind,version,status,checksum,idempotency_key,request_fingerprint,actor_id,activated_at) values($1,'motogp',$2,'meeting',1,'active',$3,$4,$3,'test',$5)`,[ePolicy,eSeason,'6'.repeat(64),`e-${ePolicy}`,evaluationAt]);
    for(const [field,klass,priority] of [['name','DISPLAY',[['f56-a'],['f56-b']]],['startsAt','SCHEDULE',[['f56-b'],['f56-a']]],['venueId','REFERENCE',[['f56-a','f56-b']]]] as const)await pool.query(`insert into reconciliation_policy_field_rules(id,policy_id,field_name,field_class,provider_priority) values($1,$2,$3,$4,$5::jsonb)`,[randomUUID(),ePolicy,field,klass,JSON.stringify(priority)]);
    const setup=async(label:string,current:{name:string;startsAt:string},contributions:Array<{provider:'a'|'b';values:Record<string,unknown>}>)=>{const id=randomUUID();await pool.query(`insert into meetings(id,championship_id,championship_season_id,name,season,starts_at,timezone) values($1,'motogp',$2,$3,2026,$4,'UTC')`,[id,eSeason,current.name,current.startsAt]);for(const [index,item] of contributions.entries()){const sourceId=randomUUID(),champ=item.provider==='a'?eProviderChampA:eProviderChampB,instance=item.provider==='a'?provider:providerB;await pool.query(`insert into provider_source_entities(id,provider_instance_id,provider_championship_id,entity_kind,external_id,season,source_data,source_hash,first_observed_at,last_observed_at,last_changed_at) values($1,$2,$3,'meeting',$4,2026,'{}',$5,$6,$6,$6)`,[sourceId,instance,champ,`${label}-${index}`,(index+1).toString(16).repeat(64).slice(0,64),evaluationAt]);await pool.query(`insert into meeting_source_links(source_entity_id,meeting_id,normalization_version) values($1,$2,'f56')`,[sourceId,id]);await pool.query(`insert into meeting_source_contributions(id,source_entity_id,source_link_id,meeting_id,normalization_version,source_checksum,contribution_checksum,normalized_values,structural_references,observed_at,received_at) values($1,$2,$2,$3,'f56',$4,$5,$6::jsonb,'{}',$7,$7)`,[randomUUID(),sourceId,id,'a'.repeat(64),`${index+2}`.repeat(64).slice(0,64),JSON.stringify(item.values),evaluationAt]);}return id;};
    const metrics=async(id:string)=>{const state=(await pool.query('select name,starts_at,venue_id from meetings where id=$1',[id])).rows[0],publication=(await pool.query(`select revision,state_checksum from public_resource_states where resource_type='meeting' and resource_id=$1`,[id])).rows[0];return {state,revision:Number(publication?.revision??0),checksum:publication?.state_checksum??null,changes:Number((await pool.query(`select count(*) value from public_change_log where resource_type='meeting' and resource_id=$1`,[id])).rows[0].value),runs:Number((await pool.query(`select count(*) value from reconciliation_runs where entity_kind='meeting' and entity_uuid=$1`,[id])).rows[0].value),decisions:Number((await pool.query(`select count(*) value from reconciliation_field_decisions decision join reconciliation_runs run on run.id=decision.run_id where run.entity_uuid=$1`,[id])).rows[0].value),conflicts:Number((await pool.query(`select count(*) value from reconciliation_conflicts where entity_kind='meeting' and entity_uuid=$1`,[id])).rows[0].value)};};
    const apply=async(id:string,key:string,fail=false)=>{const preview=await service.preview({entityKind:'meeting',entityUuid:id,policyId:ePolicy,evaluationAt});return service.apply({entityKind:'meeting',entityUuid:id,policyId:ePolicy,evaluationAt,previewChecksum:preview.previewChecksum,idempotencyKey:key,actorId:'test',failBeforeCommit:fail});};

    const e1=await setup('e1',{name:'Same',startsAt:'2026-10-01T10:00:00Z'},[{provider:'a',values:{name:'Same',startsAt:'2026-10-01T10:00:00Z'}}]),e1Before=await metrics(e1),e1Result=await apply(e1,'e1');expect(e1Result.outcome).toBe('no_op');expect(await metrics(e1)).toMatchObject({state:e1Before.state,revision:e1Before.revision,changes:e1Before.changes,runs:e1Before.runs+1,decisions:e1Before.decisions+3,conflicts:e1Before.conflicts});expect((await apply(e1,'e1')).replay).toBe(true);
    const e2=await setup('e2',{name:'Old',startsAt:'2026-10-02T10:00:00Z'},[{provider:'a',values:{name:'New',startsAt:'2026-10-02T10:00:00Z'}}]),e2Before=await metrics(e2);await apply(e2,'e2');const e2After=await metrics(e2);expect(e2After.state.name).toBe('New');expect(e2After.state.starts_at).toEqual(e2Before.state.starts_at);expect(e2After.revision-e2Before.revision).toBe(1);expect(e2After.changes-e2Before.changes).toBe(1);expect(e2After.runs-e2Before.runs).toBe(1);expect(e2After.decisions-e2Before.decisions).toBe(3);
    const e3=await setup('e3',{name:'Old','startsAt':'2026-10-03T10:00:00Z'},[{provider:'a',values:{name:'New',startsAt:'2026-10-03T11:00:00Z'}}]),e3Before=await metrics(e3);await apply(e3,'e3');const e3After=await metrics(e3);expect(e3After.state.name).toBe('New');expect(new Date(e3After.state.starts_at).toISOString()).toBe('2026-10-03T11:00:00.000Z');expect(e3After.revision-e3Before.revision).toBe(1);expect(e3After.changes-e3Before.changes).toBe(1);expect(e3After.decisions-e3Before.decisions).toBe(3);
    const e4Contributions=[{provider:'a' as const,values:{name:'Provider A'}},{provider:'b' as const,values:{startsAt:'2026-10-04T12:00:00Z'}}],e4=await setup('e4',{name:'Old',startsAt:'2026-10-04T10:00:00Z'},e4Contributions),e4Before=await metrics(e4),e4Preview=await service.preview({entityKind:'meeting',entityUuid:e4,policyId:ePolicy,evaluationAt});await apply(e4,'e4');const e4After=await metrics(e4);expect(e4After.state.name).toBe('Provider A');expect(new Date(e4After.state.starts_at).toISOString()).toBe('2026-10-04T12:00:00.000Z');expect(e4After.revision-e4Before.revision).toBe(1);expect(e4After.changes-e4Before.changes).toBe(1);const e4Winners=(await pool.query(`select field_name,winning_contribution_id from reconciliation_field_decisions decision join reconciliation_runs run on run.id=decision.run_id where run.entity_uuid=$1 and winning_contribution_id is not null order by field_name`,[e4])).rows;expect(e4Winners.map(row=>row.field_name)).toEqual(['name','startsAt']);expect((await service.preview({entityKind:'meeting',entityUuid:e4,policyId:ePolicy,evaluationAt})).result.effectiveChecksum).toBe(e4Preview.result.effectiveChecksum);
    const venueA=randomUUID(),venueB=randomUUID(),e5=await setup('e5',{name:'Conflict',startsAt:'2026-10-05T10:00:00Z'},[{provider:'a',values:{name:'Changed too',venueId:venueA}},{provider:'b',values:{venueId:venueB}}]),e5Before=await metrics(e5),e5Result=await apply(e5,'e5');const e5After=await metrics(e5);expect(e5Result.outcome).toBe('review_required');expect(e5After.state).toEqual(e5Before.state);expect(e5After.revision-e5Before.revision).toBe(0);expect(e5After.changes-e5Before.changes).toBe(0);expect(e5After.runs-e5Before.runs).toBe(1);expect(e5After.decisions-e5Before.decisions).toBe(3);expect(e5After.conflicts-e5Before.conflicts).toBe(1);
    const e6=await setup('e6',{name:'Before failure',startsAt:'2026-10-06T10:00:00Z'},[{provider:'a',values:{name:'Must rollback',startsAt:'2026-10-06T11:00:00Z'}}]),e6Before=await metrics(e6);await expect(apply(e6,'e6',true)).rejects.toThrow('reconciliation_publication_injected_failure');expect(await metrics(e6)).toEqual(e6Before);
  },20000);

  it('G1-G7 preserve source corrections as versioned pre-normalization provenance',async()=>{
    const gVenue=randomUUID(),gCircuit=`g-circuit-${gVenue}`,gSource=randomUUID(),gMeeting=randomUUID(),gPolicy=policy;
    await pool.query(`insert into venues(id,key,name,kind_key) values($1,$2,'G Venue','circuit')`,[gVenue,`g-${gVenue}`]);
    await pool.query(`insert into circuits(id,name,country_code,timezone) values($1,'G Circuit','FR','UTC')`,[gCircuit]);
    await pool.query(`insert into circuit_venue_links(circuit_id,venue_id) values($1,$2)`,[gCircuit,gVenue]);
    await pool.query(`insert into meetings(id,championship_id,championship_season_id,name,season,starts_at,timezone,venue_id) values($1,'f1',$2,'Raw A',2026,'2026-11-01T10:00:00Z','UTC',$3)`,[gMeeting,season,gVenue]);
    const raw={name:'Raw A',championship_id:'f56',circuit_id:'g-circuit',starts_at:'2026-11-01T10:00:00Z',status:'scheduled',timezone:'UTC'};
    await pool.query(`insert into provider_source_entities(id,provider_instance_id,provider_championship_id,entity_kind,external_id,season,source_data,source_hash,first_observed_at,last_observed_at,last_changed_at) values($1,$2,$3,'meeting',$4,2026,$5::jsonb,$6,$7,$7,$7)`,[gSource,provider,providerChampionship,`g-${gSource}`,JSON.stringify(raw),'7'.repeat(64),evaluationAt]);
    await pool.query(`insert into meeting_source_links(source_entity_id,meeting_id,normalization_version) values($1,$2,'g')`,[gSource,gMeeting]);
    const mapping={version:'g-v1',rulesVersion:'g-r1',championshipIds:{f56:'f1'},circuitIds:{'g-circuit':gCircuit},sessionTypes:{},statuses:{scheduled:'scheduled' as const}};
    const correction=await sourceProtectionService.upsertCorrection({sourceEntityId:gSource,fieldPath:'name',overrideValue:'Source B',origin:'administrator',actorId:'maintainer',reason:'G source correction'});
    const normalizeAndPublish=async(now:string)=>{const normalized=await normalizationService.normalizeUnit({sourceEntityId:gSource,scopeKey:`g:${now}`,expectedFenceGeneration:0,normalizationNow:new Date(now),mapping});await publicationService.publishCandidate({candidateId:normalized.candidateId,occurredAt:new Date(now)});return normalized;};
    const first=await normalizeAndPublish('2026-11-01T12:00:00Z');
    const firstContribution=(await pool.query(`select * from meeting_source_contributions where source_entity_id=$1 order by received_at desc limit 1`,[gSource])).rows[0];
    expect(first.state.name).toBe('Source B');expect(firstContribution.normalized_values.name).toBe('Source B');expect(firstContribution.source_correction_provenance).toEqual([{id:String(correction.id),revision:1,fieldPath:'name'}]);
    expect((await pool.query('select source_data from provider_source_entities where id=$1',[gSource])).rows[0].source_data.name).toBe('Raw A');
    expect((await pool.query(`select count(*) count from canonical_field_overrides where entity_uuid=$1`,[gMeeting])).rows[0].count).toBe('0');
    const override=await overrideService.set({entityKind:'meeting',entityUuid:gMeeting,canonicalRecordId:gMeeting,fieldName:'name',value:'Canonical C',actorId:'maintainer',reason:'G precedence',expectedRevision:0,idempotencyKey:'g-canonical'});
    expect((await service.preview({entityKind:'meeting',entityUuid:gMeeting,policyId:gPolicy,evaluationAt:'2026-11-01T12:01:00Z'})).result.effectiveState.name).toBe('Canonical C');
    await overrideService.revoke({entityKind:'meeting',entityUuid:gMeeting,overrideId:String(override.override.id),actorId:'maintainer',reason:'G reveal source',expectedRevision:1,idempotencyKey:'g-revoke'});
    expect((await service.preview({entityKind:'meeting',entityUuid:gMeeting,policyId:gPolicy,evaluationAt:'2026-11-01T12:01:00Z'})).result.effectiveState.name).toBe('Source B');
    await sourceProtectionService.upsertCorrection({sourceEntityId:gSource,fieldPath:'name',overrideValue:'Source D',origin:'administrator',actorId:'maintainer',reason:'G source correction v2'});
    const second=await normalizeAndPublish('2026-11-01T12:02:00Z');expect(second.state.name).toBe('Source D');expect(second.candidateId).not.toBe(first.candidateId);
    const contributionsAfterUpdate=(await pool.query(`select normalized_values,source_correction_provenance from meeting_source_contributions where source_entity_id=$1 order by received_at`,[gSource])).rows;
    expect(contributionsAfterUpdate).toHaveLength(2);expect(contributionsAfterUpdate[0].normalized_values.name).toBe('Source B');expect(contributionsAfterUpdate[1].source_correction_provenance[0].revision).toBe(2);
    expect((await service.preview({entityKind:'meeting',entityUuid:gMeeting,policyId:gPolicy,evaluationAt:'2026-11-01T12:02:01Z'})).result.effectiveState.name).toBe('Source D');
    await sourceProtectionService.deactivateCorrection(String(correction.id));
    const third=await normalizeAndPublish('2026-11-01T12:03:00Z');expect(third.state.name).toBe('Raw A');expect(third.candidateId).not.toBe(second.candidateId);
    expect((await pool.query(`select count(*) count from meeting_source_contributions where source_entity_id=$1`,[gSource])).rows[0].count).toBe('3');
    expect((await service.preview({entityKind:'meeting',entityUuid:gMeeting,policyId:gPolicy,evaluationAt:'2026-11-01T12:03:01Z'})).result.effectiveState.name).toBe('Raw A');
    expect((await pool.query(`select count(*) count from canonical_field_overrides where legacy_event_correction_id is null and entity_uuid=$1 and status='active'`,[gMeeting])).rows[0].count).toBe('0');
  },20000);

  it('H1-H18 and I1-I18 enforce field matrices and structural boundaries',async()=>{
    const contribution=(id:string,providerKey:string,values:Record<string,unknown>)=>({id,providerKey,values,structuralReferences:{},eligible:true,withdrawn:false});
    const matrix=(kind:'meeting'|'event',field:string,klass:any,current:unknown,a:unknown,b:unknown)=>{
      const base={resourceKind:kind,currentState:{[field]:current},contributions:[contribution('a','a',{[field]:a}),contribution('b','b',{[field]:b})],policy:{id:`${kind}-${field}`,version:1,resourceKind:kind,rules:[{field,class:klass,providerPriority:[['a'],['b']]}]},overrides:[],evaluationAt};
      const selected=reconcile(base as any);expect(selected.effectiveState[field]).toEqual(a??b);expect(selected.materializationEligible).toBe(true);
      const fallback=reconcile({...base,contributions:[contribution('a','a',{}),contribution('b','b',{[field]:b})]} as any);expect(fallback.effectiveState[field]).toEqual(b);
      const overridden=reconcile({...base,overrides:[{field,value:'ADMIN',revision:1}]} as any);expect(overridden.effectiveState[field]).toBe('ADMIN');
      return base;
    };
    for(const [field,klass,current,a,b] of [['name','DISPLAY','Old','A','B'],['round','DISPLAY','1','2','3'],['startsAt','SCHEDULE','2026-01-01T10:00:00Z','2026-01-01T11:00:00Z','2026-01-01T12:00:00Z'],['endsAt','SCHEDULE','2026-01-01T13:00:00Z','2026-01-01T14:00:00Z','2026-01-01T15:00:00Z'],['venueId','REFERENCE',null,'v-a','v-b'],['venueLayoutId','REFERENCE',null,'l-a','l-b']] as const)matrix('meeting',field,klass,current,a,b);
    for(const [field,klass,current,a,b] of [['name','DISPLAY','Old','A','B'],['sessionLabel','DISPLAY','FP1','Practice 1','P1'],['sessionType','REFERENCE','practice','qualifying','race'],['startsAt','SCHEDULE','2026-01-01T10:00:00Z','2026-01-01T11:00:00Z','2026-01-01T12:00:00Z'],['endsAt','SCHEDULE',null,'2026-01-01T12:00:00Z','2026-01-01T13:00:00Z'],['status','STATUS','scheduled','completed','cancelled'],['venueId','REFERENCE',null,'v-a','v-b'],['venueLayoutId','REFERENCE',null,'l-a','l-b']] as const)matrix('event',field,klass,current,a,b);
    const scheduleInput={resourceKind:'meeting' as const,currentState:{startsAt:'2026-01-01T10:00:00Z'},contributions:[contribution('a','a',{startsAt:'2026-01-01T11:00:00Z'}),contribution('b','b',{startsAt:'2026-01-01T11:00:30Z'})],policy:{id:'tolerance',version:1,resourceKind:'meeting' as const,rules:[{field:'startsAt',class:'SCHEDULE' as const,providerPriority:[['a','b']],scheduleToleranceSeconds:60}]},overrides:[],evaluationAt};
    const within=reconcile(scheduleInput);expect(within.materializationEligible).toBe(true);expect(within.decisions[0].outcome).toBe('auto_resolved');
    const beyond=reconcile({...scheduleInput,policy:{...scheduleInput.policy,rules:[{...scheduleInput.policy.rules[0],scheduleToleranceSeconds:10}]}});expect(beyond.materializationEligible).toBe(false);
    const status=reconcile({resourceKind:'event',currentState:{status:'scheduled'},contributions:[contribution('a','a',{status:'scheduled'}),contribution('b','b',{status:'completed'})],policy:{id:'status',version:1,resourceKind:'event',rules:[{field:'status',class:'STATUS',providerPriority:[['a','b']],compatibleStatusTransitions:{scheduled:['completed']}}]},overrides:[],evaluationAt});expect(status.effectiveState.status).toBe('completed');
    for(const field of ['championship_id','championship_season_id','meeting_id','normalized_uuid'])expect(()=>reconcile({resourceKind:'event',currentState:{},contributions:[],policy:{id:field,version:1,resourceKind:'event',rules:[{field,class:'IDENTITY',providerPriority:[]}]},overrides:[],evaluationAt} as any)).toThrow();

    const hiSource=randomUUID(),badContribution=randomUUID();
    await pool.query(`insert into provider_source_entities(id,provider_instance_id,provider_championship_id,entity_kind,external_id,season,source_data,source_hash,first_observed_at,last_observed_at,last_changed_at) values($1,$2,$3,'meeting',$4,2026,'{}',$5,$6,$6,$6)`,[hiSource,provider,providerChampionship,`hi-${hiSource}`,'9'.repeat(64),evaluationAt]);
    await pool.query(`insert into meeting_source_links(source_entity_id,meeting_id,normalization_version) values($1,$2,'hi')`,[hiSource,meeting]);
    await pool.query(`insert into meeting_source_contributions(id,source_entity_id,source_link_id,meeting_id,normalization_version,source_checksum,contribution_checksum,normalized_values,structural_references,observed_at,received_at) values($1,$2,$2,$3,'hi',$4,$5,'{"name":"Must Not Apply"}',$6::jsonb,$7,$7)`,[badContribution,hiSource,meeting,'9'.repeat(64),'8'.repeat(64),JSON.stringify({championshipSeasonId:randomUUID()}),evaluationAt]);
    const structural=await service.preview({entityKind:'meeting',entityUuid:meeting,policyId:policy,evaluationAt});expect(structural.result.materializationEligible).toBe(false);expect(structural.result.decisions.some(item=>item.field==='structural:championshipSeasonId')).toBe(true);expect(structural.result.effectiveState.name).toBe((await pool.query('select name from meetings where id=$1',[meeting])).rows[0].name);
    await pool.query('update meeting_source_contributions set withdrawn_at=$2 where id=$1',[badContribution,evaluationAt]);
    await expect(overrideService.set({entityKind:'event',entityUuid:eventUuid,canonicalRecordId:eventId,fieldName:'meeting_id',value:randomUUID(),actorId:'test',reason:'identity',expectedRevision:0,idempotencyKey:'hi-identity'})).rejects.toThrow('identity_override_forbidden');
    await expect(pool.query(`update reconciliation_policy_field_rules set provider_priority='[["f56-b"]]' where policy_id=$1`,[policy])).rejects.toThrow();
    await expect(pool.query(`insert into reconciliation_policies(id,championship_id,championship_season_id,resource_kind,version,status,checksum,idempotency_key,request_fingerprint,actor_id,activated_at) values($1,'f1',$2,'meeting',50,'active',$3,$4,$3,'test',$5)`,[randomUUID(),season,'7'.repeat(64),`duplicate-${randomUUID()}`,evaluationAt])).rejects.toThrow();
    await expect(pool.query('update meetings set venue_id=$2 where id=$1',[meeting,randomUUID()])).rejects.toThrow();
    await expect(pool.query(`update events set session_type_key='not-a-session-type' where id=$1`,[eventId])).rejects.toThrow();
    await expect(pool.query(`update meetings set round=$2 where id=$1`,[meeting,'x'.repeat(129)])).rejects.toThrow();
    await expect(pool.query(`update meetings set starts_at='2026-12-02T00:00:00Z',ends_at='2026-12-01T00:00:00Z' where id=$1`,[meeting])).rejects.toThrow();
    const venueA=randomUUID(),venueB=randomUUID(),layoutB=randomUUID();await pool.query(`insert into venues(id,key,name,kind_key) values($1,$2,'HI Venue A','circuit'),($3,$4,'HI Venue B','circuit')`,[venueA,`hi-a-${venueA}`,venueB,`hi-b-${venueB}`]);await pool.query(`insert into venue_layouts(id,venue_id,key,name) values($1,$2,$3,'HI Layout B')`,[layoutB,venueB,`hi-${layoutB}`]);await expect(pool.query('update events set venue_id=$2,venue_layout_id=$3 where id=$1',[eventId,venueA,layoutB])).rejects.toThrow();
    const hiEventContribution=randomUUID();await pool.query(`insert into event_source_contributions(id,source_entity_id,source_link_id,event_uuid,event_id,meeting_id,normalization_version,source_checksum,contribution_checksum,normalized_values,structural_references,observed_at,received_at,source_revision) values($1,$2,$2,$3,$4,$5,'hi',$6,$7,'{"name":"No reparent"}',$8::jsonb,$9,$9,3)`,[hiEventContribution,eventSourceA,eventUuid,eventId,meeting,'6'.repeat(64),'5'.repeat(64),JSON.stringify({meetingId:randomUUID(),championshipId:'f1',championshipSeasonId:season}),evaluationAt]);
    const parentBoundary=await service.preview({entityKind:'event',entityUuid:eventUuid,policyId:eventPolicy,evaluationAt});expect(parentBoundary.result.materializationEligible).toBe(false);expect(parentBoundary.result.decisions.some(item=>item.field==='structural:meetingId')).toBe(true);await pool.query('update event_source_contributions set withdrawn_at=$2 where id=$1',[hiEventContribution,evaluationAt]);
    const wrongScope=randomUUID();await pool.query(`insert into reconciliation_policies(id,championship_id,resource_kind,version,status,checksum,idempotency_key,request_fingerprint,actor_id,activated_at) values($1,'motogp','meeting',1,'active',$2,$3,$2,'test',$4)`,[wrongScope,'4'.repeat(64),`scope-${wrongScope}`,evaluationAt]);await pool.query(`insert into reconciliation_policy_field_rules(id,policy_id,field_name,field_class,provider_priority) values($1,$2,'name','DISPLAY','[["f56-a"]]')`,[randomUUID(),wrongScope]);await expect(service.preview({entityKind:'meeting',entityUuid:meeting,policyId:wrongScope,evaluationAt})).rejects.toThrow('policy_scope_mismatch');
    const before=(await pool.query('select name,id from meetings where id=$1',[meeting])).rows[0];await pool.query('update meeting_source_links set normalization_version=$2 where source_entity_id=$1',[source,'hi-link']);expect((await pool.query('select name,id from meetings where id=$1',[meeting])).rows[0]).toEqual(before);
    await pool.query(`update provider_instances set state='paused',enabled=false where id=$1`,[provider]);expect((await pool.query('select id from meetings where id=$1',[meeting])).rows[0].id).toBe(meeting);await pool.query(`update provider_instances set state='active',enabled=true where id=$1`,[provider]);
    expect((await pool.query('select meeting_id from meeting_events where event_id=$1',[eventId])).rows[0].meeting_id).toBe(meeting);expect((await pool.query('select normalized_uuid from events where id=$1',[eventId])).rows[0].normalized_uuid).toBe(eventUuid);
  },20000);

  it('rejects tampering and stale contribution state, then applies exactly once',async()=>{
    const preview=await service.preview({entityKind:'meeting',entityUuid:meeting,policyId:policy,evaluationAt});
    await expect(service.apply({entityKind:'meeting',entityUuid:meeting,policyId:policy,evaluationAt,previewChecksum:'0'.repeat(64),idempotencyKey:'bad',actorId:'test'})).rejects.toBeInstanceOf(StaleReconciliationPreviewError);
    const latest=(await pool.query('select id from meeting_source_contributions where source_entity_id=$1 order by source_revision desc limit 1',[source])).rows[0].id;
    await pool.query(`update meeting_source_contributions set withdrawn_at=$2 where id=$1`,[latest,evaluationAt]);
    await expect(service.apply({entityKind:'meeting',entityUuid:meeting,policyId:policy,evaluationAt,previewChecksum:preview.previewChecksum,idempotencyKey:'stale',actorId:'test'})).rejects.toBeInstanceOf(StaleReconciliationPreviewError);
    await pool.query(`update meeting_source_contributions set withdrawn_at=null where id=$1`,[latest]);
    const fresh=await service.preview({entityKind:'meeting',entityUuid:meeting,policyId:policy,evaluationAt});
    const [first,second]=await Promise.all([service.apply({entityKind:'meeting',entityUuid:meeting,policyId:policy,evaluationAt,previewChecksum:fresh.previewChecksum,idempotencyKey:'same',actorId:'test'}),service.apply({entityKind:'meeting',entityUuid:meeting,policyId:policy,evaluationAt,previewChecksum:fresh.previewChecksum,idempotencyKey:'same',actorId:'test'})]);
    expect([first.replay,second.replay].sort()).toEqual([false,true]);
    expect((await pool.query('select name from meetings where id=$1',[meeting])).rows[0].name).toBe('After');
    expect((await pool.query('select count(*) count from public_change_log where resource_id=$1',[meeting])).rows[0].count).toBe('1');
  });

  it('rolls back run, canonical state and publication together',async()=>{
    await pool.query(`insert into meeting_source_contributions(id,source_entity_id,source_link_id,meeting_id,normalization_version,source_checksum,contribution_checksum,normalized_values,structural_references,observed_at,received_at,source_revision) values($1,$2,$2,$3,'f56',$4,$5,'{"name":"Rollback"}','{}',$6,$6,5)`,[randomUUID(),source,meeting,'a'.repeat(64),'d'.repeat(64),evaluationAt]);
    const preview=await service.preview({entityKind:'meeting',entityUuid:meeting,policyId:policy,evaluationAt});
    const before=(await pool.query('select name from meetings where id=$1',[meeting])).rows[0].name;
    await expect(service.apply({entityKind:'meeting',entityUuid:meeting,policyId:policy,evaluationAt,previewChecksum:preview.previewChecksum,idempotencyKey:'rollback',actorId:'test',failBeforeCommit:true})).rejects.toThrow('reconciliation_publication_injected_failure');
    expect((await pool.query('select name from meetings where id=$1',[meeting])).rows[0].name).toBe(before);
    expect((await pool.query(`select count(*) count from reconciliation_runs where idempotency_key='rollback'`)).rows[0].count).toBe('0');
  });

  it('uses the canonical Event advisory lock for the legacy bridge',async()=>{
    const first=await pool.connect(),second=await pool.connect();
    try{
      await first.query('begin');
      const row=await lockEvent(first,eventId);
      expect(row?.normalized_uuid).toBe(eventUuid);
      const competing=(await second.query('select pg_try_advisory_xact_lock(hashtextextended($1,0)) acquired',[`event:${eventUuid}`])).rows[0];
      expect(competing.acquired).toBe(false);
      await first.query('rollback');
      const released=(await second.query('select pg_try_advisory_xact_lock(hashtextextended($1,0)) acquired',[`event:${eventUuid}`])).rows[0];
      expect(released.acquired).toBe(true);
      await second.query('select pg_advisory_unlock(hashtextextended($1,0))',[`event:${eventUuid}`]);
    }finally{await first.query('rollback');first.release();second.release();}
  });

  it('accounts causally for oscillating and concurrent provider observations without auto-revocation',async()=>{
    const lifecycleId='f56-provider-observation',lifecycleUuid=randomUUID();
    await pool.query(`insert into events(id,championship_id,name,slug,starts_at,timezone,status,published,origin,provider_key,external_id,session_type_key) values($1,'f1','Provider 19:00',$1,'2026-09-26T19:00:00Z','UTC','scheduled',true,'provider','f56-a',$1,'other')`,[lifecycleId]);
    await pool.query(`insert into meeting_events(meeting_id,event_id,position) values($1,$2,2)`,[meeting,lifecycleId]);
    await pool.query(`update events set normalized_uuid=$2 where id=$1`,[lifecycleId,lifecycleUuid]);
    const created=await overrideService.set({entityKind:'event',entityUuid:lifecycleUuid,fieldName:'name',value:'Admin 20:00',providerValueAtCreation:'Provider A',actorId:'maintainer',reason:'targeted regression',expectedRevision:0,idempotencyKey:'provider-lifecycle-set',legacyStatus:'active'}),lifecycleOverrideId=String(created.override.id);
    expect(created.override).toMatchObject({provider_value_at_creation:'Provider A',legacy_status:'active'});
    const observeInTransaction=(client:PoolClient,name:string)=>overrideService.recordProviderObservationInTransaction(client,{overrideId:lifecycleOverrideId,entityUuid:lifecycleUuid,providerValue:name,legacyStatus:'active'});
    const observe=async(name:string)=>withTransaction(client=>observeInTransaction(client,name));
    const evidence=async()=>{const override=(await pool.query('select status,revision,provider_value_at_creation from canonical_field_overrides where id=$1',[lifecycleOverrideId])).rows[0];return {status:String(override.status),revision:Number(override.revision),providerValue:override.provider_value_at_creation,history:Number((await pool.query('select count(*) count from canonical_field_override_history where override_id=$1',[lifecycleOverrideId])).rows[0].count),mutations:Number((await pool.query('select count(*) count from canonical_override_mutations where override_id=$1',[lifecycleOverrideId])).rows[0].count)};};
    expect(await evidence()).toEqual({status:'active',revision:1,providerValue:'Provider A',history:1,mutations:1});
    await observe('Provider A');
    expect(await evidence()).toEqual({status:'active',revision:1,providerValue:'Provider A',history:1,mutations:1});
    await observe('Provider B');
    await observe('Provider B');
    expect(await evidence()).toEqual({status:'active',revision:2,providerValue:'Provider B',history:2,mutations:2});
    await observe('Provider A');
    expect(await evidence()).toEqual({status:'active',revision:3,providerValue:'Provider A',history:3,mutations:3});
    await observe('Provider A');
    expect(await evidence()).toEqual({status:'active',revision:3,providerValue:'Provider A',history:3,mutations:3});
    await observe('Provider B');await observe('Provider A');
    expect(await evidence()).toEqual({status:'active',revision:5,providerValue:'Provider A',history:5,mutations:5});

    const sameFirst=await pool.connect(),sameSecond=await pool.connect();
    try{await sameFirst.query('begin');await sameSecond.query('begin');await observeInTransaction(sameFirst,'Provider B');let settled=false;const competing=observeInTransaction(sameSecond,'Provider B').then(()=>{settled=true;});await new Promise(resolve=>setTimeout(resolve,75));expect(settled).toBe(false);await sameFirst.query('commit');await competing;await sameSecond.query('commit');}finally{await sameFirst.query('rollback');await sameSecond.query('rollback');sameFirst.release();sameSecond.release();}
    expect(await evidence()).toEqual({status:'active',revision:6,providerValue:'Provider B',history:6,mutations:6});

    const differentFirst=await pool.connect(),differentSecond=await pool.connect();
    try{await differentFirst.query('begin');await differentSecond.query('begin');await observeInTransaction(differentFirst,'Provider 22:00');let settled=false;const competing=observeInTransaction(differentSecond,'Provider 23:00').then(()=>{settled=true;});await new Promise(resolve=>setTimeout(resolve,75));expect(settled).toBe(false);await differentFirst.query('commit');await competing;await differentSecond.query('commit');}finally{await differentFirst.query('rollback');await differentSecond.query('rollback');differentFirst.release();differentSecond.release();}
    expect(await evidence()).toEqual({status:'active',revision:8,providerValue:'Provider 23:00',history:8,mutations:8});

    await expect(withTransaction(async client=>{await observeInTransaction(client,'Provider 24:00');expect((await client.query('select revision from canonical_field_overrides where id=$1',[lifecycleOverrideId])).rows[0].revision).toBe('9');throw new Error('provider_observation_injected_failure');})).rejects.toThrow('provider_observation_injected_failure');
    expect(await evidence()).toEqual({status:'active',revision:8,providerValue:'Provider 23:00',history:8,mutations:8});
    await observe('Provider 24:00');
    expect(await evidence()).toEqual({status:'active',revision:9,providerValue:'Provider 24:00',history:9,mutations:9});

    const replaced=await overrideService.set({entityKind:'event',entityUuid:lifecycleUuid,fieldName:'name',value:'Admin 20:00',actorId:'maintainer',reason:'replace',expectedRevision:9,idempotencyKey:'provider-lifecycle-replace'});
    expect(Number(replaced.override.revision)).toBe(10);
    const revoked=await overrideService.revoke({entityKind:'event',entityUuid:lifecycleUuid,overrideId:lifecycleOverrideId,actorId:'maintainer',reason:'explicit revoke',expectedRevision:10,idempotencyKey:'provider-lifecycle-revoke'});
    expect(revoked.override.status).toBe('revoked');expect(Number(revoked.override.revision)).toBe(11);
    const history=(await pool.query('select revision,operation from canonical_field_override_history where override_id=$1 order by revision',[lifecycleOverrideId])).rows;
    expect(history.map(row=>Number(row.revision))).toEqual([1,2,3,4,5,6,7,8,9,10,11]);expect(history.at(-2)?.operation).toBe('updated');expect(history.at(-1)?.operation).toBe('revoked');
    const mutations=(await pool.query('select resulting_revision,operation from canonical_override_mutations where override_id=$1 order by resulting_revision',[lifecycleOverrideId])).rows;
    expect(mutations.map(row=>Number(row.resulting_revision))).toEqual([1,2,3,4,5,6,7,8,9,10,11]);expect(mutations.at(-2)?.operation).toBe('set');expect(mutations.at(-1)?.operation).toBe('revoke');
  });

  it('proves shared-service direct and legacy SET/REPLACE/REVOKE idempotency',async()=>{
    const direct={entityKind:'event' as const,entityUuid:proofEventUuid,canonicalRecordId:proofEventId,fieldName:'name',value:'Direct A',actorId:'maintainer',reason:'S1',expectedRevision:0,idempotencyKey:'s1-direct'};
    const first=await overrideService.set(direct),replay=await overrideService.set(direct);
    expect(replay.replay).toBe(true);expect(replay.override.id).toBe(first.override.id);
    await expect(overrideService.set({...direct,value:'Divergent'})).rejects.toBeInstanceOf(OverrideConflictError);
    expect(Number((await pool.query('select count(*) count from canonical_field_override_history where override_id=$1',[first.override.id])).rows[0].count)).toBe(1);
    const revoke={entityKind:'event' as const,entityUuid:proofEventUuid,overrideId:String(first.override.id),actorId:'maintainer',reason:'S2',expectedRevision:1,idempotencyKey:'s2-revoke'};
    const revoked=await overrideService.revoke(revoke),revokeReplay=await overrideService.revoke(revoke);
    expect(revoked.override.status).toBe('revoked');expect(revokeReplay.replay).toBe(true);
    await expect(overrideService.revoke({...revoke,reason:'Divergent'})).rejects.toBeInstanceOf(OverrideConflictError);
    expect(Number((await pool.query('select count(*) count from canonical_field_override_history where override_id=$1',[first.override.id])).rows[0].count)).toBe(2);

    const legacySet=async(value:string)=>withTransaction(async client=>{const current=await lockEvent(client,proofEventId);await reconcileAdministrativePatch(client,current!,{name:value},'legacy-admin');});
    const legacyRowsBefore=Number((await pool.query('select count(*) count from event_corrections')).rows[0].count);
    await legacySet('Legacy A');
    let active=(await pool.query(`select * from canonical_field_overrides where entity_uuid=$1 and field_name='name' and status='active'`,[proofEventUuid])).rows[0];
    const legacyId=String(active.id),historyAfterSet=Number((await pool.query('select count(*) count from canonical_field_override_history where override_id=$1',[legacyId])).rows[0].count),firstKey=String(active.idempotency_key);
    expect(active.override_value).toBe('Legacy A');expect(active.actor_id).toBe('legacy-admin');
    await legacySet('Legacy A');
    expect(Number((await pool.query('select count(*) count from canonical_field_override_history where override_id=$1',[legacyId])).rows[0].count)).toBe(historyAfterSet);
    await legacySet('Legacy B');
    active=(await pool.query('select * from canonical_field_overrides where id=$1',[legacyId])).rows[0];expect(active.override_value).toBe('Legacy B');expect(Number(active.revision)).toBe(2);
    expect(Number((await pool.query('select count(*) count from canonical_field_override_history where override_id=$1',[legacyId])).rows[0].count)).toBe(historyAfterSet+1);
    await withTransaction(client=>resolveCorrection(client,legacyId,'accept-provider'));
    active=(await pool.query('select * from canonical_field_overrides where id=$1',[legacyId])).rows[0];expect(active.status).toBe('revoked');
    expect(Number((await pool.query('select count(*) count from canonical_field_override_history where override_id=$1',[legacyId])).rows[0].count)).toBe(historyAfterSet+2);
    await legacySet('Legacy A');
    const second=(await pool.query(`select * from canonical_field_overrides where entity_uuid=$1 and field_name='name' and status='active'`,[proofEventUuid])).rows[0];
    expect(second.override_value).toBe('Legacy A');expect(second.id).not.toBe(legacyId);expect(second.idempotency_key).not.toBe(firstKey);
    expect(Number((await pool.query('select count(*) count from event_corrections')).rows[0].count)).toBe(legacyRowsBefore);
  });

  it('B1-B5 and B7 bind every relevant preview input without APPLY side effects',async()=>{
    const counters=async()=>({revision:Number((await pool.query(`select coalesce(max(revision),0) value from public_resource_states where resource_type='meeting' and resource_id=$1`,[meeting])).rows[0].value),changes:Number((await pool.query(`select count(*) value from public_change_log where resource_type='meeting' and resource_id=$1`,[meeting])).rows[0].value),name:String((await pool.query('select name from meetings where id=$1',[meeting])).rows[0].name)});
    const stale=async(preview:any,key:string)=>{const before=await counters();await expect(service.apply({entityKind:'meeting',entityUuid:meeting,policyId:policy,evaluationAt,previewChecksum:preview.previewChecksum,idempotencyKey:key,actorId:'test'})).rejects.toBeInstanceOf(StaleReconciliationPreviewError);expect(await counters()).toEqual(before);};

    await pool.query(`insert into meeting_source_contributions(id,source_entity_id,source_link_id,meeting_id,normalization_version,source_checksum,contribution_checksum,normalized_values,structural_references,observed_at,received_at,source_revision) values($1,$2,$2,$3,'f56',$4,$5,'{"name":"B Provider"}','{}',$6,$6,6)`,[randomUUID(),source,meeting,'a'.repeat(64),'1f'.padEnd(64,'f'),evaluationAt]);
    const b1=await service.preview({entityKind:'meeting',entityUuid:meeting,policyId:policy,evaluationAt}),b1Id=randomUUID();
    await pool.query(`insert into meeting_source_contributions(id,source_entity_id,source_link_id,meeting_id,normalization_version,source_checksum,contribution_checksum,normalized_values,structural_references,observed_at,received_at,source_revision) values($1,$2,$2,$3,'f56',$4,$5,'{"name":"B1 new"}','{}',$6,$6,7)`,[b1Id,source,meeting,'a'.repeat(64),'2f'.padEnd(64,'f'),evaluationAt]);
    await stale(b1,'b1-old');expect(Number((await pool.query('select count(*) count from meeting_source_contributions where id=$1',[b1Id])).rows[0].count)).toBe(1);await pool.query('update meeting_source_contributions set withdrawn_at=$2 where id=$1',[b1Id,evaluationAt]);

    await pool.query('update meeting_source_contributions set withdrawn_at=null where id=$1',[b1Id]);const b2=await service.preview({entityKind:'meeting',entityUuid:meeting,policyId:policy,evaluationAt});await pool.query('update meeting_source_contributions set withdrawn_at=$2 where id=$1',[b1Id,evaluationAt]);await stale(b2,'b2-old');

    const b4=await service.preview({entityKind:'meeting',entityUuid:meeting,policyId:policy,evaluationAt});
    const set1=await overrideService.set({entityKind:'meeting',entityUuid:meeting,canonicalRecordId:meeting,fieldName:'name',value:'Admin B4',actorId:'maintainer',reason:'B4',expectedRevision:0,idempotencyKey:'b4-set'});await stale(b4,'b4-old');
    await overrideService.revoke({entityKind:'meeting',entityUuid:meeting,overrideId:String(set1.override.id),actorId:'maintainer',reason:'B4 cleanup',expectedRevision:1,idempotencyKey:'b4-revoke'});
    const set2=await overrideService.set({entityKind:'meeting',entityUuid:meeting,canonicalRecordId:meeting,fieldName:'name',value:'Admin B5',actorId:'maintainer',reason:'B5',expectedRevision:0,idempotencyKey:'b5-set'});
    const b5=await service.preview({entityKind:'meeting',entityUuid:meeting,policyId:policy,evaluationAt});await overrideService.revoke({entityKind:'meeting',entityUuid:meeting,overrideId:String(set2.override.id),actorId:'maintainer',reason:'B5 revoke',expectedRevision:1,idempotencyKey:'b5-revoke'});await stale(b5,'b5-old');

    const freshnessId=randomUUID(),sourceTime='2026-09-26T12:00:00.000Z',t2='2026-09-26T12:02:00.000Z';
    const inheritedOverride=(await pool.query(`select id,revision from canonical_field_overrides where entity_kind='event' and entity_uuid=$1 and field_name='name' and status='active'`,[eventUuid])).rows[0];
    if(inheritedOverride)await overrideService.revoke({entityKind:'event',entityUuid:eventUuid,overrideId:String(inheritedOverride.id),actorId:'maintainer',reason:'B7 isolated freshness proof',expectedRevision:Number(inheritedOverride.revision),idempotencyKey:'b7-isolate'});
    await pool.query(`insert into event_source_contributions(id,source_entity_id,source_link_id,event_uuid,event_id,meeting_id,normalization_version,source_checksum,contribution_checksum,normalized_values,structural_references,observed_at,received_at,source_updated_at,source_revision) values($1,$2,$2,$3,$4,$5,'f56',$6,$7,'{"name":"Fresh"}',$8::jsonb,$9,$9,$9,4)`,[freshnessId,eventSourceA,eventUuid,eventId,meeting,'4f'.padEnd(64,'f'),'5f'.padEnd(64,'f'),JSON.stringify({meetingId:meeting,championshipSeasonId:season}),sourceTime]);
    const t1Preview=await service.preview({entityKind:'event',entityUuid:eventUuid,policyId:eventPolicy,evaluationAt:sourceTime}),t1Replay=await service.preview({entityKind:'event',entityUuid:eventUuid,policyId:eventPolicy,evaluationAt:sourceTime}),t2Preview=await service.preview({entityKind:'event',entityUuid:eventUuid,policyId:eventPolicy,evaluationAt:t2});
    expect(t1Replay.previewChecksum).toBe(t1Preview.previewChecksum);expect(t1Preview.result.decisions[0]?.winnerContributionId).toBe(freshnessId);expect(t2Preview.result.decisions[0]?.outcome).toBe('degraded');
    await expect(service.apply({entityKind:'event',entityUuid:eventUuid,policyId:eventPolicy,evaluationAt:t2,previewChecksum:t1Preview.previewChecksum,idempotencyKey:'b7-old',actorId:'test'})).rejects.toBeInstanceOf(StaleReconciliationPreviewError);
    await pool.query('update event_source_contributions set withdrawn_at=$2 where id=$1',[freshnessId,evaluationAt]);
  });

  it('rejects an exact preview after an independent canonical row mutation',async()=>{
    await pool.query(`insert into meeting_source_contributions(id,source_entity_id,source_link_id,meeting_id,normalization_version,source_checksum,contribution_checksum,normalized_values,structural_references,observed_at,received_at,source_revision) values($1,$2,$2,$3,'f56',$4,$5,'{"name":"B6 Provider"}','{}',$6,$6,8)`,[randomUUID(),source,meeting,'a'.repeat(64),'f'.repeat(64),evaluationAt]);
    const preview=await service.preview({entityKind:'meeting',entityUuid:meeting,policyId:policy,evaluationAt});
    const beforeRevision=Number((await pool.query(`select coalesce(revision,0) revision from public_resource_states where resource_type='meeting' and resource_id=$1`,[meeting])).rows[0]?.revision??0);
    const beforeChanges=Number((await pool.query(`select count(*) count from public_change_log where resource_type='meeting' and resource_id=$1`,[meeting])).rows[0].count);
    await pool.query(`update meetings set name='Independent canonical mutation' where id=$1`,[meeting]);
    await expect(service.apply({entityKind:'meeting',entityUuid:meeting,policyId:policy,evaluationAt,previewChecksum:preview.previewChecksum,idempotencyKey:'b6-stale',actorId:'test'})).rejects.toBeInstanceOf(StaleReconciliationPreviewError);
    expect(Number((await pool.query(`select coalesce(revision,0) revision from public_resource_states where resource_type='meeting' and resource_id=$1`,[meeting])).rows[0]?.revision??0)).toBe(beforeRevision);
    expect(Number((await pool.query(`select count(*) count from public_change_log where resource_type='meeting' and resource_id=$1`,[meeting])).rows[0].count)).toBe(beforeChanges);
  });

  it('B3 rejects a preview after immutable policy activation changes',async()=>{
    const b3=await service.preview({entityKind:'meeting',entityUuid:meeting,policyId:policy,evaluationAt}),p2=randomUUID();
    const beforeName=String((await pool.query('select name from meetings where id=$1',[meeting])).rows[0].name),beforeRevision=Number((await pool.query(`select coalesce(max(revision),0) value from public_resource_states where resource_type='meeting' and resource_id=$1`,[meeting])).rows[0].value),beforeChanges=Number((await pool.query(`select count(*) value from public_change_log where resource_type='meeting' and resource_id=$1`,[meeting])).rows[0].value);
    await pool.query(`insert into reconciliation_policies(id,championship_id,championship_season_id,resource_kind,version,status,checksum,idempotency_key,request_fingerprint,actor_id) values($1,'f1',$2,'meeting',2,'draft',$3,'b3-p2',$3,'test')`,[p2,season,'3f'.padEnd(64,'f')]);
    await pool.query(`insert into reconciliation_policy_field_rules(id,policy_id,field_name,field_class,provider_priority) values($1,$2,'name','DISPLAY','[["f56-b"],["f56-a"]]')`,[randomUUID(),p2]);
    await pool.query(`update reconciliation_policies set status='retired',retired_at=now() where id=$1`,[policy]);await pool.query(`update reconciliation_policies set status='active',activated_at=now() where id=$1`,[p2]);
    await expect(service.apply({entityKind:'meeting',entityUuid:meeting,policyId:policy,evaluationAt,previewChecksum:b3.previewChecksum,idempotencyKey:'b3-old',actorId:'test'})).rejects.toThrow('active_policy_not_found');
    expect(String((await pool.query('select name from meetings where id=$1',[meeting])).rows[0].name)).toBe(beforeName);expect(Number((await pool.query(`select coalesce(max(revision),0) value from public_resource_states where resource_type='meeting' and resource_id=$1`,[meeting])).rows[0].value)).toBe(beforeRevision);expect(Number((await pool.query(`select count(*) value from public_change_log where resource_type='meeting' and resource_id=$1`,[meeting])).rows[0].value)).toBe(beforeChanges);
  });

  it('P1 selects explicit source revisions independently of contribution arrival and refuses ambiguous succession',async()=>{
    const target=randomUUID(),sourceId=randomUUID(),policyId=randomUUID(),v1=randomUUID(),v2=randomUUID();
    await pool.query(`insert into provider_source_entities(id,provider_instance_id,provider_championship_id,entity_kind,external_id,season,source_data,source_hash,first_observed_at,last_observed_at,last_changed_at) values($1,$2,$3,'meeting',$4,2026,'{}',$5,$6,$6,$6)`,[sourceId,provider,providerChampionship,`p1-${sourceId}`,'1'.repeat(64),evaluationAt]);
    await pool.query(`insert into meetings(id,championship_id,championship_season_id,name,season,starts_at,timezone) values($1,'f1',$2,'P1 Before',2026,'2026-12-01T10:00:00Z','UTC')`,[target,season]);
    const richState={resourceKind:'meeting',name:'P1 Before',sessionType:'other',sessionLabel:null,status:'scheduled',championshipId:'f1',championshipSeasonId:season,circuitId:'legacy-circuit',venueId:null,venueLayoutId:null,season:2026,round:null,startsAt:'2026-12-01T10:00:00.000Z',endsAt:null,timezone:'UTC',presence:'seen'};
    await pool.query(`insert into public_resource_states(resource_type,resource_id,championship_id,revision,lifecycle,canonical_state,state_checksum,promoted_at) values('meeting',$1,'f1',1,'active',$2::jsonb,$3,$4)`,[target,JSON.stringify(richState),'6'.repeat(64),evaluationAt]);
    await pool.query(`insert into meeting_source_links(source_entity_id,meeting_id,normalization_version) values($1,$2,'p1')`,[sourceId,target]);
    await pool.query(`update reconciliation_policies set status='retired',retired_at=coalesce(retired_at,now()) where championship_id='f1' and championship_season_id=$1 and resource_kind='meeting' and status='active'`,[season]);
    await pool.query(`insert into reconciliation_policies(id,championship_id,championship_season_id,resource_kind,version,status,checksum,idempotency_key,request_fingerprint,actor_id,activated_at) values($1,'f1',$2,'meeting',100,'active',$3,$4,$3,'test',$5)`,[policyId,season,'7'.repeat(64),`p1-${policyId}`,evaluationAt]);
    await pool.query(`insert into reconciliation_policy_field_rules(id,policy_id,field_name,field_class,provider_priority) values($1,$2,'name','DISPLAY','[["f56-a"]]')`,[randomUUID(),policyId]);
    const insert=`insert into meeting_source_contributions(id,source_entity_id,source_link_id,meeting_id,normalization_version,source_checksum,contribution_checksum,normalized_values,structural_references,observed_at,received_at,source_revision) values($1,$2,$2,$3,'p1',$4,$5,$6::jsonb,'{}',$7,$8,$9) on conflict(source_entity_id,contribution_checksum) do nothing`;
    const newer=await pool.connect(),older=await pool.connect();
    try{await newer.query('begin');await older.query('begin');await newer.query(insert,[v2,sourceId,target,'2'.repeat(64),'b'.repeat(64),JSON.stringify({name:'Version 2'}),'2026-12-02','2026-01-01',2]);await older.query(insert,[v1,sourceId,target,'1'.repeat(64),'a'.repeat(64),JSON.stringify({name:'Version 1'}),'2026-12-01','2026-12-31',1]);await newer.query('commit');await older.query('commit');}finally{await newer.query('rollback');await older.query('rollback');newer.release();older.release();}
    const preview=await service.preview({entityKind:'meeting',entityUuid:target,policyId,evaluationAt});
    expect(preview.result.effectiveState.name).toBe('Version 2');expect(preview.result.decisions[0]?.winnerContributionId).toBe(v2);
    await service.apply({entityKind:'meeting',entityUuid:target,policyId,evaluationAt,previewChecksum:preview.previewChecksum,idempotencyKey:'p1-complete-public',actorId:'test'});
    const published=(await pool.query(`select canonical_state from public_resource_states where resource_type='meeting' and resource_id=$1`,[target])).rows[0].canonical_state;
    expect(published).toEqual({...richState,name:'Version 2'});
    expect((await pool.query(`select canonical_state from public_resource_versions where resource_type='meeting' and resource_id=$1 order by revision desc limit 1`,[target])).rows[0].canonical_state).toEqual(published);
    expect((await pool.query('select count(*) count from meeting_source_contributions where source_entity_id=$1',[sourceId])).rows[0].count).toBe('2');
    expect((await pool.query(insert,[randomUUID(),sourceId,target,'2'.repeat(64),'b'.repeat(64),JSON.stringify({name:'Version 2'}),'2026-12-02','2027-01-01',2])).rowCount).toBe(0);
    await pool.query(insert,[randomUUID(),sourceId,target,'3'.repeat(64),'c'.repeat(64),JSON.stringify({name:'Ambiguous Version 2'}),'2026-12-03','2027-02-01',2]);
    await expect(service.preview({entityKind:'meeting',entityUuid:target,policyId,evaluationAt})).rejects.toThrow('ambiguous_source_contribution_succession');
    expect((await pool.query('select name from meetings where id=$1',[target])).rows[0].name).toBe('Version 2');
  });

  it('P1 maps all overlapping imported legacy Event fields before reconciliation',async()=>{
    await pool.query(`update reconciliation_policies set status='retired',retired_at=now() where id=$1 and status='active'`,[eventPolicy]);
    const id='f56-legacy-matrix',uuid='57100000-0000-4000-8000-000000000004',legacyMeeting='57100000-0000-4000-8000-000000000021',legacySeason='57100000-0000-4000-8000-000000000020',sourceId=randomUUID(),policyId=randomUUID();
    await pool.query(`insert into provider_source_entities(id,provider_instance_id,provider_championship_id,entity_kind,external_id,season,source_data,source_hash,first_observed_at,last_observed_at,last_changed_at) values($1,$2,$3,'event',$4,2026,'{}',$5,$6,$6,$6)`,[sourceId,provider,providerChampionship,id,'8'.repeat(64),evaluationAt]);
    await pool.query(`insert into event_source_links(source_entity_id,event_id,normalized_event_uuid,normalization_version) values($1,$2,$3,'p1')`,[sourceId,id,uuid]);
    const providerValues={name:'Provider Name',startsAt:'2026-12-10T12:00:00.000Z',endsAt:'2026-12-10T13:00:00.000Z',status:'cancelled',sessionLabel:'Provider FP1'};
    await pool.query(`insert into event_source_contributions(id,source_entity_id,source_link_id,event_uuid,event_id,meeting_id,normalization_version,source_checksum,contribution_checksum,normalized_values,structural_references,observed_at,received_at,source_revision) values($1,$2,$2,$3,$4,$5,'p1',$6,$7,$8::jsonb,$9::jsonb,$10,$10,1)`,[randomUUID(),sourceId,uuid,id,legacyMeeting,'8'.repeat(64),'9'.repeat(64),JSON.stringify(providerValues),JSON.stringify({meetingId:legacyMeeting,championshipId:'f1',championshipSeasonId:legacySeason}),evaluationAt]);
    await pool.query(`insert into reconciliation_policies(id,championship_id,championship_season_id,resource_kind,version,status,checksum,idempotency_key,request_fingerprint,actor_id,activated_at) values($1,'f1',$2,'event',2,'active',$3,$4,$3,'test',$5)`,[policyId,legacySeason,'8'.repeat(64),`p1-legacy-${policyId}`,evaluationAt]);
    for(const [field,klass] of [['name','DISPLAY'],['startsAt','SCHEDULE'],['endsAt','SCHEDULE'],['status','STATUS'],['sessionLabel','DISPLAY']] as const)await pool.query(`insert into reconciliation_policy_field_rules(id,policy_id,field_name,field_class,provider_priority) values($1,$2,$3,$4,'[["f56-a"]]')`,[randomUUID(),policyId,field,klass]);
    const legacyIds=['legacy-matrix-name','legacy-matrix-starts','legacy-matrix-ends','legacy-matrix-status','legacy-matrix-session'];
    const imported=(await pool.query(`select id,field_name from canonical_field_overrides where legacy_event_correction_id=any($1::text[]) order by field_name`,[legacyIds])).rows;
    expect(imported.map(row=>row.field_name)).toEqual(['ends_at','name','session_title','starts_at','status']);
    const overrideIds=imported.map(row=>String(row.id));
    const overridden=await service.preview({entityKind:'event',entityUuid:uuid,policyId,evaluationAt});
    expect(overridden.result.effectiveState).toMatchObject({name:'Admin Matrix',startsAt:'2026-12-10T10:00:00.000Z',endsAt:'2026-12-10T11:00:00.000Z',status:'scheduled',sessionLabel:'Admin FP1'});
    await service.apply({entityKind:'event',entityUuid:uuid,policyId,evaluationAt,previewChecksum:overridden.previewChecksum,idempotencyKey:'legacy-overridden',actorId:'test'});
    for(const overrideId of overrideIds)await overrideService.revoke({entityKind:'event',entityUuid:uuid,overrideId,actorId:'maintainer',reason:'explicit revoke',expectedRevision:1,idempotencyKey:`revoke-${overrideId}`});
    const providerPreview=await service.preview({entityKind:'event',entityUuid:uuid,policyId,evaluationAt});expect(providerPreview.result.effectiveState).toMatchObject(providerValues);
    await service.apply({entityKind:'event',entityUuid:uuid,policyId,evaluationAt,previewChecksum:providerPreview.previewChecksum,idempotencyKey:'legacy-revoked',actorId:'test'});
    expect((await pool.query('select name,status,session_title from events where id=$1',[id])).rows[0]).toMatchObject({name:'Provider Name',status:'cancelled',session_title:'Provider FP1'});
    expect((await pool.query('select count(*) count from canonical_field_override_history where override_id=any($1::uuid[])',[overrideIds])).rows[0].count).toBe('10');
  });

  it('P2 protects contribution snapshots and append-only evidence while journaling withdrawal',async()=>{
    const target=(await pool.query('select id from meeting_source_contributions where withdrawn_at is null limit 1')).rows[0].id,eventTarget=(await pool.query('select id from event_source_contributions limit 1')).rows[0].id;
    for(const mutation of [
      `normalization_version=normalization_version||'-tampered'`,`source_checksum=repeat(case when left(source_checksum,1)='f' then 'e' else 'f' end,64)`,`contribution_checksum=repeat(case when left(contribution_checksum,1)='e' then 'd' else 'e' end,64)`,`source_correction_provenance=source_correction_provenance||'[{"tampered":true}]'::jsonb`,`normalized_values=normalized_values||'{"tampered":true}'::jsonb`,`structural_references=structural_references||'{"tampered":true}'::jsonb`,`source_revision=source_revision+9999`,`source_entity_id='${randomUUID()}'`,`source_link_id='${randomUUID()}'`,`meeting_id='${randomUUID()}'`,`observed_at=observed_at+interval '1 second'`,`received_at=received_at+interval '1 second'`,`source_updated_at=coalesce(source_updated_at,observed_at)+interval '1 second'`
    ])await expect(pool.query(`update meeting_source_contributions set ${mutation} where id=$1`,[target])).rejects.toThrow('snapshot is immutable');
    for(const mutation of [`event_uuid='${randomUUID()}'`,`event_id='missing-event'`,`meeting_id='${randomUUID()}'`,`structural_references=structural_references||'{"tampered":true}'::jsonb`,`source_revision=source_revision+9999`])await expect(pool.query(`update event_source_contributions set ${mutation} where id=$1`,[eventTarget])).rejects.toThrow('snapshot is immutable');
    await expect(pool.query('delete from meeting_source_contributions where id=$1',[target])).rejects.toThrow('cannot be deleted');
    await expect(pool.query('delete from event_source_contributions where id=$1',[eventTarget])).rejects.toThrow('cannot be deleted');
    const before=Number((await pool.query(`select count(*) count from contribution_status_events where contribution_kind='meeting' and contribution_id=$1`,[target])).rows[0].count);
    await pool.query('update meeting_source_contributions set withdrawn_at=$2 where id=$1',[target,'2026-12-31T00:00:00Z']);
    expect(Number((await pool.query(`select count(*) count from contribution_status_events where contribution_kind='meeting' and contribution_id=$1`,[target])).rows[0].count)).toBe(before+1);
    expect((await pool.query('select withdrawn_at from meeting_source_contributions where id=$1',[target])).rowCount).toBe(1);
    for(const [table,id] of [
      ['reconciliation_runs',(await pool.query('select id from reconciliation_runs limit 1')).rows[0].id],
      ['reconciliation_field_decisions',(await pool.query('select id from reconciliation_field_decisions limit 1')).rows[0].id],
      ['canonical_field_override_history',(await pool.query('select id from canonical_field_override_history limit 1')).rows[0].id],
      ['canonical_override_mutations',(await pool.query('select id from canonical_override_mutations limit 1')).rows[0].id],
      ['contribution_status_events',(await pool.query('select id from contribution_status_events limit 1')).rows[0].id]
    ] as const){await expect(pool.query(`update ${table} set id=id where id=$1`,[id])).rejects.toThrow('append-only evidence');await expect(pool.query(`delete from ${table} where id=$1`,[id])).rejects.toThrow('append-only evidence');}
  });

  it('P2 derives canonical record identity and rejects spoofed Meeting/Event pairs without mutation',async()=>{
    const otherMeeting=randomUUID();await pool.query(`insert into meetings(id,championship_id,championship_season_id,name,season,timezone) values($1,'f1',$2,'Other identity',2026,'UTC')`,[otherMeeting,season]);
    const before=Number((await pool.query('select count(*) count from canonical_field_overrides')).rows[0].count);
    for(const command of [
      {entityKind:'meeting' as const,entityUuid:meeting,canonicalRecordId:otherMeeting},
      {entityKind:'meeting' as const,entityUuid:meeting,canonicalRecordId:eventId},
      {entityKind:'event' as const,entityUuid:eventUuid,canonicalRecordId:proofEventId},
      {entityKind:'event' as const,entityUuid:eventUuid,canonicalRecordId:String(meeting)},
      {entityKind:'meeting' as const,entityUuid:randomUUID(),canonicalRecordId:String(meeting)}
    ])await expect(overrideService.set({...command,fieldName:'name',value:'spoof',actorId:'test',reason:'P2 mismatch',expectedRevision:0,idempotencyKey:`p2-${randomUUID()}`})).rejects.toThrow();
    expect(Number((await pool.query('select count(*) count from canonical_field_overrides')).rows[0].count)).toBe(before);
    const validMeeting=await overrideService.set({entityKind:'meeting',entityUuid:otherMeeting,fieldName:'name',value:'Valid Meeting',actorId:'test',reason:'P2 valid',expectedRevision:0,idempotencyKey:'p2-valid-meeting'});
    const validEvent=await overrideService.set({entityKind:'event',entityUuid:proofEventUuid,fieldName:'sessionLabel',value:'Valid Event',actorId:'test',reason:'P2 valid',expectedRevision:0,idempotencyKey:'p2-valid-event'});
    expect(validMeeting.override.canonical_record_id).toBe(String(otherMeeting));expect(validEvent.override.canonical_record_id).toBe(proofEventId);
    const afterValid=Number((await pool.query('select count(*) count from canonical_field_overrides')).rows[0].count);
    await expect(overrideService.set({entityKind:'meeting',entityUuid:otherMeeting,fieldName:'venueId',value:randomUUID(),actorId:'test',reason:'missing venue',expectedRevision:0,idempotencyKey:'p2-missing-venue'})).rejects.toThrow('venue_not_found');
    await expect(overrideService.set({entityKind:'event',entityUuid:proofEventUuid,fieldName:'sessionType',value:'missing-session-type',actorId:'test',reason:'missing type',expectedRevision:0,idempotencyKey:'p2-missing-type'})).rejects.toThrow('session_type_not_found');
    expect(Number((await pool.query('select count(*) count from canonical_field_overrides')).rows[0].count)).toBe(afterValid);
    const venueA=randomUUID(),venueB=randomUUID(),layoutB=randomUUID();
    await pool.query(`insert into venues(id,key,name,kind_key) values($1,$2,'P2 Venue A','circuit'),($3,$4,'P2 Venue B','circuit')`,[venueA,`p2-a-${venueA}`,venueB,`p2-b-${venueB}`]);
    await pool.query(`insert into venue_layouts(id,venue_id,key,name) values($1,$2,'layout','Wrong venue layout')`,[layoutB,venueB]);
    await overrideService.set({entityKind:'meeting',entityUuid:otherMeeting,fieldName:'venueId',value:venueA,actorId:'test',reason:'valid venue',expectedRevision:0,idempotencyKey:'p2-valid-venue'});
    const beforeWrongLayout=Number((await pool.query('select count(*) count from canonical_field_overrides')).rows[0].count);
    await expect(overrideService.set({entityKind:'meeting',entityUuid:otherMeeting,fieldName:'venueLayoutId',value:layoutB,actorId:'test',reason:'wrong venue layout',expectedRevision:0,idempotencyKey:'p2-wrong-layout'})).rejects.toThrow('venue_layout_scope_invalid');
    expect(Number((await pool.query('select count(*) count from canonical_field_overrides')).rows[0].count)).toBe(beforeWrongLayout);
  });

  it('P2 exposes planner-usable canonical-target and semantic-revision indexes',async()=>{
    const indexes=(await pool.query(`select indexname from pg_indexes where tablename in('meeting_source_contributions','event_source_contributions')`)).rows.map(row=>row.indexname);
    expect(indexes).toContain('meeting_source_contributions_target_revision_idx');expect(indexes).toContain('event_source_contributions_target_revision_idx');expect(indexes).toContain('meeting_source_contributions_source_revision_idx');expect(indexes).toContain('event_source_contributions_source_revision_idx');
    const client=await pool.connect();try{
      await client.query('begin');
      await client.query(`insert into meeting_source_contributions(id,source_entity_id,source_link_id,meeting_id,normalization_version,source_checksum,contribution_checksum,normalized_values,structural_references,observed_at,received_at,source_revision) select gen_random_uuid(),$1,$1,$2,'planner',$3,encode(sha256(convert_to('meeting-'||series,'UTF8')),'hex'),'{}','{}',$4,$4,1000+series from generate_series(1,1000) series`,[source,meeting,'a'.repeat(64),evaluationAt]);
      await client.query(`insert into event_source_contributions(id,source_entity_id,source_link_id,event_uuid,event_id,meeting_id,normalization_version,source_checksum,contribution_checksum,normalized_values,structural_references,observed_at,received_at,source_revision) select gen_random_uuid(),$1,$1,$2,$3,$4,'planner',$5,encode(sha256(convert_to('event-'||series,'UTF8')),'hex'),'{}',$6::jsonb,$7,$7,1000+series from generate_series(1,1000) series`,[eventSourceA,eventUuid,eventId,meeting,'2'.repeat(64),JSON.stringify({meetingId:meeting,championshipSeasonId:season}),evaluationAt]);
      await client.query('analyze meeting_source_contributions');await client.query('analyze event_source_contributions');await client.query('set local enable_seqscan=off');await client.query('set local enable_sort=off');await client.query('set local enable_incremental_sort=off');
      const meetingPlan=JSON.stringify((await client.query(`explain(format json) select * from meeting_source_contributions where meeting_id=$1 order by source_entity_id,source_revision,contribution_checksum,id`,[meeting])).rows[0]['QUERY PLAN']),eventPlan=JSON.stringify((await client.query(`explain(format json) select * from event_source_contributions where event_uuid=$1 order by source_entity_id,source_revision,contribution_checksum,id`,[eventUuid])).rows[0]['QUERY PLAN']);
      expect(meetingPlan).toContain('meeting_source_contributions_target_revision_idx');expect(eventPlan).toContain('event_source_contributions_target_revision_idx');await client.query('rollback');
    }finally{client.release();}
  });
});
