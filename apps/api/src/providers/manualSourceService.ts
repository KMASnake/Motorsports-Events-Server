import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool } from '../lib/db.js';
import type { JsonObject, ProviderFieldSchema } from './contracts.js';
import { assertChampionshipSourceFields } from './contracts.js';
import type { DiscoveryContext } from './discoveryService.js';
import { ProviderConfigurationService } from './providerService.js';
import { redactProviderData } from './providerSecrets.js';

const status=(code:number,message:string)=>Object.assign(new Error(message),{statusCode:code});
const slug=(name:string,id:string)=>`${name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'championship'}-${id.slice(0,8)}`;

async function transaction<T>(operation:(client:PoolClient)=>Promise<T>){const client=await pool.connect();try{await client.query('begin');const result=await operation(client);await client.query('commit');return result;}catch(error){await client.query('rollback');throw error;}finally{client.release();}}
async function audit(client:PoolClient,context:DiscoveryContext,action:string,id:string,newValue:unknown){await client.query(`insert into admin_audit_log(actor,action,resource_type,resource_id,request_id,old_value,new_value) values($1,$2,'provider_championship',$3,$4,null,$5::jsonb)`,[context.principal.sub,action,id,context.requestId,JSON.stringify(redactProviderData(newValue))]);}

export type ManualSourceInput={championshipId?:string;createChampionship?:{name:string;season:number};sourceConfig:JsonObject};

export class ManualChampionshipSourceService{
  constructor(readonly providers:ProviderConfigurationService){}

  async form(providerId:string):Promise<{adapter_key:string;schema_version:number;fields:readonly ProviderFieldSchema[]}|null>{const provider=await this.providers.get(providerId);if(!provider)return null;const adapter=this.providers.registry.get(provider.adapter_key);if(!adapter)throw status(409,'Adaptateur fournisseur indisponible.');const fields=adapter.championshipForm({providerConfig:provider.config});assertChampionshipSourceFields(fields);return {adapter_key:adapter.key,schema_version:adapter.sourceConfigVersion,fields:fields.map(field=>({key:field.key,label:field.label,type:field.type,required:field.required,...(field.options?{options:field.options}:{}),...(field.help?{help:field.help}:{})}))};}

  async create(providerId:string,input:ManualSourceInput,context:DiscoveryContext){return transaction(async client=>{
    const provider=(await client.query('select adapter_key,config from provider_instances where id=$1 for update',[providerId])).rows[0];if(!provider)return null;const adapter=this.providers.registry.get(provider.adapter_key);if(!adapter)throw status(409,'Adaptateur fournisseur indisponible.');let config:JsonObject;try{config=adapter.validateSourceConfig(input.sourceConfig,{providerConfig:provider.config});}catch{throw status(400,'Configuration source invalide.');}const externalId=typeof config.external_id==='string'?config.external_id:'';if(!externalId)throw status(400,'Identifiant externe requis.');
    await client.query('select pg_advisory_xact_lock(hashtext($1))',[`${providerId}:${externalId}`]);
    let championship;if(input.championshipId){championship=(await client.query('select * from championships where id=$1 for update',[input.championshipId])).rows[0];if(!championship)throw status(404,'Championnat introuvable.');}else if(input.createChampionship){const id=randomUUID();championship=(await client.query(`insert into championships(id,slug,name,season,active,sync_enabled,provider_key,external_id) values($1,$2,$3,$4,true,false,null,null) returning *`,[id,slug(input.createChampionship.name,id),input.createChampionship.name,input.createChampionship.season])).rows[0];}else throw status(400,'Championnat existant ou création explicite requis.');
    const duplicate=(await client.query('select id from provider_championships where provider_instance_id=$1 and (championship_id=$2 or external_championship_id=$3)',[providerId,championship.id,externalId])).rows[0];if(duplicate)throw status(409,'Cette source fournisseur est déjà configurée.');
    const linkId=randomUUID();const link=(await client.query(`insert into provider_championships(id,provider_instance_id,championship_id,external_championship_id,discovery_state,sync_state,is_primary) values($1,$2,$3,$4,'manual','inactive',false) returning *`,[linkId,providerId,championship.id,externalId])).rows[0];const source=(await client.query(`insert into provider_championship_source_configs(provider_championship_id,schema_version,config,validated_at) values($1,$2,$3::jsonb,now()) returning *`,[linkId,adapter.sourceConfigVersion,JSON.stringify(config)])).rows[0];
    await client.query(`update provider_discovered_championships set provider_championship_id=$3,state='associated',source_config_diverged=proposed_source_config is distinct from $4::jsonb,updated_at=now() where provider_instance_id=$1 and external_championship_id=$2`,[providerId,externalId,linkId,JSON.stringify(config)]);
    const result={status:'configured_not_synchronized',championship,provider_championship:link,source_config:source};await audit(client,context,input.createChampionship?'provider.manual_championship_created':'provider.manual_source_created',linkId,result);return result;
  });}
}
