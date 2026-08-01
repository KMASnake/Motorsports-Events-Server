import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../design-system';
import type { Championship, Circuit } from '../features/events/eventTypes';
import { availableProviderOptions, providerLabel, providerSource } from '../features/events/providerDisplay';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
type Correction = { id:string;event_id:string;event_name:string;championship_name:string;provider_key:string;field_name:string;provider_value:unknown;override_value:unknown;status:'active'|'conflict'|'resolved'|'ignored';created_by:string;updated_at:string };
type References = { championships: Map<string, string>; circuits: Map<string, string> };

async function call<T>(path:string,init?:RequestInit):Promise<T>{
  const response=await fetch(API+path,init);
  if(!response.ok)throw new Error((await response.json().catch(()=>({}))).message??response.statusText);
  return response.status===204?null as T:response.json();
}

const fieldLabels:Record<string,string>={
  championship_id:'Championnat',circuit_id:'Circuit',name:'Nom',slug:'Identifiant URL',
  category:'Catégorie',starts_at:'Début',ends_at:'Fin',timezone:'Fuseau horaire',
  status:'Statut',published:'Publication',description:'Description'
};

function displayValue(row:Correction,value:unknown,references:References){
  if(value===null)return '—';
  if(typeof value==='string'&&row.field_name==='championship_id')return references.championships.get(value)??'Championnat supprimé';
  if(typeof value==='string'&&row.field_name==='circuit_id')return references.circuits.get(value)??'Circuit supprimé';
  if(typeof value==='boolean')return value?'Publié':'Non publié';
  if(typeof value==='string'&&(row.field_name==='starts_at'||row.field_name==='ends_at'))return new Date(value).toLocaleString('fr-FR');
  return typeof value==='string'?value:JSON.stringify(value);
}

export function CorrectionsPage(){
  const [rows,setRows]=useState<Correction[]>([]);
  const [references,setReferences]=useState<References>({championships:new Map(),circuits:new Map()});
  const [query,setQuery]=useState('');const [provider,setProvider]=useState('all');const [conflicts,setConflicts]=useState(false);const [error,setError]=useState('');
  const load=()=>Promise.all([
    call<Correction[]>('/api/v1/admin/corrections'),
    call<Championship[]>('/api/v1/championships'),
    call<Circuit[]>('/api/v1/circuits')
  ]).then(([corrections,championships,circuits])=>{
    setRows(corrections);
    setReferences({
      championships:new Map(championships.map((item)=>[item.id,item.name])),
      circuits:new Map(circuits.map((item)=>[item.id,item.name]))
    });
    setError('');
  }).catch((reason:Error)=>setError(reason.message));
  useEffect(()=>{void load()},[]);
  const providers=useMemo(()=>availableProviderOptions(rows.map((row)=>({provider_key:row.provider_key}))),[rows]);
  const filtered=useMemo(()=>rows.filter((row)=>(provider==='all'||providerSource(undefined,row.provider_key)===provider)&&(!conflicts||row.status==='conflict')&&`${row.event_name} ${row.championship_name} ${row.provider_key} ${fieldLabels[row.field_name]??row.field_name}`.toLowerCase().includes(query.toLowerCase())),[rows,query,provider,conflicts]);
  async function action(id:string,name:'accept-provider'|'keep-override'|'delete'){await call(`/api/v1/admin/corrections/${id}${name==='delete'?'':`/${name}`}`,{method:name==='delete'?'DELETE':'POST'});await load()}
  const groups=Object.values(filtered.reduce<Record<string,Correction[]>>((acc,row)=>{(acc[row.event_id]??=[]).push(row);return acc},{}));
  return <><PageHeader title="CORRECTIONS" subtitle="Overrides locaux appliqués aux données fournisseur"/>
    {error&&<div className="lot3-notice error">{error}</div>}
    <div className="corrections-toolbar"><input aria-label="Rechercher une correction" placeholder="Événement, championnat, champ…" value={query} onChange={(event)=>setQuery(event.target.value)}/><select aria-label="Fournisseur" value={provider} onChange={(event)=>setProvider(event.target.value)}><option value="all">Tous les fournisseurs</option>{providers.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}</select><label><input type="checkbox" checked={conflicts} onChange={(event)=>setConflicts(event.target.checked)}/> Conflits uniquement</label><button onClick={()=>void load()}>Actualiser</button></div>
    <section className="corrections-list">{groups.length?groups.map((group)=><article key={group[0].event_id}><header><div><h2>{group[0].event_name}</h2><span>{group[0].championship_name} · {providerLabel(undefined,group[0].provider_key)}</span></div><b>{group.length} champ(s) corrigé(s)</b></header>
      {group.map((row)=><div className={`correction-field ${row.status}`} key={row.id}><strong>{fieldLabels[row.field_name]??row.field_name}</strong><span><small>Fournisseur</small><del>{displayValue(row,row.provider_value,references)}</del></span><span><small>Valeur locale effective</small><ins>{displayValue(row,row.override_value,references)}</ins></span><em>{row.status==='conflict'?'Conflit':'Corrigé'}</em><small>{row.created_by} · {new Date(row.updated_at).toLocaleString('fr-FR')}</small><div><button onClick={()=>void action(row.id,'keep-override')}>Conserver local</button><button onClick={()=>void action(row.id,'accept-provider')}>Accepter fournisseur</button><button onClick={()=>void action(row.id,'delete')}>Supprimer</button></div></div>)}
    </article>):<p className="events-loading">Aucune correction fournisseur active.</p>}</section>
  </>;
}
