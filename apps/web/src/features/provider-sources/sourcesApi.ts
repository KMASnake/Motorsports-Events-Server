import {adminAuthorization,notifyAuthenticationRequired} from '../../lib/adminAuth';
const API=import.meta.env.VITE_API_URL??(import.meta.env.DEV?'http://localhost:3001':'');
export type Provider={id:string;name:string;adapter_key:string;enabled:boolean;state:string;discovery_enabled:boolean;max_concurrency:number;config:Record<string,unknown>;secrets:Array<{name:string;configured:boolean}>;championship_count:number;updated_at:string};
export type ProviderChampionship={id:string;championship_id:string;championship_name:string;external_championship_id:string;sync_state:'inactive'|'active'|'paused';is_primary:boolean;source_config:Record<string,unknown>|null;current_stream_id:string|null};
async function request<T>(path:string,init:RequestInit={}):Promise<T>{const headers=new Headers(init.headers);if(init.body)headers.set('Content-Type','application/json');for(const[key,value]of Object.entries(adminAuthorization()))headers.set(key,value);const response=await fetch(API+path,{...init,headers,credentials:'include'});if(response.status===401){notifyAuthenticationRequired();throw new Error('Authentification requise.');}if(!response.ok){const body=await response.json().catch(()=>({})) as {message?:string};throw new Error(body.message??'Opération impossible.');}return response.json() as Promise<T>;}
export const listProviders=()=>request<Provider[]>('/api/v1/admin/providers');
export const createProvider=(value:unknown)=>request<Provider>('/api/v1/admin/providers',{method:'POST',body:JSON.stringify(value)});
export const updateProvider=(id:string,value:unknown)=>request<Provider>(`/api/v1/admin/providers/${id}`,{method:'PATCH',body:JSON.stringify(value)});
export const replaceCredential=(id:string,value:string)=>request<{secretConfigured:boolean}>(`/api/v1/admin/providers/${id}/secrets/api_key`,{method:'PUT',body:JSON.stringify({value})});
export const listChampionships=(id:string)=>request<ProviderChampionship[]>(`/api/v1/admin/providers/${id}/championships`);
export const createChampionship=(id:string,value:unknown)=>request(`/api/v1/admin/providers/${id}/championship-sources/manual`,{method:'POST',body:JSON.stringify(value)});
export const updateChampionship=(id:string,value:unknown)=>request(`/api/v1/admin/provider-championships/${id}`,{method:'PATCH',body:JSON.stringify(value)});
export const updateSyncState=(id:string,state:'inactive'|'active'|'paused',current:string)=>request(`/api/v1/admin/provider-championships/${id}/sync/${state==='active'?(current==='paused'?'resume':'activate'):state==='paused'?'pause':'deactivate'}`,{method:'POST'});
export const updateSourceConfig=(id:string,config:unknown)=>request(`/api/v1/admin/provider-championships/${id}/source-config`,{method:'PUT',body:JSON.stringify({config})});
export const quota=(id:string)=>request<Record<string,unknown>>(`/api/v1/admin/providers/${id}/quota-policy`);
export const saveQuota=(id:string,value:unknown)=>request(`/api/v1/admin/providers/${id}/quota-policy`,{method:'PUT',body:JSON.stringify(value)});
export const mappings=(id:string)=>request<{active:any;versions:any[]}>(`/api/v1/admin/provider-championships/${id}/normalization-mappings`);
export const createMapping=(id:string,value:unknown)=>request(`/api/v1/admin/provider-championships/${id}/normalization-mappings`,{method:'POST',body:JSON.stringify(value)});
export const preflight=(id:string)=>request<Record<string,unknown>>(`/api/v1/admin/provider-championships/${id}/preflight`,{method:'POST',body:JSON.stringify({max_provider_requests:1})});
