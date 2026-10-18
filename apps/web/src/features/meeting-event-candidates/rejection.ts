import {candidateData,record,rejectCandidate,safeCandidateRevision,type CandidateDetail,type RejectionIntent,type RejectionReceipt} from './candidatesApi';
export function rejectionUnavailable(detail:CandidateDetail):string|null{
 const c=detail.candidate,n=record(candidateData(c.candidate_data).normalized);
 if(!['meeting','event'].includes(c.resource_kind)||!['PENDING','REVIEW_REQUIRED'].includes(String(c.resolution_state)))return 'Rejet indisponible : ce candidat n’est pas dans un état éligible.';
 if(safeCandidateRevision(c.revision)===null)return 'Rejet indisponible : révision du candidat inconnue.';
 if(![n.championshipId,n.championshipSeasonId].every(value=>typeof value==='string'&&value.trim()))return 'Rejet indisponible : championnat et saison canoniques requis par le backend.';
 return null;
}
export function normalizeRejectionReason(raw:string):string{const reason=raw.trim();if(reason.length<1||reason.length>2000)throw new Error('Le motif doit contenir de 1 à 2 000 caractères après suppression des espaces de bord.');return reason;}
/** Page-lifetime intent ledger: survives route unmount/remount, no storage or auto retry.
 * Backend remains the authority. In-flight POSTs cannot be undone by abort/navigation.
 */
export class RejectionLedger{
 private readonly intents=new Map<string,RejectionIntent>();
 private readonly active=new Map<string,{intent:RejectionIntent;promise:Promise<RejectionReceipt>}>();
 private readonly receipts=new Map<RejectionIntent,RejectionReceipt>();
 private readonly listeners=new Set<()=>void>();
 constructor(private readonly send=rejectCandidate,private readonly key:()=>string=()=>crypto.randomUUID()){}
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};};
 private changed(){for(const listener of this.listeners)listener();}
 pending(id:string){return this.active.has(id);}
 confirmed(id:string){return [...this.receipts.keys()].some(intent=>intent.candidateId===id);}
 prepare(detail:CandidateDetail,raw:string):RejectionIntent{
  const unavailable=rejectionUnavailable(detail);if(unavailable)throw new Error(unavailable);
  const reason=normalizeRejectionReason(raw),id=detail.candidate.id,revision=safeCandidateRevision(detail.candidate.revision)!;
  const fingerprint=JSON.stringify([id,revision,reason]);let intent=this.intents.get(fingerprint);
  if(!intent){intent=Object.freeze({candidateId:id,revision,reason,key:this.key()});this.intents.set(fingerprint,intent);}
  return intent;
 }
 submit(intent:RejectionIntent):Promise<RejectionReceipt>{
  if(![...this.intents.values()].includes(intent))return Promise.reject(new Error('Intention de rejet inconnue.'));
  const running=this.active.get(intent.candidateId);if(running)return running.intent===intent?running.promise:Promise.reject(new Error('Un rejet est déjà en cours pour ce candidat.'));
  const receipt=this.receipts.get(intent);if(receipt)return Promise.resolve(receipt);
  const promise=Promise.resolve().then(()=>this.send(intent)).then(result=>{this.receipts.set(intent,result);return result;}).finally(()=>{this.active.delete(intent.candidateId);this.changed();});
  this.active.set(intent.candidateId,{intent,promise});this.changed();return promise;
 }
}
export const rejectionLedger=new RejectionLedger();
