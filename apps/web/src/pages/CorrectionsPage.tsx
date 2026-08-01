import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../design-system';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
type Correction = { id:string;event_id:string;event_name:string;championship_name:string;provider_key:string;field_name:string;provider_value:unknown;override_value:unknown;status:'active'|'conflict'|'resolved'|'ignored';created_by:string;updated_at:string };
async function call(path:string,init?:RequestInit){const response=await fetch(API+path,init);if(!response.ok)throw new Error((await response.json().catch(()=>({}))).message??response.statusText);return response.status===204?null:response.json()}
const text=(value:unknown)=>value===null?'—':typeof value==='string'?value:JSON.stringify(value);

export function CorrectionsPage(){
  const [rows,setRows]=useState<Correction[]>([]);const [query,setQuery]=useState('');const [conflicts,setConflicts]=useState(false);const [error,setError]=useState('');
  const load=()=>call('/api/v1/admin/corrections').then(setRows).catch((e)=>setError(e.message));
  useEffect(()=>{void load()},[]);
  const filtered=useMemo(()=>rows.filter((row)=>(!conflicts||row.status==='conflict')&&`${row.event_name} ${row.championship_name} ${row.provider_key} ${row.field_name}`.toLowerCase().includes(query.toLowerCase())),[rows,query,conflicts]);
  async function action(id:string,name:'accept-provider'|'keep-override'|'delete'){await call(`/api/v1/admin/corrections/${id}${name==='delete'?'':`/${name}`}`,{method:name==='delete'?'DELETE':'POST'});await load()}
  const groups=Object.values(filtered.reduce<Record<string,Correction[]>>((acc,row)=>{(acc[row.event_id]??=[]).push(row);return acc},{}));
  return <><PageHeader title="CORRECTIONS" subtitle="Overrides locaux appliqués aux données fournisseur"/>
    {error&&<div className="lot3-notice error">{error}</div>}
    <div className="corrections-toolbar"><input aria-label="Rechercher une correction" placeholder="Événement, championnat, champ…" value={query} onChange={(e)=>setQuery(e.target.value)}/><label><input type="checkbox" checked={conflicts} onChange={(e)=>setConflicts(e.target.checked)}/> Conflits uniquement</label><button onClick={()=>void load()}>Actualiser</button></div>
    <section className="corrections-list">{groups.length?groups.map((group)=><article key={group[0].event_id}><header><div><h2>{group[0].event_name}</h2><span>{group[0].championship_name} · {group[0].provider_key}</span></div><b>{group.length} champ(s) corrigé(s)</b></header>
      {group.map((row)=><div className={`correction-field ${row.status}`} key={row.id}><strong>{row.field_name}</strong><span><small>Fournisseur</small><del>{text(row.provider_value)}</del></span><span><small>Valeur locale effective</small><ins>{text(row.override_value)}</ins></span><em>{row.status==='conflict'?'Conflit':'Corrigé'}</em><small>{row.created_by} · {new Date(row.updated_at).toLocaleString('fr-FR')}</small><div><button onClick={()=>void action(row.id,'keep-override')}>Conserver local</button><button onClick={()=>void action(row.id,'accept-provider')}>Accepter fournisseur</button><button onClick={()=>void action(row.id,'delete')}>Supprimer</button></div></div>)}
    </article>):<p className="events-loading">Aucune correction fournisseur active.</p>}</section>
  </>;
}
