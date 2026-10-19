import {describe,it,expect} from 'vitest';
import {exactGeneration,type AuthoritySnapshot,type ExecutionResult,type ProviderRequestIntent,type SimulatedTransport} from '../src/providers/executionAuthorityContract.js';
import {barrier,DeterministicClock,InMemoryAuthority,SimulatedAuthorityExecutor,type Boundary} from './support/authorityConcurrencyHarness.js';

// Oracle knows only invocation and remote receipt, not the implementation's guards.
class TransportOracle implements SimulatedTransport {
 readonly mode='SIMULATED_ONLY' as const;
 private readonly events:{event:'invocation'|'receipt';intentId:string;generation:string;at:number}[]=[];
 beforeReceipt:()=>Promise<void>=async()=>{};
 constructor(private readonly clock:DeterministicClock){}
 async invoke(intent:ProviderRequestIntent,signal:AbortSignal){
  void signal; // Remote receipt is intentionally independent of local cancellation.
  const generation=intent.authority.kind==='manual'?'manual':intent.authority.generation;
  this.events.push({event:'invocation',intentId:intent.intentId,generation,at:this.clock.authorityNowMs()});
  await this.beforeReceipt();
  // A simulated remote can still receive after local cancellation/revocation.
  this.events.push({event:'receipt',intentId:intent.intentId,generation,at:this.clock.authorityNowMs()});
  return {responseDigest:'synthetic-response'};
 }
 read(){return structuredClone(this.events);}
}
function fixture(pause:(boundary:Boundary)=>Promise<void>=async()=>{}){
 const clock=new DeterministicClock(),generation=exactGeneration('9007199254740993');
 const intent:ProviderRequestIntent={intentId:'intent-1',providerId:'synthetic-provider',sourceId:'source',configurationRevision:'r1',mappingId:'mapping',season:2026,workClass:'current_global',logicalUnitKey:'page:1',endpoint:'season-page',method:'GET',parametersDigest:'synthetic-digest',operationalEpoch:exactGeneration('1'),executorIncarnation:'incarnation-1',authority:{kind:'acquisition',workerId:'worker-a',generation,streamId:'stream',runId:'run',traversalId:'traversal'}};
 const snapshot:AuthoritySnapshot={providerId:intent.providerId,sourceId:intent.sourceId,configurationRevision:intent.configurationRevision,mappingId:intent.mappingId,season:intent.season,workClass:intent.workClass,logicalUnitKey:intent.logicalUnitKey,operationalEpoch:intent.operationalEpoch,executorIncarnation:intent.executorIncarnation,authority:intent.authority,leaseExpiresAtMs:1100,active:true,revoked:false,heartbeatCertain:true};
 const authority=new InMemoryAuthority(snapshot),oracle=new TransportOracle(clock),executor=new SimulatedAuthorityExecutor(authority,clock,oracle,pause,8,2,true),cancel=new AbortController(),caller={role:'worker' as const,workerId:'worker-a'};
 return {clock,intent,authority,oracle,executor,cancel,caller,execute:()=>executor.execute(intent,cancel.signal,caller)};
}
function paused(boundary:Boundary){const entered=barrier(),resume=barrier();return {entered,resume,hook:async(at:Boundary)=>{if(at===boundary){entered.release();await resume.wait;}}};}

describe('A3-01 isolated authority contract (no physical fencing claim)',()=>{
 it.each(['0','-1','01','1.5','1e3','', ' 1'])('rejects noncanonical generation %s',value=>expect(()=>exactGeneration(value)).toThrow('invalid_generation'));
 it.each([1,NaN,null,undefined,9007199254740992])('never coerces non-string generation %s',value=>expect(()=>exactGeneration(value as unknown as string)).toThrow('invalid_generation'));
 it('keeps bigint generations exact beyond Number precision',()=>{const f=fixture();expect(f.intent.authority.kind==='acquisition'&&f.intent.authority.generation).toBe('9007199254740993');});
 it('valid authority produces separate admission, invocation and receipt observations',async()=>{const f=fixture();expect(await f.executor.admit(f.intent,f.caller)).toEqual({accepted:true,state:'RESERVED'});expect(f.oracle.read()).toEqual([]);expect(await f.execute()).toMatchObject({state:'RESPONSE',businessPersistenceAuthorized:false});expect(f.oracle.read().map(e=>e.event)).toEqual(['invocation','receipt']);});
 it.each([-1,0,1])('HF01 expiry offset %s is fail-closed at equality and beyond',async offset=>{const f=fixture();f.clock.advance(100+offset);const result=await f.execute();expect(result.state).toBe(offset<0?'CANCELLED_NOT_SENT':'DENIED');expect(result.reason).toBe(offset<0?'deadline':'expired');expect(f.oracle.read()).toEqual([]);});
 it.each(['INITIAL_READ','RESERVED','FINAL_ADMISSION'] as const)('revocation at %s refuses before invocation',async boundary=>{const p=paused(boundary),f=fixture(p.hook),pending=f.execute();await p.entered.wait;f.authority.snapshot={...f.authority.snapshot!,revoked:true};p.resume.release();expect((await pending).reason).toBe('revoked');expect(f.oracle.read()).toEqual([]);});
 it.each(['RESERVED','FINAL_ADMISSION'] as const)('expiration while paused at %s refuses before invocation',async boundary=>{const p=paused(boundary),f=fixture(p.hook),pending=f.execute();await p.entered.wait;f.clock.advance(100);p.resume.release();expect((await pending).state).not.toBe('RESPONSE');expect(f.oracle.read()).toEqual([]);});
 it('HF02 supersession after initial check is rejected with exact generation',async()=>{const p=paused('INITIAL_READ'),f=fixture(p.hook),pending=f.execute();await p.entered.wait;f.authority.snapshot={...f.authority.snapshot!,authority:{...f.intent.authority,kind:'acquisition',workerId:'worker-b',generation:exactGeneration('9007199254740994'),streamId:'stream',runId:'new-run',traversalId:'traversal'}};p.resume.release();expect((await pending).reason).toBe('identity_mismatch');expect(f.oracle.read()).toEqual([]);});
 it.each(['sourceId','mappingId','configurationRevision','operationalEpoch','executorIncarnation','logicalUnitKey'] as const)('rejects mismatched %s',async field=>{const f=fixture();f.authority.snapshot={...f.authority.snapshot!,[field]:'different'} as AuthoritySnapshot;expect((await f.execute()).reason).toBe('identity_mismatch');expect(f.oracle.read()).toEqual([]);});
 it.each(['revoked','inactive','uncertain','missing'] as const)('fails closed for %s authority',async mode=>{const f=fixture();f.authority.snapshot=mode==='missing'?null:{...f.authority.snapshot!,revoked:mode==='revoked',active:mode!=='inactive',heartbeatCertain:mode!=='uncertain'};expect((await f.execute()).state).toBe('DENIED');expect(f.oracle.read()).toEqual([]);});
 it('HF05 concurrent duplicate consumers invoke once',async()=>{const f=fixture(),received=barrier(),invoked=barrier();f.oracle.beforeReceipt=async()=>{invoked.release();await received.wait;};const first=f.execute();await invoked.wait;expect((await f.execute()).state).toBe('DISPATCHING');received.release();const result=await first;expect(await f.execute()).toEqual(result);expect(f.oracle.read().filter(e=>e.event==='invocation')).toHaveLength(1);});
 it('races initial duplicate admission without issuing twice',async()=>{const f=fixture();const results=await Promise.all([f.execute(),f.execute()]);expect(results.some(r=>r.state==='RESPONSE')).toBe(true);expect(f.oracle.read().filter(e=>e.event==='invocation')).toHaveLength(1);});
 it('HF06 concurrent workers/intents sharing authority admit only one in-flight request',async()=>{const f=fixture(),received=barrier(),invoked=barrier();f.oracle.beforeReceipt=async()=>{invoked.release();await received.wait;};const first=f.execute();await invoked.wait;const second=await f.executor.execute({...f.intent,intentId:'worker-b-intent'},f.cancel.signal,f.caller);expect(second.reason).toBe('domain_busy');received.release();await first;expect(f.oracle.read().filter(e=>e.event==='invocation')).toHaveLength(1);});
 it('rejects intent ID reuse with a different payload',async()=>{const f=fixture();await f.execute();expect((await f.executor.execute({...f.intent,parametersDigest:'other'},f.cancel.signal,f.caller)).reason).toBe('identity_mismatch');expect(f.oracle.read()).toHaveLength(2);});
 it('HF07 abort before admission has no invocation',async()=>{const f=fixture();f.cancel.abort();expect((await f.execute()).state).toBe('CANCELLED_NOT_SENT');expect(f.oracle.read()).toEqual([]);});
 it('cancels an existing reservation without leaving the domain busy',async()=>{const f=fixture();await f.executor.admit(f.intent,f.caller);f.cancel.abort();expect((await f.execute()).state).toBe('CANCELLED_NOT_SENT');expect((await f.executor.execute({...f.intent,intentId:'next'},new AbortController().signal,f.caller)).state).toBe('RESPONSE');});
 it('abort after reservation proves not-sent',async()=>{const p=paused('RESERVED'),f=fixture(p.hook),pending=f.execute();await p.entered.wait;f.cancel.abort();p.resume.release();expect((await pending).state).toBe('CANCELLED_NOT_SENT');expect(f.oracle.read()).toEqual([]);});
 it('HF04 characterizes late invocation after suspension AFTER the last local check',async()=>{const p=paused('AFTER_LAST_LOCAL_CHECK'),f=fixture(p.hook),pending=f.execute();await p.entered.wait;f.clock.advance(101);f.authority.snapshot={...f.authority.snapshot!,revoked:true};p.resume.release();expect((await pending).state).toBe('RESPONSE');expect(f.oracle.read()[0].at).toBeGreaterThanOrEqual(1100);expect(f.oracle.read()[0].event).toBe('invocation');console.info('A3_01_LATE_INVOCATION_COUNTEREXAMPLE='+JSON.stringify(f.oracle.read()));});
 it('suspension in-flight can yield remote receipt after revocation/cancellation',async()=>{const f=fixture(),invoked=barrier(),receive=barrier();f.oracle.beforeReceipt=async()=>{invoked.release();await receive.wait;};const pending=f.execute();await invoked.wait;f.authority.snapshot={...f.authority.snapshot!,revoked:true};f.cancel.abort();f.clock.advance(101);receive.release();const result=await pending;expect(f.oracle.read().map(e=>e.at)).toEqual([1000,1101]);console.info('A3_01_LATE_RECEIPT_COUNTEREXAMPLE='+JSON.stringify(f.oracle.read()));expect(result.businessPersistenceAuthorized).toBe(false);expect((await f.executor.execute({...f.intent,intentId:'next-page'},new AbortController().signal,f.caller)).reason).toBe('revoked');});
 it('HF09 interruption marks uncertainty, late response cannot reopen or retry',async()=>{const f=fixture(),invoked=barrier(),receive=barrier();f.oracle.beforeReceipt=async()=>{invoked.release();await receive.wait;};const pending=f.execute();await invoked.wait;f.executor.interrupt();receive.release();expect((await pending).state).toBe('UNKNOWN');expect((await f.execute()).state).toBe('UNKNOWN');expect((await f.executor.execute({...f.intent,intentId:'successor'},new AbortController().signal,f.caller)).state).toBe('DENIED');expect(f.oracle.read().filter(e=>e.event==='invocation')).toHaveLength(1);});
 it('interruption before dispatch proves not-sent and cannot restart that intent',async()=>{const p=paused('RESERVED'),f=fixture(p.hook),pending=f.execute();await p.entered.wait;f.executor.interrupt();p.resume.release();expect((await pending).state).toBe('CANCELLED_NOT_SENT');expect((await f.execute()).state).toBe('CANCELLED_NOT_SENT');expect(f.oracle.read()).toEqual([]);});
 it('restart defaults closed and does not claim durable recovery',async()=>{const f=fixture(),restart=new SimulatedAuthorityExecutor(f.authority,f.clock,f.oracle);expect((await restart.execute(f.intent,f.cancel.signal,f.caller)).reason).toBe('executor_closed');expect(f.oracle.read()).toEqual([]);});
 it('ambiguous transport outcome blocks successor even with valid authority',async()=>{const f=fixture();f.oracle.beforeReceipt=async()=>{throw new Error('synthetic_lost_response');};expect((await f.execute()).state).toBe('UNKNOWN');expect((await f.executor.execute({...f.intent,intentId:'new'},f.cancel.signal,f.caller)).reason).toBe('domain_unknown');expect(f.oracle.read().map(e=>e.event)).toEqual(['invocation']);});
 it('keeps the execution identity immutable while paused',async()=>{const p=paused('RESERVED'),f=fixture(p.hook),pending=f.execute();await p.entered.wait;(f.intent as unknown as {intentId:string}).intentId='mutated';p.resume.release();expect((await pending).intentId).toBe('intent-1');expect(f.oracle.read()[0].intentId).toBe('intent-1');});
 it('models discovery identity without inventing a stream lease',async()=>{const f=fixture(),authority={kind:'discovery' as const,workerId:'discovery-worker',generation:exactGeneration('2'),discoveryRunId:'discovery-run'};const intent={...f.intent,endpoint:'championship-discovery' as const,authority};f.authority.snapshot={...f.authority.snapshot!,authority};expect((await f.executor.execute(intent,f.cancel.signal,{role:'worker',workerId:'discovery-worker'})).state).toBe('RESPONSE');});
 it('manual authority is representable but unsupported by the isolated executor',async()=>{const f=fixture();const result=await f.executor.execute({...f.intent,authority:{kind:'manual',administrativeRequestId:'admin-request',approvedScopeId:'dedicated-scope'}},f.cancel.signal,f.caller);expect(result.reason).toBe('unsupported_authority');expect(f.oracle.read()).toEqual([]);});
 it.each(['administrator','client','different-worker'] as const)('does not trust borrowed intent identity from %s',async role=>{const f=fixture(),caller={role:role==='different-worker'?'worker' as const:role,workerId:role==='different-worker'?'worker-b':'worker-a'};expect((await f.executor.execute(f.intent,f.cancel.signal,caller)).reason).toBe('identity_mismatch');expect(f.oracle.read()).toEqual([]);});
 it('refuses unavailable authority before admission without transport',async()=>{const f=fixture();f.authority.read=async()=>{throw new Error('synthetic_read_failure');};expect((await f.execute()).reason).toBe('authority_unavailable');expect(f.oracle.read()).toEqual([]);});
 it('proves not-sent when authority read fails after reservation',async()=>{const p=paused('RESERVED'),f=fixture(p.hook),pending=f.execute();await p.entered.wait;f.authority.read=async()=>{throw new Error('synthetic_read_failure');};p.resume.release();expect((await pending).state).toBe('CANCELLED_NOT_SENT');expect(f.oracle.read()).toEqual([]);});
 it('all results keep business persistence authority separate',async()=>{const f=fixture(),results:ExecutionResult[]=[await f.execute(),await f.execute()];expect(results.every(r=>r.businessPersistenceAuthorized===false)).toBe(true);});

 // IA-A301-01: same exploit sequence as independent CE01, with safety assertions.
 it('CORR-01 CE01 mutation + aborted duplicate cannot release an active provider',async()=>{
  const f=fixture(),firstEntered=barrier(),secondEntered=barrier(),resume=barrier();let active=0,maxActive=0,calls=0;
  f.oracle.beforeReceipt=async()=>{calls++;active++;maxActive=Math.max(active,maxActive);if(calls===1)firstEntered.release();else secondEntered.release();await resume.wait;active--;};
  const first=f.execute();await firstEntered.wait;
  try{const alias=await f.execute();let rejected=false;try{(alias as {state:string}).state='RESERVED';}catch{rejected=true;}
   expect(Object.isFrozen(alias)).toBe(true);expect(rejected).toBe(true);expect(alias.state).toBe('DISPATCHING');
   const stop=new AbortController();stop.abort();expect((await f.executor.execute(f.intent,stop.signal,f.caller)).state).toBe('DISPATCHING');
   const next=f.executor.execute({...f.intent,intentId:'second'},new AbortController().signal,f.caller);
   const race=await Promise.race([secondEntered.wait.then(()=>'OVERLAP'),next.then(()=>'REFUSED')]);
   expect(race).toBe('REFUSED');expect((await next).reason).toBe('domain_busy');expect(maxActive).toBe(1);
   console.info('CORR_CE01='+JSON.stringify({race,maxActive,events:f.oracle.read()}));
  }finally{resume.release();await first;}
 });
 it('CORR-01 RESERVED duplicates and inspect expose frozen detached snapshots',async()=>{const p=paused('RESERVED'),f=fixture(p.hook),pending=f.execute();await p.entered.wait;try{const a=await f.execute(),b=await f.execute(),view=f.executor.inspect(f.intent.intentId)!;expect(a).not.toBe(b);expect(Object.isFrozen(a)).toBe(true);expect(Object.isFrozen(view)).toBe(true);expect(Reflect.set(a,'state','RESPONSE')).toBe(false);expect(Reflect.set(view,'state','CANCELLED_NOT_SENT')).toBe(false);}finally{p.resume.release();await pending;}expect(f.oracle.read().filter(e=>e.event==='invocation')).toHaveLength(1);});
 it.each(['authority','monotonic'] as const)('CORR-02 rejects non-finite/unsafe %s observations before admission',async kind=>{
  for(const value of [NaN,Infinity,-Infinity,Number.MAX_SAFE_INTEGER+1,0.5]){const f=fixture();if(kind==='authority')f.clock.authorityNowMs=()=>value;else f.clock.monotonicNowMs=()=>value;expect(await f.executor.admit(f.intent,f.caller)).toEqual({accepted:false,reason:'invalid_time'});expect(await f.execute()).toMatchObject({state:'CANCELLED_NOT_SENT',reason:'invalid_time'});expect(f.oracle.read()).toEqual([]);}
 });
 it.each(['authority','monotonic'] as const)('CORR-02 invalid %s at both preparation boundaries finalizes not-sent',async kind=>{
  for(const boundary of ['RESERVED','FINAL_ADMISSION'] as const)for(const value of [NaN,Infinity,-Infinity]){const p=paused(boundary),f=fixture(p.hook),pending=f.execute();await p.entered.wait;if(kind==='authority')f.clock.authorityNowMs=()=>value;else f.clock.monotonicNowMs=()=>value;p.resume.release();expect(await pending).toMatchObject({state:'CANCELLED_NOT_SENT',reason:'invalid_time'});expect(f.executor.inspect(f.intent.intentId)?.state).toBe('CANCELLED_NOT_SENT');expect(f.oracle.read()).toEqual([]);}
 });
 it.each(['authority','monotonic'] as const)('CORR-02 throwing %s clock returns a typed not-sent result',async kind=>{const f=fixture();if(kind==='authority')f.clock.authorityNowMs=()=>{throw new Error('clock_unavailable');};else f.clock.monotonicNowMs=()=>{throw new Error('clock_unavailable');};expect(await f.execute()).toMatchObject({state:'CANCELLED_NOT_SENT',reason:'invalid_time'});expect(f.oracle.read()).toEqual([]);});
 it.each(['authority','monotonic'] as const)('CORR-02 rejects %s regression after reservation',async kind=>{const p=paused('RESERVED'),f=fixture(p.hook),pending=f.execute();await p.entered.wait;if(kind==='authority')f.clock.resetWall(999);else f.clock.monotonicNowMs=()=>-1;p.resume.release();expect((await pending).reason).toBe('invalid_time');expect(f.oracle.read()).toEqual([]);});
 it('CORR-02 rejects a backward monotonic observation that remains nonnegative',async()=>{const p=paused('RESERVED'),f=fixture(p.hook);f.clock.advance(5);const pending=f.execute();await p.entered.wait;f.clock.monotonicNowMs=()=>4;p.resume.release();expect(await pending).toMatchObject({state:'CANCELLED_NOT_SENT',reason:'invalid_time'});expect(f.oracle.read()).toEqual([]);});
 it.each(['authority','monotonic'] as const)('CORR-02 invalid %s on execution replay closes an existing reservation',async kind=>{const f=fixture();await f.executor.admit(f.intent,f.caller);const originalAuthority=f.clock.authorityNowMs.bind(f.clock),originalMonotonic=f.clock.monotonicNowMs.bind(f.clock);if(kind==='authority')f.clock.authorityNowMs=()=>NaN;else f.clock.monotonicNowMs=()=>{throw new Error('clock_unavailable');};expect(await f.execute()).toMatchObject({state:'CANCELLED_NOT_SENT',reason:'invalid_time'});expect(f.executor.inspect(f.intent.intentId)?.state).toBe('CANCELLED_NOT_SENT');expect(f.oracle.read()).toEqual([]);f.clock.authorityNowMs=originalAuthority;f.clock.monotonicNowMs=originalMonotonic;expect((await f.executor.execute({...f.intent,intentId:'after-clock-recovery'},f.cancel.signal,f.caller)).state).toBe('RESPONSE');});
 it('CORR-02 rejects overflow without partially advancing the deterministic clock',()=>{const f=fixture();f.clock.resetWall(Number.MAX_SAFE_INTEGER);expect(()=>f.clock.advance(1)).toThrow('invalid_clock_advance');expect(f.clock.authorityNowMs()).toBe(Number.MAX_SAFE_INTEGER);expect(f.clock.monotonicNowMs()).toBe(0);});
 it('CORR-02 detects overflow when constructing a monotonic deadline',async()=>{const f=fixture();f.clock.monotonicNowMs=()=>Number.MAX_SAFE_INTEGER;expect(await f.execute()).toMatchObject({state:'CANCELLED_NOT_SENT',reason:'invalid_time'});expect(f.oracle.read()).toEqual([]);});
 it('CORR-02 detects invalid authority expiry and remaining-time arithmetic',async()=>{for(const expiry of [NaN,Infinity,-Infinity]){const f=fixture();f.authority.snapshot={...f.authority.snapshot!,leaseExpiresAtMs:expiry};expect((await f.execute()).reason).toBe('invalid_time');expect(f.oracle.read()).toEqual([]);}const f=fixture();f.clock.resetWall(-Number.MAX_SAFE_INTEGER);f.authority.snapshot={...f.authority.snapshot!,leaseExpiresAtMs:Number.MAX_SAFE_INTEGER};expect((await f.execute()).reason).toBe('invalid_time');expect(f.oracle.read()).toEqual([]);});
 it.each(['revocation','expiration','supersession'] as const)('CORR-03 admission replay revalidates %s before accepted',async mode=>{const f=fixture();expect(await f.executor.admit(f.intent,f.caller)).toEqual({accepted:true,state:'RESERVED'});if(mode==='revocation')f.authority.snapshot={...f.authority.snapshot!,revoked:true};if(mode==='expiration')f.clock.advance(100);if(mode==='supersession'&&f.intent.authority.kind==='acquisition')f.authority.snapshot={...f.authority.snapshot!,authority:{...f.intent.authority,generation:exactGeneration('9007199254740994')}};const reason=mode==='revocation'?'revoked':mode==='expiration'?'expired':'identity_mismatch';expect(await f.executor.admit(f.intent,f.caller)).toEqual({accepted:false,reason});expect((await f.execute()).reason).toBe(reason);expect(f.oracle.read()).toEqual([]);});
 it('CORR-03 valid replay remains idempotent; completed result is not fresh admission',async()=>{const f=fixture();expect((await f.executor.admit(f.intent,f.caller)).accepted).toBe(true);expect((await f.executor.admit(f.intent,f.caller)).accepted).toBe(true);expect(f.oracle.read()).toEqual([]);const completed=await f.execute();f.authority.snapshot={...f.authority.snapshot!,revoked:true};expect(await f.executor.admit(f.intent,f.caller)).toEqual({accepted:false,reason:'already_claimed'});expect(await f.execute()).toEqual(completed);expect(f.oracle.read().filter(e=>e.event==='invocation')).toHaveLength(1);});
 it.each(['providerId','season','workClass'] as const)('CORR-04 rejects additional identity mismatch %s',async field=>{const f=fixture();f.authority.snapshot={...f.authority.snapshot!,[field]:field==='season'?2027:'other'} as AuthoritySnapshot;expect((await f.execute()).reason).toBe('identity_mismatch');expect(f.oracle.read()).toEqual([]);});
 it.each(['workerId','generation','streamId','runId','traversalId'] as const)('CORR-04 acquisition tuple includes %s',async field=>{const f=fixture();if(f.authority.snapshot?.authority.kind!=='acquisition')throw new Error('fixture');f.authority.snapshot={...f.authority.snapshot,authority:{...f.authority.snapshot.authority,[field]:field==='generation'?exactGeneration('2'):'other'}};expect((await f.execute()).reason).toBe('identity_mismatch');expect(f.oracle.read()).toEqual([]);});
 it.each(['workerId','generation','discoveryRunId'] as const)('CORR-04 discovery tuple includes %s',async field=>{const f=fixture(),authority={kind:'discovery' as const,workerId:'discovery-worker',generation:exactGeneration('2'),discoveryRunId:'discovery-run'},intent={...f.intent,endpoint:'championship-discovery' as const,authority};f.authority.snapshot={...f.authority.snapshot!,authority:{...authority,[field]:field==='generation'?exactGeneration('3'):'other'}};expect((await f.executor.execute(intent,f.cancel.signal,{role:'worker',workerId:'discovery-worker'})).reason).toBe('identity_mismatch');expect(f.oracle.read()).toEqual([]);});

});

// Exact independent RE01/RE02 probes, retained without changing their assertions.
describe('CORR2 final read cancellation',()=>{
 it('RE01 cancellation while final authority read is waiting cannot resurrect and overlap',async()=>{
  const f=fixture(),readEntered=barrier(),readResume=barrier(),secondActive=barrier(),bothActive=barrier(),receive=barrier();let reads=0,active=0,maxActive=0;
  f.authority.read=async()=>{reads++;if(reads===4){readEntered.release();await readResume.wait;}return f.authority.current();};
  f.oracle.beforeReceipt=async()=>{active++;maxActive=Math.max(maxActive,active);if(active===1)secondActive.release();if(active===2)bothActive.release();await receive.wait;active--;};
  const first=f.execute();await readEntered.wait;
  const abortDuplicate=new AbortController();abortDuplicate.abort();const cancelled=await f.executor.execute(f.intent,abortDuplicate.signal,f.caller);
  const next=f.executor.execute({...f.intent,intentId:'next-intent'},new AbortController().signal,f.caller);
  await secondActive.wait;readResume.release();
  const race=await Promise.race([bothActive.wait.then(()=>'OVERLAP'),first.then(()=>'NO_OVERLAP')]);
  receive.release();const results=await Promise.all([first,next]);console.info('RE01='+JSON.stringify({cancelled,race,maxActive,results,events:f.oracle.read()}));
  expect(cancelled.state).toBe('CANCELLED_NOT_SENT');expect(race).toBe('NO_OVERLAP');expect(maxActive).toBe(1);
 });
 it('RE02 signal aborted during final authority read remains not-sent',async()=>{
  const f=fixture(),entered=barrier(),resume=barrier();let reads=0;f.authority.read=async()=>{if(++reads===4){entered.release();await resume.wait;}return f.authority.current();};const pending=f.execute();await entered.wait;f.cancel.abort();resume.release();const result=await pending;console.info('RE02='+JSON.stringify({result,events:f.oracle.read()}));expect(result.state).toBe('CANCELLED_NOT_SENT');expect(f.oracle.read()).toEqual([]);
 });

 it.each(['resolve','reject','throw'] as const)('terminal cancellation survives late %s and replay',async mode=>{
  const f=fixture(),entered=barrier(),resume=barrier();let reads=0;
  f.authority.read=async()=>{if(++reads===4){entered.release();await resume.wait;if(mode==='reject')return Promise.reject(new Error('read rejected'));if(mode==='throw')throw new Error('read threw');}return f.authority.current();};
  const pending=f.execute();await entered.wait;const stop=new AbortController();stop.abort();
  const terminal=await f.executor.execute(f.intent,stop.signal,f.caller);
  expect(terminal.state).toBe('CANCELLED_NOT_SENT');
  expect((await f.executor.execute({...f.intent,intentId:'successor'},new AbortController().signal,f.caller)).state).toBe('RESPONSE');
  resume.release();expect(await pending).toEqual(terminal);expect(await f.execute()).toEqual(terminal);
  expect(await f.executor.admit(f.intent,f.caller)).toEqual({accepted:false,reason:'already_claimed'});
  expect(f.oracle.read().filter(e=>e.intentId===f.intent.intentId)).toEqual([]);
 });
 it.each(['revocation','supersession','exception','rejection'] as const)('final read %s refuses and frees reservation',async mode=>{
  const f=fixture(),entered=barrier(),resume=barrier();let reads=0;
  f.authority.read=async()=>{if(++reads===4){entered.release();await resume.wait;if(mode==='exception')throw new Error('read failure');if(mode==='rejection')return Promise.reject(new Error('read rejected'));}return f.authority.current();};
  const pending=f.execute();await entered.wait;
  const original=f.authority.current()!;
  if(mode==='revocation')f.authority.snapshot={...original,revoked:true};
  if(mode==='supersession'&&original.authority.kind==='acquisition')f.authority.snapshot={...original,authority:{...original.authority,generation:exactGeneration('9007199254740994')}};
  resume.release();const result=await pending;expect(result.state).toBe(mode==='revocation'||mode==='supersession'?'DENIED':'CANCELLED_NOT_SENT');expect(f.oracle.read()).toEqual([]);
  f.authority.snapshot=original;expect((await f.executor.execute({...f.intent,intentId:'fresh'},new AbortController().signal,f.caller)).state).toBe('RESPONSE');
 });
 it('old continuation cannot release successor reservation before it dispatches',async()=>{
  const f=fixture(),entered=barrier(),resume=barrier(),nextEntered=barrier(),nextResume=barrier();let reads=0;
  f.authority.read=async()=>{const n=++reads;if(n===4){entered.release();await resume.wait;}if(n===8){nextEntered.release();await nextResume.wait;}return f.authority.current();};
  const old=f.execute();await entered.wait;const stop=new AbortController();stop.abort();await f.executor.execute(f.intent,stop.signal,f.caller);
  const next=f.executor.execute({...f.intent,intentId:'next'},new AbortController().signal,f.caller);await nextEntered.wait;
  resume.release();expect((await old).state).toBe('CANCELLED_NOT_SENT');
  expect((await f.executor.execute({...f.intent,intentId:'third'},new AbortController().signal,f.caller)).reason).toBe('domain_busy');
  nextResume.release();expect((await next).state).toBe('RESPONSE');expect(f.oracle.read().filter(e=>e.event==='invocation').map(e=>e.intentId)).toEqual(['next']);
 });
});

// Exact P01/P02 probes from the third independent audit.
describe('CORR3 intent lifecycle',()=>{
 it('P01 terminal before admission cannot be replayed with a fresh signal',async()=>{const f=fixture();f.cancel.abort();const first=await f.execute();const replay=await f.executor.execute(f.intent,new AbortController().signal,f.caller);console.info('P01='+JSON.stringify({first,replay,events:f.oracle.read()}));expect(first.state).toBe('CANCELLED_NOT_SENT');expect(replay.state).toBe('CANCELLED_NOT_SENT');expect(f.oracle.read()).toEqual([]);});
 it('P02 cancelled duplicate during initial authority preparation cannot allow old continuation dispatch',async()=>{const p=paused('INITIAL_READ'),f=fixture(p.hook),pending=f.execute();await p.entered.wait;const stop=new AbortController();stop.abort();const cancelled=await f.executor.execute(f.intent,stop.signal,f.caller);p.resume.release();const result=await pending;console.info('P02='+JSON.stringify({cancelled,result,events:f.oracle.read()}));expect(result.state).toBe('CANCELLED_NOT_SENT');expect(f.oracle.read()).toEqual([]);});

 it('pre-admission terminal is frozen, repeatable, and cannot be re-admitted',async()=>{
  const f=fixture();f.cancel.abort();const terminal=await f.execute();
  expect(Object.isFrozen(terminal)).toBe(true);expect(Reflect.set(terminal,'state','RESERVED')).toBe(false);
  expect(f.executor.inspect(f.intent.intentId)).toEqual(terminal);
  for(let n=0;n<3;n++){expect(await f.execute()).toEqual(terminal);expect(await f.executor.execute(f.intent,new AbortController().signal,f.caller)).toEqual(terminal);}
  expect(await f.executor.admit(f.intent,f.caller)).toEqual({accepted:false,reason:'already_claimed'});
  expect(f.oracle.read()).toEqual([]);
  expect((await f.executor.execute({...f.intent,intentId:'distinct'},new AbortController().signal,f.caller)).state).toBe('RESPONSE');
 });
 it.each([1,2])('cancellation during admission read %s survives late resolve/reject and direct admit',async nth=>{
  for(const rejects of [false,true])for(const admissionOnly of [false,true]){
   const f=fixture(),entered=barrier(),resume=barrier();let reads=0;
   f.authority.read=async()=>{if(++reads===nth){entered.release();await resume.wait;if(rejects)throw new Error('late admission read');}return f.authority.current();};
   const pending=admissionOnly?f.executor.admit(f.intent,f.caller):f.execute();await entered.wait;
   const stop=new AbortController();stop.abort();const terminal=await f.executor.execute(f.intent,stop.signal,f.caller);
   const fresh={...f.intent,intentId:'distinct'};
   expect((await f.executor.execute(fresh,new AbortController().signal,f.caller)).state).toBe('RESPONSE');
   resume.release();expect(await pending).toEqual(admissionOnly?{accepted:false,reason:'already_claimed'}:terminal);
   expect(await f.executor.execute(f.intent,new AbortController().signal,f.caller)).toEqual(terminal);
   expect(f.oracle.read().filter(e=>e.intentId===f.intent.intentId)).toEqual([]);
  }
 });
 it.each(['revocation','supersession','expiration','invalid_time'] as const)('terminal cancellation dominates later %s and permits a distinct valid identity',async mode=>{
  const p=paused('INITIAL_READ'),f=fixture(p.hook),pending=f.execute();await p.entered.wait;
  const original=f.authority.current()!,stop=new AbortController();stop.abort();const terminal=await f.executor.execute(f.intent,stop.signal,f.caller);
  if(mode==='revocation')f.authority.snapshot={...original,revoked:true};
  if(mode==='supersession'&&original.authority.kind==='acquisition')f.authority.snapshot={...original,authority:{...original.authority,generation:exactGeneration('2')}};
  if(mode==='expiration')f.clock.advance(100);
  const wall=f.clock.authorityNowMs.bind(f.clock);if(mode==='invalid_time')f.clock.authorityNowMs=()=>NaN;
  p.resume.release();expect(await pending).toEqual(terminal);expect(await f.executor.execute(f.intent,new AbortController().signal,f.caller)).toEqual(terminal);
  expect(f.oracle.read()).toEqual([]);f.clock.authorityNowMs=wall;
  const next={...f.intent,intentId:'distinct',authority:f.authority.snapshot!.authority};
  f.authority.snapshot={...original,authority:next.authority,leaseExpiresAtMs:f.clock.authorityNowMs()+100};
  expect((await f.executor.execute(next,new AbortController().signal,f.caller)).state).toBe('RESPONSE');
 });
 it('aborting the original signal during admission stores terminal even if the read fails',async()=>{
  const f=fixture(),entered=barrier(),resume=barrier();let reads=0;
  f.authority.read=async()=>{if(++reads===1){entered.release();await resume.wait;throw new Error('read failed');}return f.authority.current();};
  const pending=f.execute();await entered.wait;f.cancel.abort();resume.release();
  const terminal=await pending;expect(terminal.state).toBe('CANCELLED_NOT_SENT');
  expect(f.executor.inspect(f.intent.intentId)).toEqual(terminal);expect(await f.executor.execute(f.intent,new AbortController().signal,f.caller)).toEqual(terminal);expect(f.oracle.read()).toEqual([]);
 });
 it('invalid-time not-sent before reservation also remains terminal after clock recovery',async()=>{
  const f=fixture(),wall=f.clock.authorityNowMs.bind(f.clock);f.clock.authorityNowMs=()=>NaN;
  const terminal=await f.execute();expect(terminal).toMatchObject({state:'CANCELLED_NOT_SENT',reason:'invalid_time'});
  f.clock.authorityNowMs=wall;expect(await f.execute()).toEqual(terminal);
  expect((await f.executor.execute({...f.intent,intentId:'fresh'},new AbortController().signal,f.caller)).state).toBe('RESPONSE');
 });
 it('pre-admission cancellation cannot release another intent active on the domain',async()=>{
  const f=fixture(),entered=barrier(),resume=barrier();let active=0,maxActive=0;
  f.oracle.beforeReceipt=async()=>{active++;maxActive=Math.max(maxActive,active);entered.release();await resume.wait;active--;};
  const owner=f.execute();await entered.wait;const stop=new AbortController();stop.abort();
  const other={...f.intent,intentId:'cancelled-before-admission'};
  expect((await f.executor.execute(other,stop.signal,f.caller)).state).toBe('CANCELLED_NOT_SENT');
  expect((await f.executor.execute({...f.intent,intentId:'third'},new AbortController().signal,f.caller)).reason).toBe('domain_busy');
  expect((await f.executor.execute(other,new AbortController().signal,f.caller)).state).toBe('CANCELLED_NOT_SENT');
  expect(maxActive).toBe(1);console.info('CORR3_MAX_ACTIVE='+maxActive);resume.release();expect((await owner).state).toBe('RESPONSE');
  expect((await f.executor.execute({...f.intent,intentId:'after-release'},new AbortController().signal,f.caller)).state).toBe('RESPONSE');
 });
 it('same ID with a changed payload cannot rewrite a pre-admission terminal',async()=>{
  const f=fixture();f.cancel.abort();const terminal=await f.execute();
  expect((await f.executor.execute({...f.intent,parametersDigest:'changed'},new AbortController().signal,f.caller)).reason).toBe('identity_mismatch');
  expect(await f.executor.admit({...f.intent,parametersDigest:'changed'},f.caller)).toEqual({accepted:false,reason:'identity_mismatch'});
  expect(f.executor.inspect(f.intent.intentId)).toEqual(terminal);expect(f.oracle.read()).toEqual([]);
 });
 it('an admission in flight cannot overwrite a tombstone bound to a different payload',async()=>{
  const p=paused('INITIAL_READ'),f=fixture(p.hook),pending=f.execute();await p.entered.wait;
  const stop=new AbortController();stop.abort();const changed={...f.intent,parametersDigest:'changed'};
  const terminal=await f.executor.execute(changed,stop.signal,f.caller);p.resume.release();
  expect((await pending).reason).toBe('identity_mismatch');expect(f.executor.inspect(f.intent.intentId)).toEqual(terminal);expect(f.oracle.read()).toEqual([]);
 });
 it('wrong caller cannot install a cancellation tombstone for a valid intent',async()=>{
  const f=fixture(),stop=new AbortController();stop.abort();
  expect((await f.executor.execute(f.intent,stop.signal,{role:'worker',workerId:'intruder'})).reason).toBe('identity_mismatch');
  expect(f.executor.inspect(f.intent.intentId)).toBeUndefined();expect((await f.execute()).state).toBe('RESPONSE');
 });
});
