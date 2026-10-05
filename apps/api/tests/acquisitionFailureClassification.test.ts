import {describe,expect,it,vi} from 'vitest';
import {AcquisitionTransactionService} from '../src/providers/acquisitionTransactionService.js';
import {ProviderHttpError} from '../src/providers/providerHttp.js';
import type {PersistentSchedulerService} from '../src/providers/schedulerService.js';

const database=vi.hoisted(()=>({query:vi.fn(async(sql:string)=>({rowCount:1,rows:sql.startsWith('select historical_state')?[{historical_state:{}}]:[]})),release:vi.fn()}));
vi.mock('../src/lib/db.js',()=>({pool:{connect:async()=>database,query:database.query}}));

describe('R1-A2.1 acquisition transaction error boundary',()=>{
  it.each(['http','internal'])('preserves %s classification while retaining existing durable failure behavior',async kind=>{
    const fail=vi.fn(async()=>undefined),service=new AcquisitionTransactionService({fail} as unknown as PersistentSchedulerService);
    const error=kind==='http'?new ProviderHttpError('http_503','Upstream failure',503,null,null,{providerResponseReceived:true,headers:{'retry-after':'60'},retryAfterAt:'2026-01-01T00:01:00.000Z'}):new Error('internal');
    const fetchWorkUnit=vi.fn(async()=>{throw error;});
    const input={providerInstanceId:'provider-fixture',providerChampionshipId:'link-fixture',season:2026,workClass:'current_global',safeUnitKey:'fixture',lease:{streamId:'stream-fixture',runId:'run-fixture',workerId:'synthetic-test',generation:1},adapter:{fetchWorkUnit},fetchInput:{cursor:{page:1}}} as unknown as Parameters<typeof service.executeUnit>[0];
    await expect(service.executeUnit(input)).rejects.toBe(error);
    expect(error).toMatchObject({traversalId:expect.any(String),classification:kind==='http'?{category:'HTTP_TRANSIENT',httpStatus:503,providerResponseReceived:true,headers:{'retry-after':'60'},retryAfterAt:'2026-01-01T00:01:00.000Z'}:{category:'INTERNAL_ERROR'}});
    expect(fail).toHaveBeenCalledExactlyOnceWith({...input.lease,durable:true,code:'acquisition_failed'});
    expect(fetchWorkUnit).toHaveBeenCalledOnce();
  });
});
