import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createSession, deleteSession, loadSessionCorrections, loadSessions, loadSessionTitles, SessionApiError, updateSession } from './sessionApi';
import { SessionCorrectionsDialog } from './SessionCorrectionsDialog';
import { SessionEditorDialog } from './SessionEditorDialog';
import type { SessionCorrection, SessionFormState, SessionRow } from './sessionTypes';
import { deduplicateTitles, emptySessionForm, sessionToForm, statusLabels } from './sessionUtils';

export function EventSessionsSection({ eventId, eventStart }: { eventId: string; eventStart: string }) {
  const [sessions,setSessions]=useState<SessionRow[]>([]); const [corrections,setCorrections]=useState<SessionCorrection[]>([]);
  const [suggestions,setSuggestions]=useState<string[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null); const [notice,setNotice]=useState<string|null>(null);
  const [editorOpen,setEditorOpen]=useState(false); const [editing,setEditing]=useState<SessionRow|null>(null); const [form,setForm]=useState<SessionFormState>(()=>emptySessionForm(eventStart)); const [formError,setFormError]=useState<string|null>(null); const [saving,setSaving]=useState(false); const [correctionSession,setCorrectionSession]=useState<SessionRow|null>(null);
  const correctionSessions=useMemo(()=>new Set(corrections.map((row)=>row.session_id)),[corrections]);

  async function load(){setLoading(true);try{const next=await loadSessions(eventId);const correctionRows=(await Promise.all(next.filter((session)=>session.origin!=='manual').map((session)=>loadSessionCorrections(session.id)))).flat();const titles=await loadSessionTitles();setSessions(next);setCorrections(correctionRows);setSuggestions(deduplicateTitles(titles.map((item)=>item.title)));setError(null)}catch(reason){setError(messageFor(reason))}finally{setLoading(false)}}
  useEffect(()=>{void load()},[eventId]);
  function startCreate(){setEditing(null);setForm(emptySessionForm(eventStart));setFormError(null);setEditorOpen(true)}
  function startEdit(session:SessionRow){if(session.origin!=='manual'){setCorrectionSession(session);return}setEditing(session);setForm(sessionToForm(session));setFormError(null);setEditorOpen(true)}
  async function submit(event:FormEvent){event.preventDefault();if(form.ends_at&&new Date(form.ends_at)<new Date(form.starts_at)){setFormError('La fin doit être postérieure ou égale au début.');return}setSaving(true);try{if(editing)await updateSession(editing.id,form);else await createSession(eventId,form);setEditorOpen(false);setNotice(editing?'Session mise à jour.':'Session ajoutée.');await load()}catch(reason){setFormError(messageFor(reason))}finally{setSaving(false)}}
  async function remove(session:SessionRow){if(session.origin!=='manual'){setCorrectionSession(session);return}if(!confirm(`Supprimer la Session « ${session.title} » ?`))return;const previous=sessions;setSessions((current)=>current.filter((item)=>item.id!==session.id));try{await deleteSession(session.id);setNotice('Session supprimée.')}catch(reason){setSessions(previous);setError(`Suppression annulée : ${messageFor(reason)}`)}}
  return <section className="event-sessions" aria-label="Sessions de l’événement">
    <header><div><h4>Sessions</h4><small>{sessions.length} session(s) · ordre chronologique</small></div><button className="danger" onClick={startCreate}>+ Ajouter</button></header>
    {notice&&<div className="session-notice" role="status">{notice}<button onClick={()=>setNotice(null)}>×</button></div>}
    {error&&<div className="session-error" role="alert">{error}<button onClick={()=>void load()}>Réessayer</button></div>}
    {loading?<div className="session-empty">Chargement des Sessions…</div>:sessions.length===0?<div className="session-empty">Aucune Session. Ajoutez la première depuis cet événement.</div>:<div className="session-list">{sessions.map((session)=><article key={session.id} data-origin={session.origin}>
      <div className="session-time"><strong>{new Date(session.starts_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</strong><small>{new Date(session.starts_at).toLocaleDateString('fr-FR')}</small></div>
      <div className="session-main"><strong>{session.title}</strong><small>{session.ends_at?`Fin ${new Date(session.ends_at).toLocaleString('fr-FR')}`:'Fin non définie'}</small><span>{statusLabels[session.status]} · {session.published?'Publiée':'Non publiée'}</span></div>
      <div className="session-badges">{session.origin!=='manual'&&<b>Fournisseur</b>}{correctionSessions.has(session.id)&&<b className="conflict">✎ Correction</b>}</div>
      <div className="session-actions">{session.origin==='manual'?<><button onClick={()=>startEdit(session)}>Modifier</button><button className="delete" onClick={()=>void remove(session)}>Supprimer</button></>:<button onClick={()=>setCorrectionSession(session)}>{correctionSessions.has(session.id)?'Traiter la correction':'Voir fournisseur'}</button>}</div>
    </article>)}</div>}
    <SessionEditorDialog open={editorOpen} editing={Boolean(editing)} saving={saving} value={form} suggestions={suggestions} error={formError} onChange={setForm} onClose={()=>setEditorOpen(false)} onSubmit={submit}/>
    {correctionSession&&<SessionCorrectionsDialog session={correctionSession} onClose={()=>setCorrectionSession(null)} onChanged={()=>void load()}/>}
  </section>;
}

function messageFor(reason:unknown){if(reason instanceof SessionApiError){if(reason.status===401)return'Authentification requise.';if(reason.status===403)return'Accès administrateur requis.';if(reason.status===404)return'Session ou événement introuvable.';if(reason.status===409)return`Conflit : ${reason.message}`;if(reason.status===400)return`Données invalides : ${reason.message}`}return(reason as Error).message}
