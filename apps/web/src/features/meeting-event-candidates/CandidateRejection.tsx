import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {Button} from '../../design-system';
import {candidateData,CandidateDecisionError,record,type CandidateDetail} from './candidatesApi';
import {normalizeRejectionReason,rejectionLedger,rejectionUnavailable} from './rejection';

export function CandidateRejection({detail,readable,onAccepted,onReloadRequired}:{detail:CandidateDetail;readable:boolean;onAccepted:(replayed:boolean)=>void;onReloadRequired:(message:string)=>void}){
 const [open,setOpen]=useState(false),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false),[error,setError]=useState('');
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLElement>(null),alive=useRef(false),submitting=useRef(false),id=detail.candidate.id;
 const busy=useSyncExternalStore(rejectionLedger.subscribe,()=>rejectionLedger.pending(id),()=>false);
 const alreadyConfirmed=rejectionLedger.confirmed(id),unavailable=rejectionUnavailable(detail);
 useEffect(()=>{alive.current=true;return ()=>{alive.current=false;};},[]);
 useEffect(()=>{if(!open)return;const element=dialog.current!;element.showModal();return ()=>{element.close();};},[open]);
 function close(){if(busy)return;dialog.current?.close();setOpen(false);setError('');setConfirmed(false);trigger.current?.querySelector('button')?.focus();}
 let normalized='';try{normalized=normalizeRejectionReason(reason);}catch{/* Validation below, never submit an invalid reason. */}
 async function submit(){
  if(submitting.current||busy||!confirmed||!normalized||!readable||unavailable||alreadyConfirmed)return;
  submitting.current=true;setError('');
  try{const intent=rejectionLedger.prepare(detail,reason),receipt=await rejectionLedger.submit(intent);if(alive.current)onAccepted(receipt.replayed);}
  catch(failure){if(!alive.current)return;const error=failure as Error;if(error instanceof CandidateDecisionError&&[403,404,409].includes(error.status)){setOpen(false);onReloadRequired(error.message);}else setError(error.message);}
  finally{submitting.current=false;}
 }
 const n=record(candidateData(detail.candidate.candidate_data).normalized),name=typeof n.name==='string'?n.name:'Non renseigné';
 if(!readable)return <p className="candidate-note">Rejet indisponible tant que la lecture du candidat n’est pas actualisée sans erreur.</p>;
 if(unavailable||alreadyConfirmed)return <p className="candidate-note">{alreadyConfirmed?'Rejet déjà confirmé par le serveur ; consulter l’état et l’historique actualisés.':unavailable}</p>;
 return <section ref={trigger} className="candidate-rejection toolbar"><Button onClick={()=>{setOpen(true);setConfirmed(false);}} disabled={busy}>Rejeter</Button>{busy&&<p role="status">Rejet en cours. Une requête déjà envoyée ne peut pas être annulée ici.</p>}
  {open&&<dialog ref={dialog} className="candidate-rejection-dialog" aria-labelledby="reject-title" aria-describedby="reject-warning" onCancel={event=>{event.preventDefault();close();}}>
   <h2 id="reject-title">Rejeter le candidat {detail.candidate.resource_kind==='meeting'?'Meeting':'Event'} — {name}</h2>
   <p id="reject-warning">Le rejet concerne le candidat entier, pas seulement une correspondance. Il est irréversible via l’API actuelle. Il ne supprime pas une entité canonique et ne publie aucune donnée.</p>
   <p>Révision examinée : {detail.candidate.revision}</p>
   <label htmlFor="reject-reason">Motif obligatoire</label><textarea id="reject-reason" autoFocus value={reason} disabled={busy} onChange={event=>{setReason(event.target.value);setConfirmed(false);}} aria-describedby="reject-length"/>
   <p id="reject-length">{reason.trim().length} / 2 000 caractères après suppression des espaces de bord.</p>
   {!normalized&&<p>Un motif non vide de 1 à 2 000 caractères est requis.</p>}
   <label className="candidate-rejection-confirmation"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event=>setConfirmed(event.target.checked)}/>Je confirme le rejet irréversible du candidat entier.</label>
   {error&&<p role="alert">{error}</p>}
   <div className="candidate-toolbar toolbar"><Button disabled={busy} onClick={close}>Annuler</Button><Button variant="danger" disabled={busy||!normalized||!confirmed} onClick={()=>void submit()}>Confirmer le rejet</Button></div>
  </dialog>}
 </section>;
}
