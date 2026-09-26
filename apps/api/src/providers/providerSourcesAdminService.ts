import { pool } from '../lib/db.js';
import type { AdminPrincipal } from '../lib/adminAuth.js';
import type { JsonObject } from './contracts.js';
import { ProviderConfigurationService } from './providerService.js';
import { BoundedProviderOneShotRunner } from './providerOneShotRunner.js';
import { PostgresNormalizationMappingRepository } from '../normalization/postgresNormalizationMappingRepository.js';
import { redactProviderData } from './providerSecrets.js';

type Context={principal:AdminPrincipal;requestId:string};
const status=(statusCode:number,message:string)=>Object.assign(new Error(message),{statusCode});

export class ProviderSourcesAdminService{
  constructor(readonly providers:ProviderConfigurationService,readonly mappings:PostgresNormalizationMappingRepository,readonly runner:BoundedProviderOneShotRunner){}

  async championships(providerId:string){
    if(!await this.providers.get(providerId))return null;
    return (await pool.query(`select pc.id,pc.championship_id,c.name championship_name,pc.external_championship_id,pc.sync_state,pc.is_primary,
      sc.schema_version,sc.config source_config,sc.validated_at,
      (select id from sync_streams where provider_championship_id=pc.id and phase='current' order by created_at limit 1) current_stream_id
      from provider_championships pc join championships c on c.id=pc.championship_id
      left join provider_championship_source_configs sc on sc.provider_championship_id=pc.id
      where pc.provider_instance_id=$1 order by lower(c.name),pc.id`,[providerId])).rows;
  }

  async updateChampionship(id:string,value:{externalChampionshipId:string;isPrimary:boolean},context:Context){
    const client=await pool.connect();try{await client.query('begin');const before=(await client.query('select * from provider_championships where id=$1 for update',[id])).rows[0];if(!before){await client.query('rollback');return null;}
      const after=(await client.query(`update provider_championships set external_championship_id=$2,is_primary=$3,updated_at=now() where id=$1 returning *`,[id,value.externalChampionshipId,value.isPrimary])).rows[0];
      await client.query(`insert into admin_audit_log(actor,action,resource_type,resource_id,request_id,old_value,new_value) values($1,'provider.championship_configuration_changed','provider_championship',$2,$3,$4::jsonb,$5::jsonb)`,[context.principal.sub,id,context.requestId,JSON.stringify(redactProviderData(before)),JSON.stringify(redactProviderData(after))]);await client.query('commit');return after;
    }catch(error){await client.query('rollback');throw error;}finally{client.release();}
  }

  async updateSourceConfig(id:string,raw:JsonObject,context:Context){
    const owner=(await pool.query(`select pc.provider_instance_id,p.adapter_key,p.config provider_config from provider_championships pc join provider_instances p on p.id=pc.provider_instance_id where pc.id=$1`,[id])).rows[0];if(!owner)return null;
    const adapter=this.providers.registry.get(owner.adapter_key);if(!adapter)throw status(409,'Adaptateur fournisseur indisponible.');let config:JsonObject;try{config=adapter.validateSourceConfig(raw,{providerConfig:owner.provider_config});}catch{throw status(400,'Configuration source invalide.');}
    const client=await pool.connect();try{await client.query('begin');const before=(await client.query('select * from provider_championship_source_configs where provider_championship_id=$1 for update',[id])).rows[0]??null;
      const after=(await client.query(`insert into provider_championship_source_configs(provider_championship_id,schema_version,config,validated_at) values($1,$2,$3::jsonb,now()) on conflict(provider_championship_id) do update set schema_version=excluded.schema_version,config=excluded.config,validated_at=excluded.validated_at returning *`,[id,adapter.sourceConfigVersion,JSON.stringify(config)])).rows[0];
      await client.query(`insert into admin_audit_log(actor,action,resource_type,resource_id,request_id,old_value,new_value) values($1,'provider.source_configuration_changed','provider_championship',$2,$3,$4::jsonb,$5::jsonb)`,[context.principal.sub,id,context.requestId,JSON.stringify(redactProviderData(before)),JSON.stringify(redactProviderData(after))]);await client.query('commit');return after;
    }catch(error){await client.query('rollback');throw error;}finally{client.release();}
  }

  async mappingState(id:string){const versions=await this.mappings.listMappingVersions(id),active=await this.mappings.getActiveMapping(id);return {active,versions};}
  async createMapping(id:string,value:{versionLabel:string;rulesVersion:string;mappingDocument:unknown},context:Context){
    return this.mappings.createAndActivateMappingVersion({providerChampionshipId:id,versionLabel:value.versionLabel,rulesVersion:value.rulesVersion,mappingDocument:value.mappingDocument as never,actor:context.principal.sub,audit:{requestId:context.requestId}});
  }
  async preflight(id:string,maxProviderRequests:number){const row=(await pool.query(`select pc.provider_instance_id,s.id stream_id from provider_championships pc left join lateral(select id from sync_streams where provider_championship_id=pc.id and phase='current' order by created_at limit 1)s on true where pc.id=$1`,[id])).rows[0];if(!row)return null;if(!row.stream_id)return {status:'configuration_invalid',reason:'current_stream_absent',configuration_ready:false,execution_ready:false,configuration_blockers:['current_stream_absent'],execution_blockers:['configuration_not_ready'],PROVIDER_CALLS:0,provider_requests_emitted:0};return this.runner.preflight({providerInstanceId:row.provider_instance_id,providerChampionshipId:id,streamId:row.stream_id,maxProviderRequests,preflight:true});}
}
