import { ProviderAcquisitionError, type AcquiredProviderSourceItem, type ChampionshipDiscoveryResult, type FetchWorkUnitInput, type FetchWorkUnitResult, type JsonObject, type ProviderAdapter, type ProviderAdapterContext, type ProviderFieldSchema } from './contracts.js';
import { providerRows, resolveProviderPage, type PageCursor, validatePageCursor, validateProviderSourceItems } from './acquisition.js';
import { fetchProviderJson, type ProviderFetch } from './providerHttp.js';

type Config = JsonObject & { base_url: string; discovery_complete?: boolean };
type Source = JsonObject & { strategy: string; external_id: string; endpoint_template?: string };
type Cursor = PageCursor;
export type AdapterCatalogEntry = { externalId:string; name:string; strategy:string; endpointTemplate:string };

const OC_BLACKTOP_CATALOG:readonly AdapterCatalogEntry[]=[
  ['formula1','Formula 1'],['formula2','Formula 2'],['formula3','Formula 3'],['formula-e','Formula E'],
  ['indycar','IndyCar'],['moto-gp','MotoGP'],['moto2','Moto2'],['moto3','Moto3'],['nascar','NASCAR'],
  ['wec','WEC']
].map(([externalId,name])=>({externalId,name,strategy:'series-events-v1',endpointTemplate:'/{series}/events'}));
const OC_BLACKTOP_SOURCE_STRATEGIES={
  'series-events-v1':'/{series}/events',
  'season-rallies-v1':'/{series}/seasons/{year}'
} as const;
const OC_BLACKTOP_CATALOG_WITH_WRC:readonly AdapterCatalogEntry[]=[...OC_BLACKTOP_CATALOG,{externalId:'wrc',name:'WRC',strategy:'season-rallies-v1',endpointTemplate:'/{series}/seasons/{year}'}];

function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Objet attendu.');return value as Record<string,unknown>;}
function baseConfig(value:unknown,expectedHost:string,extras=false):Config{const row=object(value),raw=row.base_url;if(typeof raw!=='string')throw new Error('URL requise.');const url=new URL(raw);if(url.protocol!=='https:'||url.hostname!==expectedHost||url.username||url.password)throw new Error('URL non autorisée.');const result:Config={base_url:url.toString().replace(/\/$/,'')};if(extras){if(row.discovery_complete!==undefined&&typeof row.discovery_complete!=='boolean')throw new Error('Complétude invalide.');result.discovery_complete=row.discovery_complete===true;}return result;}
function sourceConfig(value:unknown):Source{const row=object(value),allowed=new Set(['strategy','external_id','endpoint_template']);if(Object.keys(row).some(key=>!allowed.has(key)))throw new Error('Champ source inconnu ou sensible.');if(typeof row.strategy!=='string'||typeof row.external_id!=='string'||!row.external_id.trim())throw new Error('Source invalide.');if(row.endpoint_template!==undefined&&typeof row.endpoint_template!=='string')throw new Error('Endpoint invalide.');return {strategy:row.strategy.trim(),external_id:row.external_id.trim(),...(row.endpoint_template?{endpoint_template:row.endpoint_template.trim()}:{})};}
abstract class DiscoveryAdapter implements ProviderAdapter<Config,Source,Cursor,AcquiredProviderSourceItem>{
  abstract readonly key:string;abstract readonly expectedHost:string;abstract readonly defaultBaseUrl:string;
  readonly capabilities={supportsChampionshipDiscovery:true,supportsSeasonDiscovery:false,supportsQuotaHeaders:false,supportsConnectionTest:true};readonly providerConfigVersion=1;readonly sourceConfigVersion=1;readonly cursorVersion=1;
  constructor(readonly fetchImpl?:ProviderFetch){}
  providerForm():readonly ProviderFieldSchema[]{return [{key:'base_url',label:'URL de base',type:'url',required:true}];}
  championshipForm():readonly ProviderFieldSchema[]{return [{key:'external_id',label:'Identifiant externe',type:'text',required:true}];}
  validateSourceConfig(value:unknown){return sourceConfig(value);}initialCursor(){return {page:1,visited:[]};}
  validateCursor(value:unknown){return validatePageCursor(value);}serializeCursor(value:Cursor){return value;}restoreCursor(value:unknown,version:number){if(version!==1)throw new Error('Version curseur inconnue.');return this.validateCursor(value);}abstract fetchWorkUnit(input:FetchWorkUnitInput<Config,Source,Cursor>):Promise<FetchWorkUnitResult<AcquiredProviderSourceItem,Cursor>>;normalize(){return {accepted:[],rejected:[]};}async confirmEmptySeason(){return {confirmedEmpty:false,reason:'La décision transactionnelle appartient au sous-lot 5.6-C.'};}
  protected async json(path:string,context:ProviderAdapterContext<Config>,query:Record<string,string>={},signal?:AbortSignal){const url=new URL(`${context.providerConfig.base_url}${path}`);for(const [key,value]of Object.entries(query))url.searchParams.set(key,value);return fetchProviderJson({url,allowedHosts:[this.expectedHost],headers:this.headers(context),counter:context.requestCounter,fetchImpl:this.fetchImpl,gate:context.requestGate,signal});}
  protected abstract headers(context:ProviderAdapterContext<Config>):Record<string,string>;abstract validateProviderConfig(value:unknown):Config;abstract testConnection(context:ProviderAdapterContext<Config>):Promise<{ok:boolean;message:string;checkedAt:string}>;abstract discoverChampionships(context:ProviderAdapterContext<Config>):Promise<ChampionshipDiscoveryResult<Source>>;
}

export class OcBlackTopAdapter extends DiscoveryAdapter{
  readonly key='ocblacktop';readonly expectedHost='api.ocblacktop.com';readonly defaultBaseUrl='https://api.ocblacktop.com/v1';
  constructor(fetchImpl?:ProviderFetch,readonly catalog:readonly AdapterCatalogEntry[]=OC_BLACKTOP_CATALOG_WITH_WRC){super(fetchImpl);}
  validateProviderConfig(value:unknown){return baseConfig(value,this.expectedHost);}
  championshipForm():readonly ProviderFieldSchema[]{return [{key:'external_id',label:'Identifiant de série',type:'text',required:true,help:'Identifiant court fourni par OCBlackTop.'},{key:'strategy',label:'Stratégie',type:'select',required:true,options:[{value:'series-events-v1',label:'Événements paginés de série v1'},{value:'season-rallies-v1',label:'Rallyes par saison v1'}]},{key:'endpoint_template',label:'Modèle endpoint',type:'select',required:true,options:[{value:'/{series}/events',label:'/{series}/events'},{value:'/{series}/seasons/{year}',label:'/{series}/seasons/{year}'}],help:'Modèle relatif sûr associé à la stratégie ; aucune URL complète n’est acceptée.'}];}
  validateSourceConfig(value:unknown){const config=sourceConfig(value);const expected=OC_BLACKTOP_SOURCE_STRATEGIES[config.strategy as keyof typeof OC_BLACKTOP_SOURCE_STRATEGIES];if(!expected)throw new Error('Stratégie OCBlackTop inconnue.');if(!/^[a-z0-9][a-z0-9-]{0,79}$/.test(config.external_id))throw new Error('Identifiant OCBlackTop invalide.');if(config.endpoint_template!==expected)throw new Error('Modèle endpoint OCBlackTop incompatible avec la stratégie.');return config;}
  protected headers(context:ProviderAdapterContext<Config>){const key=context.credentials.api_key;if(!key)throw new Error('Clé API OCBlackTop absente.');return {accept:'application/json','x-api-key':key};}
  async testConnection(context:ProviderAdapterContext<Config>){const sample=this.catalog[0];if(!sample)throw new Error('Catalogue OCBlackTop vide.');const path=sample.endpointTemplate.replace('{series}',encodeURIComponent(sample.externalId));await this.json(path,context,{page:'1',limit:'1',year:String(new Date().getUTCFullYear())});return {ok:true,message:'Connexion OCBlackTop réussie.',checkedAt:new Date().toISOString()};}
  async discoverChampionships():Promise<ChampionshipDiscoveryResult<Source>>{return {complete:true,provenance:'adapter-known-catalog',items:this.catalog.map(entry=>({externalChampionshipId:entry.externalId,name:entry.name,sourceConfig:{strategy:entry.strategy,external_id:entry.externalId,endpoint_template:entry.endpointTemplate},metadata:{provenance:'adapter-known-catalog'}}))};}
  async fetchWorkUnit(input:FetchWorkUnitInput<Config,Source,Cursor>):Promise<FetchWorkUnitResult<AcquiredProviderSourceItem,Cursor>>{
    const source=this.validateSourceConfig(input.sourceConfig);
    if(source.strategy==='season-rallies-v1')return this.fetchSeasonRallies(input,source);
    return this.fetchPaginatedEvents(input,source);
  }
  private async fetchPaginatedEvents(input:FetchWorkUnitInput<Config,Source,Cursor>,source:Source):Promise<FetchWorkUnitResult<AcquiredProviderSourceItem,Cursor>>{
    const path=source.endpoint_template!.replace('{series}',encodeURIComponent(source.external_id));
    const payload=await this.json(path,input,{page:String(input.cursor.page),limit:'100',year:String(input.season)},input.signal);
    const rows=providerRows(payload,['data','events']);
    const parsed=validateProviderSourceItems({rows,season:input.season,entityKind:'event',idKeys:['id','event_id','external_id']});
    const page=resolveProviderPage(payload,input.cursor,rows.length);
    if(page.complete)return {status:'complete',items:parsed.items,itemAnomalies:parsed.anomalies,nextCursor:input.cursor,requestCount:1,complete:true,completionReason:page.completionReason};
    return {status:'progress',items:parsed.items,itemAnomalies:parsed.anomalies,nextCursor:page.nextCursor,requestCount:1,complete:false,completionReason:null};
  }
  private async fetchSeasonRallies(input:FetchWorkUnitInput<Config,Source,Cursor>,source:Source):Promise<FetchWorkUnitResult<AcquiredProviderSourceItem,Cursor>>{
    const path=source.endpoint_template!.replace('{series}',encodeURIComponent(source.external_id)).replace('{year}',encodeURIComponent(String(input.season)));
    const payload=await this.json(path,input,{},input.signal);let rows:readonly unknown[];
    try{const envelope=object(payload);if(Array.isArray(envelope.rallies)||envelope.rallies===null)rows=providerRows(envelope,['rallies']);else if(Array.isArray(envelope.data)||envelope.data===null)rows=providerRows(envelope,['data']);else{const data=object(envelope.data);rows=providerRows(data,['rallies']);}}
    catch(error){if(error instanceof ProviderAcquisitionError)throw error;throw new ProviderAcquisitionError('invalid_provider_payload','Réponse saisonnière OCBlackTop structurellement invalide.');}
    const parsed=validateProviderSourceItems({rows,season:input.season,entityKind:'event',idKeys:['rallyId','id','event_id','external_id']});
    return {status:'complete',items:parsed.items,itemAnomalies:parsed.anomalies,nextCursor:input.cursor,requestCount:1,complete:true,completionReason:rows.length===0?'explicit_empty_scope':'end_of_collection'};
  }
}

export class TheSportsDbAdapter extends DiscoveryAdapter{
  readonly key='thesportsdb';readonly expectedHost='www.thesportsdb.com';readonly defaultBaseUrl='https://www.thesportsdb.com/api/v1/json';
  providerForm():readonly ProviderFieldSchema[]{return [...super.providerForm(),{key:'discovery_complete',label:'Catalogue all_leagues exhaustif pour ce compte',type:'boolean',required:false}];}
  validateProviderConfig(value:unknown){const config=baseConfig(value,this.expectedHost,true);return {...config,base_url:'https://www.thesportsdb.com/api/v1/json'};}
  championshipForm():readonly ProviderFieldSchema[]{return [{key:'external_id',label:'Identifiant de ligue',type:'text',required:true,help:'Identifiant numérique TheSportsDB.'},{key:'strategy',label:'Stratégie',type:'select',required:true,options:[{value:'league-season-v1',label:'Saison complète de ligue v1'}]}];}
  validateSourceConfig(value:unknown){const config=sourceConfig(value);if(config.strategy!=='league-season-v1')throw new Error('Seule la stratégie TheSportsDB league-season-v1 est supportée.');if(config.endpoint_template!==undefined)throw new Error('TheSportsDB n’accepte aucun modèle endpoint personnalisé.');if(!/^\d{1,20}$/.test(config.external_id))throw new Error('L’identifiant de ligue TheSportsDB doit être numérique.');return config;}
  protected headers(){return {accept:'application/json'};}
  private credentialPath(context:ProviderAdapterContext<Config>){const key=context.credentials.api_key;if(!key)throw new Error('Clé API TheSportsDB absente.');return encodeURIComponent(key);}
  private v1Context(context:ProviderAdapterContext<Config>):ProviderAdapterContext<Config>{return {...context,providerConfig:{...context.providerConfig,base_url:'https://www.thesportsdb.com/api/v1/json'}};}
  async testConnection(context:ProviderAdapterContext<Config>){await this.json(`/${this.credentialPath(context)}/all_leagues.php`,this.v1Context(context));return {ok:true,message:'Connexion TheSportsDB réussie.',checkedAt:new Date().toISOString()};}
  async discoverChampionships(context:ProviderAdapterContext<Config>):Promise<ChampionshipDiscoveryResult<Source>>{const payload=object(await this.json(`/${this.credentialPath(context)}/all_leagues.php`,this.v1Context(context))),rows=Array.isArray(payload.leagues)?payload.leagues:[],items=[];for(const raw of rows){const row=object(raw),sport=String(row.strSport??'').toLowerCase();if(!sport.includes('motor'))continue;const id=String(row.idLeague??'').trim(),name=String(row.strLeague??id).trim();if(id&&name)items.push({externalChampionshipId:id,name,sourceConfig:{strategy:'league-season-v1',external_id:id},metadata:{sport:String(row.strSport??''),provenance:'provider-discovered'}});}return {items,complete:context.providerConfig.discovery_complete===true,provenance:'provider-discovered'};}
  async fetchWorkUnit(input:FetchWorkUnitInput<Config,Source,Cursor>):Promise<FetchWorkUnitResult<AcquiredProviderSourceItem,Cursor>>{const source=this.validateSourceConfig(input.sourceConfig);const payload=await this.json(`/${this.credentialPath(input)}/eventsseason.php`,this.v1Context(input),{id:source.external_id,s:String(input.season)},input.signal);const rows=providerRows(payload,['events']);const parsed=validateProviderSourceItems({rows,season:input.season,entityKind:'event',idKeys:['idEvent','id','event_id']});return {status:'complete',items:parsed.items,itemAnomalies:parsed.anomalies,nextCursor:input.cursor,requestCount:1,complete:true,completionReason:rows.length===0?'explicit_empty_scope':'end_of_collection'};}
}

export function registerBuiltInAdapters(registry:{get(key:string):unknown;register(adapter:ProviderAdapter<Config,Source,Cursor,AcquiredProviderSourceItem>):void}){if(!registry.get('ocblacktop'))registry.register(new OcBlackTopAdapter());if(!registry.get('thesportsdb'))registry.register(new TheSportsDbAdapter());}
