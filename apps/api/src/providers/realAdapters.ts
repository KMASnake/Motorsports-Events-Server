import type { DiscoveredChampionship, JsonObject, ProviderAdapter, ProviderAdapterContext } from './contracts.js';
import { fetchProviderJson, type ProviderFetch } from './providerHttp.js';

type Config = JsonObject & { base_url: string };
type Source = JsonObject & { strategy: string; external_id: string };
type Cursor = JsonObject & { position: number };

function object(value: unknown): Record<string,unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Objet attendu.');
  return value as Record<string,unknown>;
}
function baseConfig(value: unknown, expectedHost: string): Config {
  const row = object(value); const raw = row.base_url;
  if (typeof raw !== 'string') throw new Error('URL requise.');
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.hostname !== expectedHost || url.username || url.password) throw new Error('URL non autorisée.');
  return { base_url:url.toString().replace(/\/$/,'') };
}
function sourceConfig(value: unknown): Source {
  const row=object(value);
  if (typeof row.strategy !== 'string' || typeof row.external_id !== 'string' || !row.external_id.trim()) throw new Error('Source invalide.');
  return { strategy:row.strategy, external_id:row.external_id };
}
function unsupported():never { throw new Error('La synchronisation des événements appartient à un sous-lot ultérieur.'); }

abstract class DiscoveryAdapter implements ProviderAdapter<Config,Source,Cursor,JsonObject> {
  abstract readonly key:string;
  abstract readonly expectedHost:string;
  abstract readonly defaultBaseUrl:string;
  readonly capabilities={supportsChampionshipDiscovery:true,supportsSeasonDiscovery:false,supportsQuotaHeaders:false,supportsConnectionTest:true};
  readonly providerConfigVersion=1; readonly sourceConfigVersion=1; readonly cursorVersion=1;
  constructor(readonly fetchImpl?:ProviderFetch) {}
  providerForm(){return [{key:'base_url',label:'URL de base',type:'url' as const,required:true}];}
  championshipForm(){return [{key:'external_id',label:'Identifiant externe',type:'text' as const,required:true},{key:'strategy',label:'Stratégie',type:'text' as const,required:true}];}
  validateProviderConfig(value:unknown){return baseConfig(value,this.expectedHost);}
  validateSourceConfig(value:unknown){return sourceConfig(value);}
  initialCursor(){return {position:0};}
  validateCursor(value:unknown){const row=object(value);if(!Number.isInteger(row.position))throw new Error('Curseur invalide.');return {position:Number(row.position)};}
  serializeCursor(value:Cursor){return value;}
  restoreCursor(value:unknown,version:number){if(version!==1)throw new Error('Version curseur inconnue.');return this.validateCursor(value);}
  fetchWorkUnit():never{return unsupported();}
  normalize(){return {accepted:[],rejected:[]};}
  async confirmEmptySeason(){return {confirmedEmpty:false,reason:'Hors périmètre 5.3.'};}
  protected async json(path:string, context:ProviderAdapterContext<Config>, query:Record<string,string>={}) {
    const url=new URL(`${context.providerConfig.base_url}${path}`); for(const [key,value] of Object.entries(query))url.searchParams.set(key,value);
    return fetchProviderJson({url,allowedHosts:[this.expectedHost],headers:this.headers(context),counter:context.requestCounter,fetchImpl:this.fetchImpl});
  }
  protected abstract headers(context:ProviderAdapterContext<Config>):Record<string,string>;
  abstract testConnection(context:ProviderAdapterContext<Config>):Promise<{ok:boolean;message:string;checkedAt:string}>;
  abstract discoverChampionships(context:ProviderAdapterContext<Config>):AsyncIterable<DiscoveredChampionship<Source>>;
}

export class OcBlackTopAdapter extends DiscoveryAdapter {
  readonly key='ocblacktop'; readonly expectedHost='api.ocblacktop.com'; readonly defaultBaseUrl='https://api.ocblacktop.com/v1';
  protected headers(context:ProviderAdapterContext<Config>){const key=context.credentials.api_key;if(!key)throw new Error('Clé API OCBlackTop absente.');return {'accept':'application/json','x-api-key':key};}
  async testConnection(context:ProviderAdapterContext<Config>){await this.json('/sports',context);return {ok:true,message:'Connexion OCBlackTop réussie.',checkedAt:new Date().toISOString()};}
  async *discoverChampionships(context:ProviderAdapterContext<Config>){
    const payload=object(await this.json('/sports',context)); const rows=Array.isArray(payload.data)?payload.data:Array.isArray(payload.sports)?payload.sports:[];
    for(const raw of rows){const row=object(raw);const id=String(row.slug??row.id??'').trim();const name=String(row.name??row.label??id).trim();if(!id||!name)continue;
      yield {externalChampionshipId:id,name,sourceConfig:{strategy:id==='wrc'?'season-endpoint':'events-endpoint',external_id:id},metadata:{provider:'ocblacktop'}};}
  }
}

export class TheSportsDbAdapter extends DiscoveryAdapter {
  readonly key='thesportsdb'; readonly expectedHost='www.thesportsdb.com'; readonly defaultBaseUrl='https://www.thesportsdb.com/api/v1/json';
  protected headers(){return {accept:'application/json'};}
  private credentialKey(context:ProviderAdapterContext<Config>){const key=context.credentials.api_key;if(!key)throw new Error('Clé API TheSportsDB absente.');return encodeURIComponent(key);}
  async testConnection(context:ProviderAdapterContext<Config>){await this.json(`/${this.credentialKey(context)}/all_leagues.php`,context);return {ok:true,message:'Connexion TheSportsDB réussie.',checkedAt:new Date().toISOString()};}
  async *discoverChampionships(context:ProviderAdapterContext<Config>){
    const payload=object(await this.json(`/${this.credentialKey(context)}/all_leagues.php`,context));const rows=Array.isArray(payload.leagues)?payload.leagues:[];
    for(const raw of rows){const row=object(raw);const sport=String(row.strSport??'').toLowerCase();if(!sport.includes('motor'))continue;const id=String(row.idLeague??'').trim();const name=String(row.strLeague??id).trim();if(!id||!name)continue;
      yield {externalChampionshipId:id,name,sourceConfig:{strategy:'league-season',external_id:id},metadata:{sport:String(row.strSport??'')}};}
  }
}

export function registerBuiltInAdapters(registry:{get(key:string):unknown;register(adapter:ProviderAdapter<Config,Source,Cursor,JsonObject>):void}) {
  if(!registry.get('ocblacktop'))registry.register(new OcBlackTopAdapter());
  if(!registry.get('thesportsdb'))registry.register(new TheSportsDbAdapter());
}
