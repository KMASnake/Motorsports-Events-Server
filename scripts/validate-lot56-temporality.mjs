import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pool} from '../apps/api/dist/lib/db.js';
import {DurableAcquisitionOrchestrator} from '../apps/api/dist/providers/acquisitionOrchestrator.js';

const provider='56e00000-0000-0000-0000-000000000001';
const link='56e00000-0000-0000-0000-000000000002';
const stream='56e00000-0000-0000-0000-000000000003';
let now=new Date('2026-08-21T12:00:00Z');
const clock={now:()=>new Date(now)};
const service=new DurableAcquisitionOrchestrator(clock);
const gate={beforeRequest:async()=>({allowed:true}),afterResponse:async()=>{},afterError:async()=>{}};
const fetchInput=()=>({providerInstanceId:provider,providerConfig:{},credentials:{},requestGate:gate,providerChampionshipId:link,championshipId:'f1',sourceConfig:{},phase:'current',season:2026,cursor:{},signal:new AbortController().signal});
const item=(externalId,status,start,end=null,type='race')=>({entityKind:'event',externalId,identityIsSynthetic:false,parentExternalId:null,parentEntityKind:null,season:2026,sourceData:{status,type,starts_at:start,...(end?{ends_at:end}:{})}});
const lease=async worker=>{const generation=Number((await pool.query('select lease_generation from sync_streams where id=$1',[stream])).rows[0].lease_generation)+1,runId=randomUUID(),expires=new Date(now.getTime()+600000);await pool.query(`update sync_streams set state='running',lease_owner=$2,lease_acquired_at=$3,lease_expires_at=$4,lease_generation=$5 where id=$1`,[stream,worker,now,expires,generation]);await pool.query(`insert into sync_runs(id,stream_id,worker_id,lease_generation,work_class,cursor_before,status,request_id) values($1,$2,$3,$4,'current','{}','running',$5)`,[runId,stream,worker,generation,randomUUID()]);return {streamId:stream,runId,workerId:worker,generation};};
const acquire=async(items,worker)=>service.executeLease({providerInstanceId:provider,providerChampionshipId:link,season:2026,dispatchCounter:1,lease:await lease(worker),adapter:{fetchWorkUnit:async input=>{await input.requestGate.beforeRequest();return {status:'complete',items,itemAnomalies:[],nextCursor:{},requestCount:1,complete:true,completionReason:'end_of_collection'};}},fetchInput:fetchInput()});
const anomaly=externalId=>pool.query(`select * from provider_acquisition_anomalies where anomaly_key=$1 order by created_at`,[`event_not_finalized_after_grace_period:${externalId}`]);

try{
  await pool.query(`insert into provider_instances(id,adapter_key,name,enabled,state) values($1,'lot56-e-fixture','Lot 5.6-E',true,'active')`,[provider]);
  await pool.query(`insert into provider_championships(id,provider_instance_id,championship_id,external_championship_id,discovery_state,sync_state,is_primary,acquisition_finalization_grace_days) values($1,$2,'f1','lot56-e-f1','configured','active',true,30)`,[link,provider]);
  await pool.query(`insert into sync_streams(id,provider_championship_id,phase,state,cursor_version,cursor) values($1,$2,'current','ready',1,'{}')`,[stream,link]);

  await acquire([
    item('t30','scheduled','2026-07-22T10:00:00Z','2026-07-22T12:00:00Z'),
    item('t29','scheduled','2026-07-23T10:00:00Z','2026-07-23T12:00:00Z'),
    item('cancelled','cancelled','2026-01-01T10:00:00Z','2026-01-01T12:00:00Z'),
    item('postponed','scheduled','2026-01-02T10:00:00Z','2026-01-02T12:00:00Z','isolated')
  ],'initial');
  assert.equal((await anomaly('t30')).rowCount,1);
  assert.equal((await anomaly('t29')).rowCount,0);
  assert.equal((await anomaly('cancelled')).rowCount,0);
  assert.equal((await anomaly('postponed')).rowCount,1);
  const trace=(await pool.query(`select end_estimated,end_provenance,end_estimation_details from provider_source_entities where external_id='t30'`)).rows[0];
  assert.equal(trace.end_estimated,false);assert.equal(trace.end_provenance,'provider');assert.equal(trace.end_estimation_details.logic_version,'lot56-e-v1');
  await service.evaluateFinalization(link);await service.evaluateFinalization(link);
  assert.equal((await anomaly('t30')).rowCount,1);

  await acquire([
    item('t30','completed','2026-07-22T10:00:00Z','2026-07-22T12:00:00Z'),
    item('postponed','postponed','2026-09-10T10:00:00Z',null,'isolated')
  ],'replay');
  assert.equal((await anomaly('t30')).rows[0].state,'resolved');
  assert.equal((await anomaly('postponed')).rows[0].state,'resolved');
  const postponed=(await pool.query(`select theoretical_end_at,end_provenance,end_estimation_details from provider_source_entities where external_id='postponed'`)).rows[0];
  assert.equal(new Date(postponed.theoretical_end_at).toISOString(),'2026-09-10T23:59:59.999Z');
  assert.equal(postponed.end_provenance,'civil_day_fallback');
  assert.equal(postponed.end_estimation_details.logic_version,'lot56-e-v1');
  assert.equal(await service.chooseWork(link,0,'current'),'finalization');
  console.log('T+29/T+30, idempotence, completed, cancelled, postponed, trace et rejeu : OK');
  console.log('Aucune normalisation métier ni surface 5.7 : OK');
}finally{await pool.end();}
