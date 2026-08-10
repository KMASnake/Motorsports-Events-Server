import { useEffect, useState } from 'react';
import { acceptSessionProvider, keepSessionCorrection, loadSessionCorrections, restoreSessionProvider } from './sessionApi';
import type { SessionCorrection, SessionRow } from './sessionTypes';
import { statusLabels } from './sessionUtils';

const labels: Record<SessionCorrection['field_name'], string> = { title:'Intitulé',starts_at:'Début',ends_at:'Fin',status:'Statut',published:'Publication',description:'Description' };
function display(field: SessionCorrection['field_name'], value: unknown) {
  if (value == null) return 'Non définie';
  if (field === 'starts_at' || field === 'ends_at') return new Date(String(value)).toLocaleString('fr-FR');
  if (field === 'published') return value ? 'Publiée' : 'Non publiée';
  if (field === 'status') return statusLabels[String(value) as keyof typeof statusLabels] ?? String(value);
  return String(value);
}

export function SessionCorrectionsDialog({ session, onClose, onChanged }: { session: SessionRow; onClose: () => void; onChanged: () => void }) {
  const [rows,setRows]=useState<SessionCorrection[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null);
  async function load(){setLoading(true);try{setRows(await loadSessionCorrections(session.id));setError(null)}catch(reason){setError((reason as Error).message)}finally{setLoading(false)}}
  useEffect(()=>{void load()},[session.id]);
  async function action(task:()=>Promise<unknown>){try{await task();await load();onChanged()}catch(reason){setError((reason as Error).message)}}
  return <div className="lot3-modal-backdrop" onMouseDown={onClose}><section className="lot3-modal session-corrections-dialog" role="dialog" aria-modal="true" aria-labelledby="session-corrections-title" onMouseDown={(event)=>event.stopPropagation()}>
    <header><div><small>SESSION FOURNISSEUR</small><h2 id="session-corrections-title">Corrections · {session.title}</h2></div><button onClick={onClose} aria-label="Fermer">×</button></header>
    <div className="session-corrections-content">{error&&<div className="events-form-error" role="alert">{error}</div>}{loading?<p>Chargement des corrections…</p>:rows.length===0?<div className="session-empty">Aucune correction active pour cette Session.</div>:rows.map((row)=><article className={`session-correction ${row.status}`} key={row.id}>
      <header><strong>{labels[row.field_name]}</strong><span>{row.status==='conflict'?'Conflit':'Correction locale'}</span></header>
      <div><p><small>Valeur fournisseur</small><del>{display(row.field_name,row.provider_value)}</del></p><p><small>Valeur locale effective</small><ins>{display(row.field_name,row.effective_value)}</ins></p></div>
      <footer><button onClick={()=>void action(()=>keepSessionCorrection(row.id))}>Conserver override local</button><button onClick={()=>void action(()=>acceptSessionProvider(row.id))}>Accepter fournisseur</button><button onClick={()=>void action(()=>restoreSessionProvider(row.id))}>Restaurer fournisseur</button></footer>
    </article>)}</div>
  </section></div>;
}
