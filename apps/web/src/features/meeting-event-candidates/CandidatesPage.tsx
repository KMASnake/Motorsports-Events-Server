import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {Link,useParams,useSearchParams} from 'react-router-dom';
import {Button,EmptyState,PageHeader,Panel,StatusChip} from '../../design-system';
import {candidateData,candidateStates,getCandidate,listCandidates,PAGE_SIZE,record,type CandidateDetail,type CandidateRow,type CandidateState} from './candidatesApi';
import {CandidateRejection} from './CandidateRejection';
import {rejectionLedger} from './rejection';
import './candidates.css';

const labels:Record<CandidateState,string>={PENDING:'En attente',REVIEW_REQUIRED:'À examiner',RESOLVED_LINKED:'Rapproché',RESOLVED_CREATED:'Créé',REJECTED:'Rejeté'};
export const display=(value:unknown):string=>typeof value==='string'&&value.trim()?value:typeof value==='number'||typeof value==='boolean'?String(value):'Non renseigné';
const kind=(value:CandidateRow['resource_kind'])=>value==='meeting'?'Meeting':'Event';
const fields=(values:Record<string,unknown>)=><dl className="candidate-fields">{Object.entries(values).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{display(value)}</dd></div>)}</dl>;
function ReadFailure({message}:{message:string}){return <div className="sources-error" role="alert">{message}</div>;}
function Boundary(){return <div className="sources-boundary">Consultation des candidats normalisés. Leur présence ne prouve pas une publication canonique. Aucune synchronisation n’est déclenchée ; tout rejet exige une confirmation explicite.</div>;}
export function CandidatesPage(){
  const {id}=useParams();const[params]=useSearchParams();
  return <div className="candidates-page"><PageHeader title="CANDIDATS MEETING / EVENT" subtitle="Doublons — consultation et traçabilité"/><Boundary/>{id?<CandidateInspection key={id} id={id} search={params.toString()}/>:<CandidateList key={params.toString()}/>}</div>;
}
function CandidateList(){
  const[params,setParams]=useSearchParams();
  const rawState=params.get('state'),state=candidateStates.includes(rawState as CandidateState)?rawState as CandidateState:'REVIEW_REQUIRED';
  const rawOffset=params.get('offset')??'0',offset=/^\d+$/.test(rawOffset)&&Number.isSafeInteger(Number(rawOffset))?Number(rawOffset):0;
  const[rows,setRows]=useState<CandidateRow[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
  useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');
    void listCandidates(state,offset,controller.signal).then(value=>{if(!controller.signal.aborted)setRows(value);}).catch(reason=>{if(!controller.signal.aborted)setError((reason as Error).message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[state,offset,refresh]);
  const page=(next:number)=>setParams({state,offset:String(next)});
  return <Panel title="CANDIDATS CONNUS" action={<Button disabled={loading} onClick={()=>setRefresh(value=>value+1)}>Actualiser</Button>}>
    <div className="candidate-toolbar"><label htmlFor="candidate-state">État backend</label><select id="candidate-state" value={state} onChange={event=>setParams({state:event.target.value,offset:'0'})}>{candidateStates.map(value=><option key={value} value={value}>{labels[value]} ({value})</option>)}</select></div>
    <p className="candidate-note">Cette liste expose le type, l’état et les dates techniques. Libellés, dates métier et provenance se consultent dans le détail lorsqu’ils sont disponibles. La recherche et les filtres provider/championnat ne sont pas exposés par cette API.</p>
    {error&&<ReadFailure message={error}/>}
    {loading?<p role="status">Chargement des candidats…</p>:error?null:rows.length===0?<EmptyState text="Aucun candidat pour cet état et ce décalage."/>:<div className="candidate-table-wrap"><table className="data-table"><caption className="candidate-note">Dates techniques telles que reçues de l’API ; tri par mise à jour décroissante.</caption><thead><tr><th>Type</th><th>Libellé</th><th>État backend</th><th>Révision</th><th>Mise à jour</th><th>Consultation</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{kind(row.resource_kind)}</td><td>Non renseigné</td><td><StatusChip text={display(row.resolution_state)} tone="muted"/></td><td>{display(row.revision)}</td><td>{display(row.updated_at)}</td><td><Link aria-label={`Consulter ${kind(row.resource_kind)} ${row.id}`} to={`/duplicates/${encodeURIComponent(row.id)}?${new URLSearchParams({state,offset:String(offset)})}`}>Consulter</Link></td></tr>)}</tbody></table></div>}
    <nav className="candidate-toolbar" aria-label="Pagination des candidats"><Button disabled={loading||offset===0} onClick={()=>page(Math.max(0,offset-PAGE_SIZE))}>Précédent</Button><span>Décalage : {offset} · {PAGE_SIZE} maximum par page</span><Button disabled={loading||!!error||rows.length<PAGE_SIZE||!Number.isSafeInteger(offset+PAGE_SIZE)} onClick={()=>page(offset+PAGE_SIZE)}>Suivant</Button></nav>
    <p className="candidate-note">Aucun total disponible. Une page pleine peut être suivie d’une page vide. Les données peuvent se déplacer entre deux lectures.</p>
  </Panel>;
}
function CandidateInspection({id,search}:{id:string;search:string}){
  const[data,setData]=useState<CandidateDetail|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);const heading=useRef<HTMLHeadingElement>(null),listRefresh=useRef<AbortController|null>(null);
  const[notice,setNotice]=useState(''),[listWarning,setListWarning]=useState('');
  const busy=useSyncExternalStore(rejectionLedger.subscribe,()=>rejectionLedger.pending(id),()=>false);
  useEffect(()=>()=>listRefresh.current?.abort(),[]);
  function reloadAfterDecision(message:string){
    setNotice(message);setLoading(true);setError('');setRefresh(value=>value+1);
    const q=new URLSearchParams(search),raw=q.get('state'),state=candidateStates.includes(raw as CandidateState)?raw as CandidateState:'REVIEW_REQUIRED',offset=Number(q.get('offset')??0);
    listRefresh.current?.abort();const controller=new AbortController();listRefresh.current=controller;setListWarning('');
    void listCandidates(state,Number.isSafeInteger(offset)&&offset>=0?offset:0,controller.signal).catch(()=>{if(!controller.signal.aborted)setListWarning('La liste n’a pas pu être actualisée. Actualiser la liste au retour.');});
  }
  useEffect(()=>{heading.current?.focus();const controller=new AbortController();setLoading(true);setError('');
    void getCandidate(id,controller.signal).then(value=>{if(!controller.signal.aborted)setData(value);}).catch(reason=>{if(!controller.signal.aborted)setError((reason as Error).message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[id,refresh]);
  return <><Link to={`/duplicates${search?`?${search}`:''}`}>Retour aux candidats</Link><h2 ref={heading} tabIndex={-1}>Détail du candidat</h2><div className="candidate-toolbar toolbar"><Button disabled={loading||busy} onClick={()=>{setLoading(true);setRefresh(value=>value+1);}}>Actualiser le détail</Button></div>{notice&&<p role="status">{notice}</p>}{listWarning&&<ReadFailure message={listWarning}/>} {error&&<ReadFailure message={error}/>} {loading?<p role="status">Chargement du détail…</p>:data?<><CandidateRejection detail={data} readable={!error} onAccepted={replayed=>reloadAfterDecision(replayed?'Rejet confirmé par le serveur (rejeu idempotent).':'Rejet confirmé par le serveur.')} onReloadRequired={reloadAfterDecision}/><CandidateContent detail={data}/></>:null}</>;
}
export function CandidateContent({detail}:{detail:CandidateDetail}){
  const{candidate,decisions}=detail,data=candidateData(candidate.candidate_data),normalized=record(data.normalized),provenance=record(normalized.provenance),resolution=record(data.resolution),fieldOrigins=record(provenance.fields);
  return <div className="candidate-detail">
    <Panel title={`${kind(candidate.resource_kind)} — ${display(normalized.name)}`}>
      {!Object.keys(normalized).length&&<p role="status">Données normalisées partielles ou absentes.</p>}
      {fields({'Type':kind(candidate.resource_kind),'Nom normalisé':normalized.name,'État du candidat':candidate.resolution_state,'Statut normalisé':normalized.status,'Début (valeur API)':normalized.startsAt,'Fin (valeur API)':normalized.endsAt,'Fuseau source':normalized.timezone,'Saison':normalized.season,'Manche':normalized.round,'Type de séance':normalized.sessionType,'Libellé de séance':normalized.sessionLabel})}
      <p className="candidate-note">Les dates sont conservées sans conversion locale. Un fuseau absent n’est pas déduit. Les données source brutes et les valeurs canoniques effectives ne sont pas exposées par ce GET.</p>
    </Panel>
    <Panel title="PROVENANCE DISPONIBLE">{fields({'Provider':'Non renseigné','Identifiant externe':'Non renseigné','Entité source':provenance.sourceEntityId??candidate.source_entity_id,'Empreinte source':provenance.sourceHash??candidate.source_hash,'Version du mapping':provenance.mappingVersion,'Version des règles':provenance.rulesVersion,'Révision source':data.source_revision})}<p className="candidate-note">Le provider, l’identifiant externe et les dates d’observation/récupération ne sont pas joints par cette API. Une référence source n’est pas un identifiant externe.</p>
      {Object.keys(fieldOrigins).length>0?<dl className="candidate-fields">{Object.entries(fieldOrigins).map(([field,value])=>{const origin=record(value);return <div key={field}><dt>{field}</dt><dd>Origine : {display(origin.origin)} · Correction : {display(origin.correctionId)}</dd></div>;})}</dl>:<p>Provenance par champ : Non renseigné</p>}
    </Panel>
    <Panel title="RAPPROCHEMENT DU CANDIDAT">{fields({'Décision proposée':resolution.decision,'Motif':resolution.reason,'Cible proposée':resolution.targetId,'Score':resolution.score,'Signaux':Array.isArray(resolution.signals)?resolution.signals.filter(value=>typeof value==='string').join(', '):null})}<p className="candidate-note">Une proposition n’est pas une décision validée et ne prouve pas une publication.</p></Panel>
    <Panel title="DÉCISIONS HISTORIQUES">{decisions.length?decisions.map((decision,index)=><article className="candidate-decision" key={String(decision.id??index)}>{fields({'Décision':decision.decision,'Motif':decision.reason,'Auteur':decision.actor_id,'Date':decision.decided_at,'Révision du candidat':decision.candidate_revision,'Type de cible':decision.target_kind,'Cible enregistrée':decision.target_id})}</article>):<EmptyState text="Aucune décision enregistrée."/>}</Panel>
    <details><summary>Références techniques disponibles</summary>{fields({'Candidat':candidate.id,'Révision':candidate.revision,'Création':candidate.created_at,'Mise à jour':candidate.updated_at,'Normalisation':candidate.normalization_version,'UUID proposé (non publié par défaut)':data.proposed_uuid,'Référence championnat':normalized.championshipId,'Référence saison':normalized.championshipSeasonId,'Référence circuit':normalized.circuitId,'Référence lieu':normalized.venueId,'Référence configuration du lieu':normalized.venueLayoutId})}</details>
  </div>;
}
