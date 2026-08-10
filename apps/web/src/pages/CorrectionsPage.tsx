import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../design-system';
import { CORRECTIONS_PER_PAGE, correctionPage, filterCorrections, type CorrectionFilters, type CorrectionRow } from '../features/corrections/correctionFilters';
import { correctionEditorKind, editableCorrectionValue, parsedCorrectionValue } from '../features/corrections/correctionEditor';
import type { Championship, Circuit } from '../features/events/eventTypes';
import { availableProviderOptions, providerLabel, providerSource } from '../features/events/providerDisplay';
import { adminAuthorization } from '../lib/adminAuth';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
type References = { championships: Map<string, string>; circuits: Map<string, string> };

async function call<T>(path:string,init?:RequestInit):Promise<T>{
  const headers=new Headers(init?.headers);if(init?.body)headers.set('content-type','application/json');
  for(const [name,value] of Object.entries(adminAuthorization()))headers.set(name,value);
  const response=await fetch(API+path,{...init,headers});
  if(!response.ok)throw new Error((await response.json().catch(()=>({}))).message??response.statusText);
  return response.status===204?null as T:response.json();
}

const fieldLabels:Record<string,string>={
  championship_id:'Championnat',circuit_id:'Circuit',name:'Nom',category:'Catégorie',
  starts_at:'Début',ends_at:'Fin',status:'Statut',published:'Publication',description:'Description',session_title:'Intitulé de session'
};
const initialFilters:CorrectionFilters={query:'',championship:'all',provider:'all',field:'all',status:'all',conflict:'all',author:'all',updatedFrom:'',updatedTo:'',minimumFields:1};

function displayValue(row:CorrectionRow,value:unknown,references:References){
  if(value===null)return '—';
  if(typeof value==='string'&&row.field_name==='championship_id')return references.championships.get(value)??'Championnat supprimé';
  if(typeof value==='string'&&row.field_name==='circuit_id')return references.circuits.get(value)??'Circuit supprimé';
  if(typeof value==='boolean')return value?'Publié':'Non publié';
  if(typeof value==='string'&&(row.field_name==='starts_at'||row.field_name==='ends_at'))return new Date(value).toLocaleString('fr-FR',{timeZone:'UTC'});
  if(row.field_name==='status'&&value==='postponed')return 'Reporté';
  return typeof value==='string'?value:JSON.stringify(value);
}

function CorrectionValueEditor({row,value,onChange,references}:{row:CorrectionRow;value:string;onChange:(value:string)=>void;references:References}){
  const label=`Nouvelle valeur ${fieldLabels[row.field_name]??row.field_name}`;
  const kind=correctionEditorKind(row.field_name);
  if(kind==='championship')return <select aria-label={label} value={value} onChange={(event)=>onChange(event.target.value)}>{[...references.championships].sort((a,b)=>a[1].localeCompare(b[1],'fr')).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select>;
  if(kind==='circuit')return <select aria-label={label} value={value} onChange={(event)=>onChange(event.target.value)}><option value="">Aucun circuit</option>{[...references.circuits].sort((a,b)=>a[1].localeCompare(b[1],'fr')).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select>;
  if(kind==='status')return <select aria-label={label} value={value} onChange={(event)=>onChange(event.target.value)}><option value="draft">Brouillon</option><option value="scheduled">Planifié</option><option value="completed">Terminé</option><option value="cancelled">Annulé</option><option value="postponed">Reporté</option></select>;
  if(kind==='published')return <select aria-label={label} value={value} onChange={(event)=>onChange(event.target.value)}><option value="true">Publié</option><option value="false">Non publié</option></select>;
  if(kind==='datetime')return <input aria-label={label} type="datetime-local" step="60" value={value} onChange={(event)=>onChange(event.target.value)}/>;
  return <input aria-label={label} value={value} onChange={(event)=>onChange(event.target.value)}/>;
}

export function CorrectionsPage(){
  const navigate=useNavigate();
  const [rows,setRows]=useState<CorrectionRow[]>([]);
  const [references,setReferences]=useState<References>({championships:new Map(),circuits:new Map()});
  const [filters,setFilters]=useState(initialFilters);
  const [page,setPage]=useState(1);
  const [editingId,setEditingId]=useState<string|null>(null);const [draft,setDraft]=useState('');const [error,setError]=useState('');
  const setFilter=<K extends keyof CorrectionFilters>(key:K,value:CorrectionFilters[K])=>{setFilters((current)=>({...current,[key]:value}));setPage(1)};
  const load=()=>Promise.all([
    call<CorrectionRow[]>('/api/v1/admin/corrections'),call<Championship[]>('/api/v1/championships'),call<Circuit[]>('/api/v1/circuits')
  ]).then(([corrections,championships,circuits])=>{
    setRows(corrections);setReferences({championships:new Map(championships.map((item)=>[item.id,item.name])),circuits:new Map(circuits.map((item)=>[item.id,item.name]))});setError('');
  }).catch((reason:Error)=>setError(reason.message));
  useEffect(()=>{void load()},[]);
  const providers=useMemo(()=>availableProviderOptions(rows.map((row)=>({provider_key:row.provider_key}))),[rows]);
  const championships=useMemo(()=>[...new Map(rows.map((row)=>[row.championship_id,row.championship_name])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'fr')),[rows]);
  const fields=useMemo(()=>[...new Set(rows.map((row)=>row.field_name))].sort((a,b)=>(fieldLabels[a]??a).localeCompare(fieldLabels[b]??b,'fr')),[rows]);
  const authors=useMemo(()=>[...new Set(rows.map((row)=>row.created_by))].sort((a,b)=>a.localeCompare(b,'fr')),[rows]);
  const filtered=useMemo(()=>filterCorrections(rows,filters,(key)=>providerSource(undefined,key),(field)=>fieldLabels[field]??field),[rows,filters]);
  const pageCount=Math.max(1,Math.ceil(filtered.length/CORRECTIONS_PER_PAGE));
  const currentPage=Math.min(page,pageCount);
  const visible=correctionPage(filtered,currentPage);
  const allGroups=Object.values(filtered.reduce<Record<string,CorrectionRow[]>>((acc,row)=>{(acc[row.event_id]??=[]).push(row);return acc},{}));
  const groups=Object.values(visible.reduce<Record<string,CorrectionRow[]>>((acc,row)=>{(acc[row.event_id]??=[]).push(row);return acc},{}));
  async function restoreProvider(id:string){
    try{await call(`/api/v1/admin/corrections/${id}/accept-provider`,{method:'POST'});await load()}catch(reason){setError((reason as Error).message)}
  }
  async function save(row:CorrectionRow){
    try{await call(`/api/v1/admin/corrections/${row.id}`,{method:'PATCH',body:JSON.stringify({field_name:row.field_name,override_value:parsedCorrectionValue(row.field_name,draft)})});setEditingId(null);await load()}catch(reason){setError((reason as Error).message)}
  }
  return <><PageHeader title="CORRECTIONS" subtitle="Overrides locaux appliqués aux données fournisseur"/>
    {error&&<div className="lot3-notice error">{error}</div>}
    <div className="corrections-toolbar">
      <input aria-label="Rechercher une correction" placeholder="Événement, championnat, champ, auteur…" value={filters.query} onChange={(event)=>setFilter('query',event.target.value)}/>
      <select aria-label="Championnat" value={filters.championship} onChange={(event)=>setFilter('championship',event.target.value)}><option value="all">Tous les championnats</option>{championships.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select>
      <select aria-label="Fournisseur" value={filters.provider} onChange={(event)=>setFilter('provider',event.target.value)}><option value="all">Tous les fournisseurs</option>{providers.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}</select>
      <select aria-label="Champ corrigé" value={filters.field} onChange={(event)=>setFilter('field',event.target.value)}><option value="all">Tous les champs</option>{fields.map((field)=><option key={field} value={field}>{fieldLabels[field]??field}</option>)}</select>
      <select aria-label="Statut de correction" value={filters.status} onChange={(event)=>setFilter('status',event.target.value)}><option value="all">Tous les statuts</option><option value="active">Corrigé</option><option value="conflict">Conflit</option><option value="resolved">Résolu</option><option value="ignored">Ignoré</option></select>
      <select aria-label="Présence d’un conflit" value={filters.conflict} onChange={(event)=>setFilter('conflict',event.target.value)}><option value="all">Tous les conflits</option><option value="yes">Avec conflit</option><option value="no">Sans conflit</option></select>
      <select aria-label="Auteur" value={filters.author} onChange={(event)=>setFilter('author',event.target.value)}><option value="all">Tous les auteurs</option>{authors.map((author)=><option key={author}>{author}</option>)}</select>
      <select aria-label="Nombre de champs" value={filters.minimumFields} onChange={(event)=>setFilter('minimumFields',Number(event.target.value))}><option value={1}>1 champ ou plus</option><option value={2}>2 champs ou plus</option><option value={3}>3 champs ou plus</option></select>
      <label>Du <input aria-label="Corrections modifiées depuis" type="date" value={filters.updatedFrom} onChange={(event)=>setFilter('updatedFrom',event.target.value)}/></label>
      <label>Au <input aria-label="Corrections modifiées jusqu’au" type="date" value={filters.updatedTo} onChange={(event)=>setFilter('updatedTo',event.target.value)}/></label>
      <button onClick={()=>{setFilters(initialFilters);setPage(1)}}>Réinitialiser</button><button onClick={()=>void load()}>Actualiser</button>
    </div>
    <div className="corrections-summary"><b>{allGroups.length}</b> événement(s) · <b>{filtered.length}</b> correction(s)</div>
    <section className="corrections-list">{groups.length?groups.map((group)=><article key={group[0].event_id}><header><div><h2>{group[0].event_name}</h2><span>{group[0].championship_name} · {providerLabel(undefined,group[0].provider_key)}</span></div><div><b>{group.length} champ(s) corrigé(s)</b><button onClick={()=>navigate(`/events?event_id=${encodeURIComponent(group[0].event_id)}`)}>Ouvrir l’événement</button></div></header>
      {group.map((row)=><div className={`correction-field ${row.status}`} key={row.id}><strong>{fieldLabels[row.field_name]??row.field_name}<small>Valeur modifiée</small></strong><span><small>Fournisseur</small><del>{displayValue(row,row.provider_value,references)}</del></span><span><small>Valeur locale effective</small>{editingId===row.id?<CorrectionValueEditor row={row} value={draft} onChange={setDraft} references={references}/>:<ins>{displayValue(row,row.override_value,references)}</ins>}</span><em>{row.status==='conflict'?'Conflit':row.status==='active'?'Corrigé':row.status}</em><small>{row.created_by} · {new Date(row.updated_at).toLocaleString('fr-FR')}<br/>Dernière source : {row.last_provider_seen_at?new Date(row.last_provider_seen_at).toLocaleString('fr-FR'):'—'}</small><div>{editingId===row.id?<><button onClick={()=>void save(row)}>Enregistrer</button><button onClick={()=>setEditingId(null)}>Annuler</button></>:<button onClick={()=>{setEditingId(row.id);setDraft(editableCorrectionValue(row.field_name,row.override_value))}}>Modifier local</button>}<button onClick={()=>void restoreProvider(row.id)}>Restaurer fournisseur</button></div></div>)}
    </article>):<p className="events-loading">Aucune correction fournisseur ne correspond aux filtres.</p>}</section>
    {filtered.length>0&&<nav className="events-pagination" aria-label="Pagination des corrections"><button disabled={currentPage<=1} onClick={()=>setPage((current)=>Math.max(1,current-1))}>‹ Précédente</button><span>Page <b>{currentPage}</b> sur <b>{pageCount}</b> · {filtered.length} corrections</span><button disabled={currentPage>=pageCount} onClick={()=>setPage((current)=>Math.min(pageCount,current+1))}>Suivante ›</button></nav>}
  </>;
}
