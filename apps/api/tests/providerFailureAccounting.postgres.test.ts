import {randomUUID} from 'node:crypto';
import {afterAll,describe,expect,it,vi} from 'vitest';
import {pool} from '../src/lib/db.js';
import type {ProviderRequestGate} from '../src/providers/contracts.js';
import {fetchProviderJson} from '../src/providers/providerHttp.js';
import {QuotaCadenceService} from '../src/providers/quotaCadenceService.js';

const enabled=process.env.RUN_R1_A2_1_ACCOUNTING_POSTGRES==='1';
describe.skipIf(!enabled)('R1-A2.1 charge-id accounting on disposable PostgreSQL',()=>{
  afterAll(async()=>{await pool.end();});
  it.each([200,429])('does not double-account HTTP %s when the committed callback subsequently fails',async status=>{
    const id=randomUUID(),now=new Date('2026-01-01T00:00:00Z'),quota=new QuotaCadenceService({now:()=>now},()=>0);
    await pool.query("insert into provider_instances(id,adapter_key,name,enabled,state,config) values($1,'fixture','A2.1 synthetic accounting',true,'active','{}')",[id]);
    try{
      await pool.query("insert into provider_quota_policies(provider_instance_id,minute_limit,minimum_interval_seconds,current_reserve_mode,current_reserve_value,provider_timezone,limits_source) values($1,10,0,'absolute',0,'UTC','configured')",[id]);
      let chargeId:string|undefined;
      const afterError=vi.fn(async(charge:string,error:{code:string})=>quota.recordOutcome(charge,{errorCode:error.code}));
      const gate:ProviderRequestGate={failureDomain:'accounting',beforeRequest:async()=>{const decision=await quota.authorize(id,'current');chargeId=decision.chargeId;return decision;},afterResponse:async(charge,metadata)=>{await quota.recordOutcome(charge,{metadata});throw new Error('synthetic failure after commit');},afterError};
      const fetchImpl=vi.fn(async()=>Response.json({ok:status===200},{status,headers:{'retry-after':'60'}}));
      await expect(fetchProviderJson({url:new URL('https://provider.fixture.test/data'),allowedHosts:['provider.fixture.test'],fetchImpl,gate,now:()=>now})).rejects.toMatchObject({classification:{category:'INTERNAL_ACCOUNTING_ERROR',httpStatus:status,providerResponseReceived:true}});
      expect(afterError).not.toHaveBeenCalled();expect(fetchImpl).toHaveBeenCalledOnce();expect(chargeId).toBeDefined();
      // Replayed/concurrent late outcomes for the same charge must remain no-ops.
      await Promise.all([quota.recordOutcome(chargeId!,{errorCode:'network_error'}),quota.recordOutcome(chargeId!,{metadata:{status:429,headers:{}}})]);
      const charge=(await pool.query('select emitted,outcome from provider_request_charges where id=$1',[chargeId])).rows[0];
      const runtime=(await pool.query('select provider_failure_count from provider_quota_runtime where provider_instance_id=$1',[id])).rows[0];
      const windows=(await pool.query('select consumed from provider_quota_windows where provider_instance_id=$1',[id])).rows;
      expect(charge).toEqual({emitted:true,outcome:String(status)});expect(Number(runtime.provider_failure_count)).toBe(status===429?1:0);
      expect(windows).toHaveLength(4);expect(windows.every(row=>Number(row.consumed)===1)).toBe(true);
    }finally{await pool.query('delete from provider_instances where id=$1',[id]);}
  });
});
