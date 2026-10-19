import type {PoolClient} from 'pg';
import {withTransaction} from '../lib/db.js';
import {stableHash} from '../normalization/deterministicNormalization.js';
import {changedPublicFields} from '../normalization/publicationState.js';
import {championshipPublicId,serializeChampionshipSeason,serializeVenue,serializeVenueLayout} from './canonicalPublicContract.js';

type CatalogType='championship'|'championshipSeason'|'venue'|'venueLayout';
type Transaction=<T>(operation:(client:PoolClient)=>Promise<T>)=>Promise<T>;
export interface CatalogPublicationInput{resourceType:CatalogType;canonicalId:string;occurredAt:Date;failBeforeCommit?:boolean}
export interface CatalogRemovalInput{resourceType:CatalogType;resourceId:string;occurredAt:Date}

export class CanonicalCatalogPublicationService{
  constructor(private readonly transaction:Transaction=withTransaction){}
  publish(input:CatalogPublicationInput){return this.transaction(client=>this.publishInTransaction(client,input));}
  remove(input:CatalogRemovalInput){return this.transaction(client=>this.removeInTransaction(client,input));}
  establish(occurredAt:Date){return this.transaction(async client=>{
    const control=(await client.query("select enabled from publication_controls where control_key='promotion' for share")).rows[0];
    if(!control?.enabled)throw new Error('canonical_publication_establishment_disabled');
    const resources:{resourceType:CatalogType;canonicalId:string}[]=[];
    for(const [resourceType,table] of [['championship','championships'],['championshipSeason','championship_seasons'],['venue','venues'],['venueLayout','venue_layouts']] as const)for(const row of (await client.query(`select id from ${table} order by id`)).rows)resources.push({resourceType,canonicalId:String(row.id)});
    const results=[];for(const resource of resources)results.push(await this.publishInTransaction(client,{...resource,occurredAt}));
    if(results.some(result=>result.outcome==='kill_switch'))throw new Error('canonical_publication_establishment_disabled');
    for(const resource of resources){
      const resourceId=resource.resourceType==='championship'?championshipPublicId(resource.canonicalId):resource.canonicalId;
      const coverage=(await client.query(`select state.revision from public_resource_states state
        where state.resource_type=$1 and state.resource_id=$2 and state.lifecycle='active'
        and exists(select 1 from public_resource_versions version where version.resource_type=state.resource_type and version.resource_id=state.resource_id and version.revision=state.revision and version.lifecycle='active')`,[resource.resourceType,resourceId])).rows;
      if(coverage.length!==1)throw new Error('canonical_publication_establishment_incomplete');
    }
    return {processed:resources.length,changed:results.filter(result=>result.outcome!=='unchanged').length};
  });}
  private async canonical(client:PoolClient,input:CatalogPublicationInput){
    if(input.resourceType==='championship'){
      const row=(await client.query(`select championship.*,discipline.label discipline_label,discipline.family_key discipline_family_key
        from championships championship left join disciplines discipline on discipline.key=championship.discipline_key
        where championship.id=$1 for share of championship`,[input.canonicalId])).rows[0];
      if(!row)throw new Error('canonical_publication_resource_not_found');
      return {resourceId:championshipPublicId(String(row.id)),championshipId:String(row.id),state:{championshipId:String(row.id),name:row.name,slug:row.slug,shortName:row.short_name,officialName:row.official_name,category:row.category,disciplineKey:row.discipline_key,disciplineLabel:row.discipline_label,disciplineFamilyKey:row.discipline_family_key,season:row.season,logoUrl:row.logo_url,description:row.description,availability:row.active?'available':'unavailable'}};
    }
    if(input.resourceType==='championshipSeason'){
      const row=(await client.query('select * from championship_seasons where id=$1 for share',[input.canonicalId])).rows[0];
      if(!row)throw new Error('canonical_publication_resource_not_found');
      const state=serializeChampionshipSeason(row);return {resourceId:String(row.id),championshipId:String(row.championship_id),state:{championship_id:String(row.championship_id),key:state.key,label:state.label,start_year:state.start_year,end_year:state.end_year,starts_on:state.starts_on,ends_on:state.ends_on}};
    }
    if(input.resourceType==='venue'){
      const row=(await client.query('select * from venues where id=$1 for share',[input.canonicalId])).rows[0];
      if(!row)throw new Error('canonical_publication_resource_not_found');
      const state=serializeVenue(row);return {resourceId:String(row.id),championshipId:null,state:{key:state.key,name:state.name,kind_key:state.kind_key,city:state.city,region:state.region,country_code:state.country_code,timezone:state.timezone,latitude:state.latitude,longitude:state.longitude}};
    }
    const row=(await client.query('select * from venue_layouts where id=$1 for share',[input.canonicalId])).rows[0];
    if(!row)throw new Error('canonical_publication_resource_not_found');
    const state=serializeVenueLayout(row);return {resourceId:String(row.id),championshipId:null,state:{venue_id:state.venue_id,key:state.key,name:state.name}};
  }
  async publishInTransaction(client:PoolClient,input:CatalogPublicationInput){
    const control=(await client.query("select enabled from publication_controls where control_key='promotion' for share")).rows[0];
    if(!control?.enabled)return {outcome:'kill_switch' as const,revision:null,sequence:null};
    const canonical=await this.canonical(client,input);
    await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[`${input.resourceType}:${canonical.resourceId}`]);
    const current=(await client.query('select * from public_resource_states where resource_type=$1 and resource_id=$2 for update',[input.resourceType,canonical.resourceId])).rows[0];
    if(current?.lifecycle==='removed')throw new Error('publication_tombstone_permanent');
    const checksum=stableHash(canonical.state);
    if(current?.state_checksum===checksum)return {outcome:'unchanged' as const,revision:Number(current.revision),sequence:null};
    const revision=Number(current?.revision??0)+1,operation=current?'updated':'created',changed=changedPublicFields(current?.canonical_state??null,canonical.state);
    await client.query(`insert into public_resource_states(resource_type,resource_id,championship_id,revision,lifecycle,canonical_state,state_checksum,promoted_at)
      values($1,$2,$3,$4,'active',$5::jsonb,$6,$7)
      on conflict(resource_type,resource_id) do update set championship_id=excluded.championship_id,revision=excluded.revision,canonical_state=excluded.canonical_state,state_checksum=excluded.state_checksum,promoted_at=excluded.promoted_at`,[input.resourceType,canonical.resourceId,canonical.championshipId,revision,JSON.stringify(canonical.state),checksum,input.occurredAt]);
    const change=(await client.query(`insert into public_change_log(resource_type,resource_id,resource_revision,operation,changed_fields,state_checksum,occurred_at)
      values($1,$2,$3,$4,$5,$6,$7) returning sequence`,[input.resourceType,canonical.resourceId,revision,operation,changed,checksum,input.occurredAt])).rows[0];
    await client.query(`insert into public_resource_versions(resource_type,resource_id,revision,publication_sequence,operation,championship_id,lifecycle,canonical_state,state_checksum,published_at)
      values($1,$2,$3,$4,$5,$6,'active',$7::jsonb,$8,$9)`,[input.resourceType,canonical.resourceId,revision,change.sequence,operation,canonical.championshipId,JSON.stringify(canonical.state),checksum,input.occurredAt]);
    if(input.failBeforeCommit)throw new Error('catalog_publication_injected_failure');
    return {outcome:operation,revision,sequence:Number(change.sequence)};
  }
  async removeInTransaction(client:PoolClient,input:CatalogRemovalInput){
    await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[`${input.resourceType}:${input.resourceId}`]);
    const current=(await client.query('select * from public_resource_states where resource_type=$1 and resource_id=$2 for update',[input.resourceType,input.resourceId])).rows[0];
    if(!current)return {outcome:'absent' as const,revision:null,sequence:null};
    if(current.lifecycle==='removed')return {outcome:'unchanged' as const,revision:Number(current.revision),sequence:null};
    const revision=Number(current.revision)+1,checksum=stableHash({removed:true});
    await client.query(`update public_resource_states set revision=$3,lifecycle='removed',canonical_state=null,state_checksum=$4,removed_at=$5,promoted_at=$5 where resource_type=$1 and resource_id=$2`,[input.resourceType,input.resourceId,revision,checksum,input.occurredAt]);
    const change=(await client.query(`insert into public_change_log(resource_type,resource_id,resource_revision,operation,changed_fields,state_checksum,occurred_at) values($1,$2,$3,'removed','{}',$4,$5) returning sequence`,[input.resourceType,input.resourceId,revision,checksum,input.occurredAt])).rows[0];
    await client.query(`insert into public_resource_versions(resource_type,resource_id,revision,publication_sequence,operation,championship_id,lifecycle,canonical_state,state_checksum,published_at) values($1,$2,$3,$4,'removed',$5,'removed',null,$6,$7)`,[input.resourceType,input.resourceId,revision,change.sequence,current.championship_id,checksum,input.occurredAt]);
    return {outcome:'removed' as const,revision,sequence:Number(change.sequence)};
  }
}
