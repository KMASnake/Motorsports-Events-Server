import type { ChampionshipDiscoveryResult, JsonObject, ProviderAdapter, ProviderAdapterContext, ProviderFieldSchema } from './contracts.js';
import { fetchProviderJson, type ProviderFetch } from './providerHttp.js';

type Config = JsonObject & { base_url: string; discovery_complete?: boolean };
type Source = JsonObject & { strategy: string; external_id: string; endpoint_template?: string };
type Cursor = JsonObject & { position: number };
export type AdapterCatalogEntry = { externalId:string; name:string; strategy:string; endpointTemplate:string };

const OC_BLACKTOP_CATALOG:readonly AdapterCatalogEntry[]=[
  ['formula1','Formula 1'],['formula2','Formula 2'],['formula3','Formula 3'],['formula-e','Formula E'],
  ['indycar','IndyCar'],['moto-gp','MotoGP'],['moto2','Moto2'],['moto3','Moto3'],['nascar','NASCAR'],
  ['wec','WEC'],['wrc','WRC']
].map(([externalId,name])=>({externalId,name,strategy:'series-events-v1',endpointTemplate:'/{series}/events'}));

function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Objet attendu.');return value as Record<string,unknown>;}
function baseConfig(value:unknown,expectedHost:string,extras=false):Config{const row=object(value),raw=row.base_url;if(typeof raw!=='string')throw new Error('URL requise.');const url=new URL(raw);if(url.protocol!=='https:'||url.hostname!==expectedHost||url.username||url.password)throw new Error('URL non autorisée.');const result:Config={base_url:url.toString().replace(/\/$/,'')};if(extras){if(row.discovery_complete!==undefined&&typeof row.discovery_complete!=='boolean')throw new Error('Complétude invalide.');result.discovery_complete=row.discovery_complete===true;}return result;}
function sourceConfig(value:unknown):Source{const row=object(value),allowed=new Set(['strategy','external_id','endpoint_template']);if(Object.keys(row).some(key=>!allowed.has(key)))throw new Error('Champ source inconnu ou sensible.');if(typeof row.strategy!=='string'||typeof row.external_id!=='string'||!row.external_id.trim())throw new Error('Source invalide.');if(row.endpoint_template!==undefined&&typeof row.endpoint_template!=='string')throw new Error('Endpoint invalide.');return {strategy:row.strategy.trim(),external_id:row.external_id.trim(),...(row.endpoint_template?{endpoint_template:row.endpoint_template.trim()}:{})};}
function unsupported():never{throw new Error('La synchronisation des événements appartient à un sous-lot ultérieur.');}

abstract class DiscoveryAdapter implements ProviderAdapter<Config,Source,Cursor,JsonObject>{
  abstract readonly key:string;abstract readonly expectedHost:string;abstract readonly defaultBaseUrl:string;
  readonly capabilities={supportsChampionshipDiscovery:true,supportsSeasonDiscovery:false,supportsQuotaHeaders:false,supportsConnectionTest:true};readonly providerConfigVersion=1;readonly sourceConfigVersion=1;readonly cursorVersion=1;
  constructor(readonly fetchImpl?:ProviderFetch){}
  providerForm():readonly ProviderFieldSchema[]{return [{key:'base_url',label:'URL de base',type:'url',required:true}];}
  championshipForm():readonly ProviderFieldSchema[]{return [{key:'external_id',label:'Identifiant externe',type:'text',required:true}];}
  validateSourceConfig(value:unknown){return sourceConfig(value);}initialCursor(){return {position:0};}
  validateCursor(value:unknown){const row=object(value);if(!Number.isInteger(row.position))throw new Error('Curseur invalide.');return {position:Number(row.position)};}serializeCursor(value:Cursor){return value;}restoreCursor(value:unknown,version:number){if(version!==1)throw new Error('Version curseur inconnue.');return this.validateCursor(value);}fetchWorkUnit():never{return unsupported();}normalize(){return {accepted:[],rejected:[]};}async confirmEmptySeason(){return {confirmedEmpty:false,reason:'Hors périmètre 5.3.'};}
  protected async json(path:string,context:ProviderAdapterContext<Config>,query:Record<string,string>={}){const url=new URL(`${context.providerConfig.base_url}${path}`);for(const [key,value]of Object.entries(query))url.searchParams.set(key,value);return fetchProviderJson({url,allowedHosts:[this.expectedHost],headers:this.headers(context),counter:context.requestCounter,fetchImpl:this.fetchImpl,gate:context.requestGate});}
  protected abstract headers(context:ProviderAdapterContext<Config>):Record<string,string>;abstract validateProviderConfig(value:unknown):Config;abstract testConnection(context:ProviderAdapterContext<Config>):Promise<{ok:boolean;message:string;checkedAt:string}>;abstract discoverChampionships(context:ProviderAdapterContext<Config>):Promise<ChampionshipDiscoveryResult<Source>>;
}

export class OcBlackTopAdapter extends DiscoveryAdapter{
  readonly key='ocblacktop';readonly expectedHost='api.ocblacktop.com';readonly defaultBaseUrl='https://api.ocblacktop.com/v1';
  constructor(fetchImpl?:ProviderFetch,readonly catalog:readonly AdapterCatalogEntry[]=OC_BLACKTOP_CATALOG){super(fetchImpl);}
  validateProviderConfig(value:unknown){return baseConfig(value,this.expectedHost);}
  championshipForm():readonly ProviderFieldSchema[]{return [{key:'external_id',label:'Identifiant de série',type:'text',required:true,help:'Identifiant court fourni par OCBlackTop.'},{key:'strategy',label:'Stratégie',type:'select',required:true,options:[{value:'series-events-v1',label:'Événements de série v1'}]},{key:'endpoint_template',label:'Modèle endpoint',type:'select',required:true,options:[{value:'/{series}/events',label:'/{series}/events'}],help:'Modèle relatif sûr ; aucune URL complète n’est acceptée.'}];}
  validateSourceConfig(value:unknown){const config=sourceConfig(value);if(config.strategy!=='series-events-v1')throw new Error('Stratégie OCBlackTop inconnue.');if(!/^[a-z0-9][a-z0-9-]{0,79}$/.test(config.external_id))throw new Error('Identifiant OCBlackTop invalide.');if(config.endpoint_template!=='/{series}/events')throw new Error('Modèle endpoint OCBlackTop non autorisé.');return config;}
  protected headers(context:ProviderAdapterContext<Config>){const key=context.credentials.api_key;if(!key)throw new Error('Clé API OCBlackTop absente.');return {accept:'application/json','x-api-key':key};}
  async testConnection(context:ProviderAdapterContext<Config>){const sample=this.catalog[0];if(!sample)throw new Error('Catalogue OCBlackTop vide.');const path=sample.endpointTemplate.replace('{series}',encodeURIComponent(sample.externalId));await this.json(path,context,{page:'1',limit:'1',year:String(new Date().getUTCFullYear())});return {ok:true,message:'Connexion OCBlackTop réussie.',checkedAt:new Date().toISOString()};}
  async discoverChampionships():Promise<ChampionshipDiscoveryResult<Source>>{return {complete:true,provenance:'adapter-known-catalog',items:this.catalog.map(entry=>({externalChampionshipId:entry.externalId,name:entry.name,sourceConfig:{strategy:entry.strategy,external_id:entry.externalId,endpoint_template:entry.endpointTemplate},metadata:{provenance:'adapter-known-catalog'}}))};}
}

export class TheSportsDbAdapter extends DiscoveryAdapter{
  readonly key='thesportsdb';readonly expectedHost='www.thesportsdb.com';readonly defaultBaseUrl='https://www.thesportsdb.com/api/v1/json';
  providerForm():readonly ProviderFieldSchema[]{return [...super.providerForm(),{key:'discovery_complete',label:'Catalogue all_leagues exhaustif pour ce compte',type:'boolean',required:false}];}
  validateProviderConfig(value:unknown){return baseConfig(value,this.expectedHost,true);}
  championshipForm():readonly ProviderFieldSchema[]{return [{key:'external_id',label:'Identifiant de ligue',type:'text',required:true,help:'Identifiant numérique TheSportsDB.'},{key:'strategy',label:'Stratégie',type:'select',required:true,options:[{value:'league-season-v1',label:'Saison de ligue v1'}]}];}
  validateSourceConfig(value:unknown){const config=sourceConfig(value);if(config.strategy!=='league-season-v1'||config.endpoint_template!==undefined||!/^\d{1,20}$/.test(config.external_id))throw new Error('Configuration TheSportsDB inconnue.');return config;}
  protected headers(){return {accept:'application/json'};}private credentialKey(context:ProviderAdapterContext<Config>){const key=context.credentials.api_key;if(!key)throw new Error('Clé API TheSportsDB absente.');return encodeURIComponent(key);}
  async testConnection(context:ProviderAdapterContext<Config>){await this.json(`/${this.credentialKey(context)}/all_leagues.php`,context);return {ok:true,message:'Connexion TheSportsDB réussie.',checkedAt:new Date().toISOString()};}
  async discoverChampionships(context:ProviderAdapterContext<Config>):Promise<ChampionshipDiscoveryResult<Source>>{const payload=object(await this.json(`/${this.credentialKey(context)}/all_leagues.php`,context)),rows=Array.isArray(payload.leagues)?payload.leagues:[],items=[];for(const raw of rows){const row=object(raw),sport=String(row.strSport??'').toLowerCase();if(!sport.includes('motor'))continue;const id=String(row.idLeague??'').trim(),name=String(row.strLeague??id).trim();if(id&&name)items.push({externalChampionshipId:id,name,sourceConfig:{strategy:'league-season-v1',external_id:id},metadata:{sport:String(row.strSport??''),provenance:'provider-discovered'}});}return {items,complete:context.providerConfig.discovery_complete===true,provenance:'provider-discovered'};}
}

export function registerBuiltInAdapters(registry:{get(key:string):unknown;register(adapter:ProviderAdapter<Config,Source,Cursor,JsonObject>):void}){if(!registry.get('ocblacktop'))registry.register(new OcBlackTopAdapter());if(!registry.get('thesportsdb'))registry.register(new TheSportsDbAdapter());}
