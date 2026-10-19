/** A3-01 contract only. No runtime caller, transport, credential or DB implementation.
 * Admission is not a transferable capability. Invocation and remote acceptance are
 * separate events; neither a DB check nor cancellation makes them atomic.
 */
export type Generation = string & {readonly __generation: unique symbol};
export function exactGeneration(value:string):Generation {
  if(typeof value!=='string'||!/^[1-9][0-9]*$/.test(value))throw new Error('invalid_generation');
  return value as Generation;
}
export type LeaseIdentity = Readonly<{workerId:string;generation:Generation}>;
export type ExecutionAuthority =
  | Readonly<LeaseIdentity & {kind:'acquisition';streamId:string;runId:string;traversalId:string}>
  | Readonly<LeaseIdentity & {kind:'discovery';discoveryRunId:string}>
  | Readonly<{kind:'manual';administrativeRequestId:string;approvedScopeId:string}>;
export type ProviderRequestIntent = Readonly<{
  intentId:string;providerId:string;sourceId:string;configurationRevision:string;
  mappingId:string;season:number;workClass:string;logicalUnitKey:string;
  endpoint:'season-page'|'championship-discovery'|'connection-test';method:'GET';parametersDigest:string;
  operationalEpoch:Generation;executorIncarnation:string;authority:ExecutionAuthority;
}>;
/** Values below come from the authority owner, never from an untrusted intent. */
export type AuthoritySnapshot = Readonly<{
  providerId:string;sourceId:string;configurationRevision:string;mappingId:string;
  season:number;workClass:string;logicalUnitKey:string;operationalEpoch:Generation;executorIncarnation:string;
  authority:ExecutionAuthority;leaseExpiresAtMs:number;
  active:boolean;revoked:boolean;heartbeatCertain:boolean;
}>;
export type AttemptState='RESERVED'|'DENIED'|'CANCELLED_NOT_SENT'|'DISPATCHING'|'RESPONSE'|'ERROR'|'UNKNOWN';
export type RefusalReason='invalid_intent'|'identity_mismatch'|'expired'|'revoked'|'heartbeat_uncertain'|'cancelled'|'domain_busy'|'domain_unknown'|'executor_closed'|'deadline'|'unsupported_authority'|'already_claimed'|'authority_unavailable'|'invalid_time';
/** accepted=true always revalidates current authority, including RESERVED replay.
 * Terminal attempts return already_claimed; historical execution results are not admission. */
export type AdmissionDecision = Readonly<{accepted:true;state:'RESERVED'}|{accepted:false;reason:RefusalReason}>;
export type ExecutionResult = Readonly<{
  intentId:string;state:AttemptState;reason?:RefusalReason;
  /** A received response does not itself authorize source/checkpoint persistence. */
  responseDigest?:string;businessPersistenceAuthorized:false;
}>;
/** Supplied by the trusted workload boundary, not parsed from intent fields.
 * A3-01 models it; cryptographic workload authentication is NOT implemented. */
export type AuthenticatedCaller=Readonly<{role:'worker'|'administrator'|'client';workerId:string}>;
export interface AuthorityReader {read(intent:ProviderRequestIntent):Promise<AuthoritySnapshot|null>}
export interface AdmissionPort {admit(intent:ProviderRequestIntent,caller:AuthenticatedCaller):Promise<AdmissionDecision>}
/** Executes an intent; never hands a bearer transport permit back to a worker. */
export interface EmissionPort {execute(intent:ProviderRequestIntent,cancellation:AbortSignal,caller:AuthenticatedCaller):Promise<ExecutionResult>}
/** Observations must be finite safe integer milliseconds. Authority time may be
 * signed; monotonic time must be nonnegative. Regressions/exceptions are invalid,
 * never a permissive default. An executor validates each read before use. */
export interface AuthorityTime {authorityNowMs():number;monotonicNowMs():number}
export interface SimulatedTransport {
  readonly mode:'SIMULATED_ONLY';
  invoke(intent:ProviderRequestIntent,cancellation:AbortSignal):Promise<Readonly<{responseDigest:string}>>;
}

/** In the A3-01 model a terminal not-sent result is irreversible for that intent,
 * including cancellation before admission/reservation. The private identity and
 * terminal result are retained in memory for the lifetime of the shared executor.
 * admit rejects this identity; execute replays its terminal result. A new attempt
 * needs a distinct intentId and fresh authority validation. No restart durability.
 * Releasing its reservation invalidates its private execution claim; asynchronous
 * continuations cannot acquire a replacement claim or transition it to dispatch.
 * This local transition invariant is not a physical network fencing guarantee. */
