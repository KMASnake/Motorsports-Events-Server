import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pool} from '../apps/api/dist/lib/db.js';
import {DurableAcquisitionOrchestrator} from '../apps/api/dist/providers/acquisitionOrchestrator.js';

const phase=process.argv[2];
assert.ok(phase==='phase-a'||phase==='phase-b','phase-a ou phase-b requis');
const provider='56e10000-0000-0000-0000-000000000001';
const link='56e10000-0000-0000-0000-000000000002';
const stream='56e10000-0000-0000-0000-000000000003';
let now=new Date(phase==='phase-a'?'2026-01-15T12:00:00Z':'2026-06-15T12:00:00Z');
const service=new DurableAcquisitionOrchestrator({now:()=>new Date(now)});
const gate={beforeRequest:async()=>({allowed:true}),afterResponse:async()=>{},afterError:async()=>{}};
const fetchInput=season=>({providerInstanceId:provider,providerConfig:{},credentials:{},requestGate:gate,providerChampionshipId:link,championshipId:'f1',sourceConfig:{},phase:'current',season,cursor:{},signal:new AbortController().signal});
const item=(externalId,season,start,end)=>({entityKind:'event',externalId,identityIsSynthetic:false,parentExternalId:null,parentEntityKind:null,season,sourceData:{status:'scheduled',type:'race',starts_at:start,ends_at:end}});
const lease=async worker=>{const generation=Number((await pool.query('select lease_generation from sync_streams where id=$1',[stream])).rows[0].lease_generation)+1,runId=randomUUID(),expires=new Date(now.getTime()+600000);await pool.query(`update sync_streams set state='running',lease_owner=$2,lease_acquired_at=$3,lease_expires_at=$4,lease_generation=$5 where id=$1`,[stream,worker,now,expires,generation]);await pool.query(`insert into sync_runs(id,stream_id,worker_id,lease_generation,work_class,cursor_before,status,request_id) values($1,$2,$3,$4,'current','{}','running',$5)`,[runId,stream,worker,generation,randomUUID()]);return {streamId:stream,runId,workerId:worker,generation};};
const execute=async(season,items,worker,dispatchCounter)=>service.executeLease({providerInstanceId:provider,providerChampionshipId:link,season,dispatchCounter,lease:await lease(worker),adapter:{fetchWorkUnit:async input=>{await input.requestGate.beforeRequest();return {status:'complete',items,itemAnomalies:[],nextCursor:{},requestCount:1,complete:true,completionReason:'end_of_collection'};}},fetchInput:fetchInput(season)});

try{
  if(phase==='phase-a'){
    await pool.query(`insert into championships(id,slug,name,season,active,sync_enabled) values('lot56-e-restart','lot56-e-restart','Lot 5.6-E restart',2026,true,false)`);
    await pool.query(`insert into provider_instances(id,adapter_key,name,enabled,state) values($1,'lot56-e-restart','Lot 5.6-E restart',true,'active')`,[provider]);
    await pool.query(`insert into provider_championships(id,provider_instance_id,championship_id,external_championship_id,discovery_state,sync_state,is_primary,acquisition_finalization_grace_days) values($1,$2,'lot56-e-restart','lot56-e-restart-f1','configured','active',true,30)`,[link,provider]);
    await pool.query(`insert into sync_streams(id,provider_championship_id,phase,state,cursor_version,cursor) values($1,$2,'current','ready',1,'{}')`,[stream,link]);
    await execute(2026,[item('restart-2025',2025,'2025-12-31T10:00:00Z','2025-12-31T12:00:00Z'),item('restart-2026',2026,'2026-06-01T10:00:00Z','2026-06-01T12:00:00Z')],'restart-phase-a-seed',1);
    await execute(2025,[],'restart-phase-a-finalization',0);
    const state=(await pool.query('select finalization_cursor_season from provider_acquisition_state where provider_championship_id=$1',[link])).rows[0];
    assert.equal(Number(state.finalization_cursor_season),2025);
    assert.equal((await pool.query(`select count(*)::int count from provider_acquisition_traversals where stream_id=$1 and safe_unit_key='finalization:2025' and complete=true`,[stream])).rows[0].count,1);
    console.log('Phase A : curseur finalization 2025 persisté ; processus terminé.');
  }else{
    const persisted=(await pool.query('select finalization_cursor_season from provider_acquisition_state where provider_championship_id=$1',[link])).rows[0];
    assert.equal(Number(persisted.finalization_cursor_season),2025);
    await execute(2026,[],'restart-phase-b-finalization',0);
    const resumed=(await pool.query('select finalization_cursor_season from provider_acquisition_state where provider_championship_id=$1',[link])).rows[0];
    assert.equal(Number(resumed.finalization_cursor_season),2026);
    now=new Date('2026-07-02T12:00:01Z');
    await service.evaluateFinalization(link);
    await service.evaluateFinalization(link);
    assert.equal((await pool.query(`select count(*)::int count from provider_source_entities where provider_championship_id=$1 and external_id in('restart-2025','restart-2026')`,[link])).rows[0].count,2);
    assert.equal((await pool.query(`select count(*)::int count from provider_acquisition_anomalies where provider_championship_id=$1 and anomaly_type='event_not_finalized_after_grace_period' and state='active'`,[link])).rows[0].count,2);
    assert.equal((await pool.query(`select count(*)::int count from provider_acquisition_traversals where stream_id=$1 and safe_unit_key in('finalization:2025','finalization:2026') and complete=true`,[stream])).rows[0].count,2);
    console.log('Phase B : reprise 2026, curseur, traversals, entités et anomalies idempotentes : OK.');
  }
}finally{await pool.end();}
