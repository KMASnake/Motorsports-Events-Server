import type {AuthenticatedCaller,AdmissionDecision,AdmissionPort,AuthorityReader,AuthoritySnapshot,AuthorityTime,EmissionPort,ExecutionResult,AttemptState,ProviderRequestIntent,RefusalReason,SimulatedTransport} from '../../src/providers/executionAuthorityContract.js';

export class DeterministicClock implements AuthorityTime {
  private wall=1000;private monotonic=0;
  authorityNowMs(){return this.wall;}
  monotonicNowMs(){return this.monotonic;}
  advance(ms:number){if(!Number.isSafeInteger(ms)||ms<0)throw new Error('invalid_clock_advance');if(!Number.isSafeInteger(this.wall+ms)||!Number.isSafeInteger(this.monotonic+ms))throw new Error('invalid_clock_advance');this.wall+=ms;this.monotonic+=ms;}
  resetWall(ms:number){if(!Number.isSafeInteger(ms))throw new Error('invalid_clock');this.wall=ms;}
}
export function barrier(){let release!:()=>void;const wait=new Promise<void>(resolve=>{release=resolve;});return {wait,release};}
export type Boundary='INITIAL_READ'|'RESERVED'|'FINAL_ADMISSION'|'AFTER_LAST_LOCAL_CHECK';
const copyIntent=(intent:ProviderRequestIntent):ProviderRequestIntent=>Object.freeze({...intent,authority:Object.freeze({...intent.authority})});
const canonical=(value:unknown):string=>value!==null&&typeof value==='object'?`{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`:JSON.stringify(value);
const key=(intent:ProviderRequestIntent)=>canonical(intent);
/** Read/replace is test-controlled server authority, separate from transport oracle. */
export class InMemoryAuthority implements AuthorityReader {
  snapshot:AuthoritySnapshot|null;
  constructor(snapshot:AuthoritySnapshot){this.snapshot=structuredClone(snapshot);}
  current(){return this.snapshot?structuredClone(this.snapshot):null;}
  async read(){return this.current();}
}
/** Test double, NOT a durable journal, DB transaction, physical transport or runtime service.
 * One shared instance models the singleton. Two independent instances are NOT fenced.
 * Unknown attempts close the provider domain and restart starts closed. No auto-open.
 */
class InvalidTime extends Error {}
const expose=(result:ExecutionResult):ExecutionResult=>Object.freeze({...result});
export class SimulatedAuthorityExecutor implements AdmissionPort,EmissionPort {
  private readonly attempts=new Map<string,{fingerprint:string;intent:ProviderRequestIntent;result:ExecutionResult;state:AttemptState;claim?:symbol}>();
  private readonly busy=new Map<string,string>();private readonly unknown=new Set<string>();
  private open=false;
  private readonly activeTransports=new Set<string>();
  private lastAuthority:number|undefined;private lastMonotonic:number|undefined;
  private time(){
    let authority:number,monotonic:number;
    try{authority=this.clock.authorityNowMs();monotonic=this.clock.monotonicNowMs();}catch{throw new InvalidTime('invalid_time');}
    if(!Number.isSafeInteger(authority)||!Number.isSafeInteger(monotonic)||monotonic<0||(this.lastAuthority!==undefined&&authority<this.lastAuthority)||(this.lastMonotonic!==undefined&&monotonic<this.lastMonotonic))throw new InvalidTime('invalid_time');
    this.lastAuthority=authority;this.lastMonotonic=monotonic;return {authority,monotonic};
  }
  private safeTime(value:number){if(!Number.isSafeInteger(value))throw new InvalidTime('invalid_time');return value;}
  private release(intent:ProviderRequestIntent){
    if(!this.activeTransports.has(intent.intentId)&&this.busy.get(intent.providerId)===intent.intentId)this.busy.delete(intent.providerId);
  }
  constructor(private readonly reader:InMemoryAuthority,private readonly clock:AuthorityTime,private readonly transport:SimulatedTransport,
    private readonly pause:(boundary:Boundary)=>Promise<void>=async()=>{},private readonly maxTransportMs=8,private readonly marginMs=2,initiallyOpenForSimulation=false){
    this.open=initiallyOpenForSimulation;
    if(transport.mode!=='SIMULATED_ONLY')throw new Error('simulated_transport_required');
    if(!Number.isSafeInteger(maxTransportMs)||maxTransportMs<=0||!Number.isSafeInteger(marginMs)||marginMs<0||!Number.isSafeInteger(maxTransportMs+marginMs))throw new Error('invalid_deadline_policy');
  }
  private refusal(intent:ProviderRequestIntent,snapshot:AuthoritySnapshot|null):RefusalReason|undefined {
    if(!this.open)return 'executor_closed';
    if(intent.authority.kind==='manual')return 'unsupported_authority';
    const strings=[intent.intentId,intent.providerId,intent.sourceId,intent.configurationRevision,intent.mappingId,intent.workClass,intent.logicalUnitKey,intent.parametersDigest,intent.executorIncarnation];
    const authority=intent.authority;
    if(strings.some(value=>typeof value!=='string'||!value)||!Number.isSafeInteger(intent.season)||!['season-page','championship-discovery','connection-test'].includes(intent.endpoint)||intent.method!=='GET'||typeof intent.operationalEpoch!=='string'||!/^[1-9][0-9]*$/.test(intent.operationalEpoch))return 'invalid_intent';
    if((authority.kind!=='acquisition'&&authority.kind!=='discovery')||typeof authority.workerId!=='string'||!authority.workerId||typeof authority.generation!=='string'||!/^[1-9][0-9]*$/.test(authority.generation))return 'invalid_intent';
    if(intent.endpoint!==(authority.kind==='acquisition'?'season-page':'championship-discovery'))return 'invalid_intent';
    const ids=authority.kind==='acquisition'?[authority.streamId,authority.runId,authority.traversalId]:[authority.discoveryRunId];
    if(ids.some(id=>typeof id!=='string'||!id))return 'invalid_intent';
    if(!snapshot)return 'identity_mismatch';
    if(!snapshot.active||snapshot.revoked)return 'revoked';
    if(!snapshot.heartbeatCertain)return 'heartbeat_uncertain';
    const fields=['providerId','sourceId','configurationRevision','mappingId','season','workClass','logicalUnitKey','operationalEpoch','executorIncarnation'] as const;
    if(fields.some(field=>intent[field]!==snapshot[field])||canonical(intent.authority)!==canonical(snapshot.authority))return 'identity_mismatch';
    if(!Number.isSafeInteger(snapshot.leaseExpiresAtMs))return 'invalid_time';
    if(this.time().authority>=snapshot.leaseExpiresAtMs)return 'expired';
  }
  async admit(raw:ProviderRequestIntent,caller:AuthenticatedCaller):Promise<AdmissionDecision>{
    if(!this.callerMatches(raw,caller))return {accepted:false,reason:'identity_mismatch'};
    const intent=copyIntent(raw),existing=this.attempts.get(intent.intentId);
    if(existing&&existing.fingerprint!==key(intent))return {accepted:false,reason:'identity_mismatch'};
    if(existing&&existing.state!=='RESERVED')return {accepted:false,reason:'already_claimed'};
    let reason:RefusalReason|undefined;
    try{
      await this.reader.read();await this.pause('INITIAL_READ');await this.reader.read();
      // Atomic only in this single JS model: fresh snapshot/check/claim, no await.
      reason=this.refusal(intent,this.reader.current());
    }catch(error){reason=error instanceof InvalidTime?'invalid_time':'authority_unavailable';}
    // A terminal created while preparation awaited wins even over a late read error.
    // No await from this lookup through reservation publication.
    const currentAttempt=this.attempts.get(intent.intentId);
    if(currentAttempt){
      if(currentAttempt.fingerprint!==key(intent))return {accepted:false,reason:'identity_mismatch'};
      if(currentAttempt.state!=='RESERVED')return {accepted:false,reason:'already_claimed'};
      if(reason)return {accepted:false,reason};
      if(this.busy.get(intent.providerId)!==intent.intentId)return {accepted:false,reason:'domain_busy'};
      return {accepted:true,state:'RESERVED'};
    }
    if(reason)return {accepted:false,reason};
    if(this.unknown.has(intent.providerId))return {accepted:false,reason:'domain_unknown'};
    if(this.busy.has(intent.providerId))return {accepted:false,reason:'domain_busy'};
    // Synchronous claim: no await between claim and publication in this in-memory model.
    const result:ExecutionResult=expose({intentId:intent.intentId,state:'RESERVED',businessPersistenceAuthorized:false});
    this.busy.set(intent.providerId,intent.intentId);this.attempts.set(intent.intentId,{fingerprint:key(intent),intent,result,state:'RESERVED'});
    return {accepted:true,state:'RESERVED'};
  }
  private finish(intent:ProviderRequestIntent,result:ExecutionResult){
    let attempt=this.attempts.get(intent.intentId);
    if(!attempt){
      // Terminal tombstone, not a reservation: persist identity before returning
      // not-sent, without acquiring or releasing any provider domain.
      if(result.state!=='CANCELLED_NOT_SENT')throw new Error('missing_attempt');
      attempt={fingerprint:key(intent),intent,result:expose(result),state:result.state};
      this.attempts.set(intent.intentId,attempt);
      return expose(attempt.result);
    }
    // Exclusion is owned by private phase/transport state, never by a public result.
    if(attempt.state!=='RESERVED'&&attempt.state!=='DISPATCHING')return expose(attempt.result);
    if(attempt.state==='DISPATCHING'&&result.state==='CANCELLED_NOT_SENT')return expose(attempt.result);
    attempt.claim=undefined;attempt.state=result.state;attempt.result=expose(result);
    if(result.state==='UNKNOWN')this.unknown.add(intent.providerId);
    this.release(intent);return expose(attempt.result);
  }
  private callerMatches(intent:ProviderRequestIntent,caller:AuthenticatedCaller){return caller.role==='worker'&&intent.authority.kind!=='manual'&&caller.workerId===intent.authority.workerId;}
  async execute(raw:ProviderRequestIntent,signal:AbortSignal,caller:AuthenticatedCaller):Promise<ExecutionResult>{
    if(!this.callerMatches(raw,caller))return {intentId:raw.intentId,state:'DENIED',reason:raw.authority.kind==='manual'?'unsupported_authority':'identity_mismatch',businessPersistenceAuthorized:false};
    const intent=copyIntent(raw),prior=this.attempts.get(intent.intentId);
    if(prior&&prior.fingerprint!==key(intent))return {intentId:intent.intentId,state:'DENIED',reason:'identity_mismatch',businessPersistenceAuthorized:false};
    if(prior&&prior.state!=='RESERVED')return expose(prior.result);
    if(signal.aborted){const cancelled:ExecutionResult={intentId:intent.intentId,state:'CANCELLED_NOT_SENT',reason:'cancelled',businessPersistenceAuthorized:false};return this.finish(intent,cancelled);}
    const admitted=await this.admit(intent,caller);
    // Both successful and failed preparations must observe a concurrent terminal.
    const prepared=this.attempts.get(intent.intentId);
    if(prepared&&prepared.fingerprint!==key(intent))return {intentId:intent.intentId,state:'DENIED',reason:'identity_mismatch',businessPersistenceAuthorized:false};
    if(prepared&&prepared.state!=='RESERVED')return expose(prepared.result);
    if(signal.aborted)return this.finish(intent,{intentId:intent.intentId,state:'CANCELLED_NOT_SENT',reason:'cancelled',businessPersistenceAuthorized:false});
    if(!admitted.accepted){
      if(admitted.reason==='already_claimed')return expose(this.attempts.get(intent.intentId)!.result);
      const refused:ExecutionResult={intentId:intent.intentId,state:admitted.reason==='invalid_time'?'CANCELLED_NOT_SENT':'DENIED',reason:admitted.reason,businessPersistenceAuthorized:false};
      // A replay may fail before the execution claim. Finalize an existing known
      // not-sent reservation, but never transition an already-dispatched owner.
      const reserved=this.attempts.get(intent.intentId);
      return reserved?.state==='RESERVED'||refused.state==='CANCELLED_NOT_SENT'?this.finish(intent,refused):expose(refused);
    }
    const attempt=this.attempts.get(intent.intentId)!;
    // Only one consumer can transition RESERVED. Concurrent duplicates observe its state.
    if(attempt.state!=='RESERVED'||attempt.claim)return expose(attempt.result);
    const claim=Symbol('execution');attempt.claim=claim;
    // Private, attempt-scoped ownership; a terminal transition invalidates it.
    const ownsReservation=()=>this.attempts.get(intent.intentId)===attempt&&attempt.state==='RESERVED'&&attempt.claim===claim&&this.busy.get(intent.providerId)===intent.intentId;
    const cancelled=()=>this.finish(intent,{intentId:intent.intentId,state:'CANCELLED_NOT_SENT',reason:'cancelled',businessPersistenceAuthorized:false});
    try{
      const localStart=this.time().monotonic;
      await this.pause('RESERVED');
      if(!ownsReservation())return expose(attempt.result);
      if(signal.aborted)return cancelled();
      await this.reader.read();
      if(!ownsReservation())return expose(attempt.result);
      if(signal.aborted)return cancelled();
      const snapshot=this.reader.current(),reason=this.refusal(intent,snapshot);
      if(reason)return this.finish(intent,{intentId:intent.intentId,state:'DENIED',reason,businessPersistenceAuthorized:false});
      const remaining=this.safeTime(snapshot!.leaseExpiresAtMs-this.time().authority);
      if(remaining<=this.maxTransportMs+this.marginMs)return this.finish(intent,{intentId:intent.intentId,state:'CANCELLED_NOT_SENT',reason:'deadline',businessPersistenceAuthorized:false});
      const deadline=this.safeTime(this.time().monotonic+Math.min(remaining-this.marginMs,this.maxTransportMs));
      await this.pause('FINAL_ADMISSION');
      if(!ownsReservation())return expose(attempt.result);
      if(signal.aborted)return cancelled();
      await this.reader.read();
      if(!ownsReservation())return expose(attempt.result);
      if(signal.aborted)return cancelled();
      const lastSnapshot=this.reader.current(),lastReason=this.refusal(intent,lastSnapshot);
      if(lastReason)return this.finish(intent,{intentId:intent.intentId,state:'DENIED',reason:lastReason,businessPersistenceAuthorized:false});
      // This is a conservative local deadline, not a fresh DB admission or physical fence.
      const finalTime=this.time();
      if(!this.open||finalTime.monotonic>=deadline||finalTime.monotonic<localStart)return this.finish(intent,{intentId:intent.intentId,state:'CANCELLED_NOT_SENT',reason:'deadline',businessPersistenceAuthorized:false});
      // Compare-and-transition is synchronous: no await between ownership, abort
      // validation and dispatch. A released claim can never be reacquired here.
      if(!ownsReservation())return expose(attempt.result);
      if(signal.aborted)return cancelled();
      attempt.state='DISPATCHING';attempt.result=expose({intentId:intent.intentId,state:'DISPATCHING',businessPersistenceAuthorized:false});
      // Adversarial injection ONLY: demonstrates suspension after the last local check.
      // No promise of zero late invocation/reception follows from that check.
      await this.pause('AFTER_LAST_LOCAL_CHECK');
      this.activeTransports.add(intent.intentId);
      const response=await this.transport.invoke(intent,signal);
      if((attempt.state as AttemptState)==='UNKNOWN')return expose(attempt.result);
      return this.finish(intent,{intentId:intent.intentId,state:'RESPONSE',responseDigest:response.responseDigest,businessPersistenceAuthorized:false});
    }catch(error){
      // Before DISPATCHING invocation is known not to have happened. Past that
      // conservative boundary, lost outcome is UNKNOWN, never an automatic retry.
      const state=attempt.state==='RESERVED'?'CANCELLED_NOT_SENT':'UNKNOWN';
      return this.finish(intent,{intentId:intent.intentId,state,reason:state==='CANCELLED_NOT_SENT'?(error instanceof InvalidTime?'invalid_time':'authority_unavailable'):undefined,businessPersistenceAuthorized:false});
    }finally{this.activeTransports.delete(intent.intentId);if(attempt.state!=='RESERVED'&&attempt.state!=='DISPATCHING')this.release(intent);}
  }
  interrupt(){this.open=false;for(const attempt of this.attempts.values())if(attempt.state==='DISPATCHING'||attempt.state==='RESERVED')this.finish(attempt.intent,{intentId:attempt.intent.intentId,state:attempt.state==='DISPATCHING'?'UNKNOWN':'CANCELLED_NOT_SENT',businessPersistenceAuthorized:false});}
  /** No re-opening method: external isolation/durable recovery belong to later lots. */
  inspect(id:string){const result=this.attempts.get(id)?.result;return result?expose(result):undefined;}
}
