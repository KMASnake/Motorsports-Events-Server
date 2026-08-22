import type {Pool} from 'pg';
import {pool} from '../lib/db.js';

export type ResourceType='championship'|'event'|'meeting';
export interface ResourceRow{resourceType:ResourceType;resourceId:string;revision:number;lifecycle:'active'|'removed';state:Record<string,unknown>|null;promotedAt:string;sortKey:string}
export interface ChangeRow{sequence:number;resourceType:ResourceType;resourceId:string;revision:number;operation:'created'|'updated'|'removed'|'availability_changed';changedFields:string[];occurredAt:string;current:ResourceRow|null}
export interface ListInput{resourceType:ResourceType;limit:number;snapshotSequence:number;after?:{sortKey:string;resourceId:string};championshipId?:string;championshipSlug?:string;from?:string;to?:string;status?:string;sessionType?:string}
export interface PreviewRepository{snapshotBoundary():Promise<number>;oldestSnapshotSequence():Promise<number>;oldestChangeSequence():Promise<number|null>;list(input:ListInput):Promise<ResourceRow[]>;detail(type:ResourceType,id:string):Promise<ResourceRow|null>;changes(after:number,limit:number,includeData:boolean):Promise<ChangeRow[]>}

function row(value:Record<string,unknown>):ResourceRow{return {resourceType:String(value.resource_type) as ResourceType,resourceId:String(value.resource_id),revision:Number(value.revision),lifecycle:String(value.lifecycle) as 'active'|'removed',state:value.canonical_state as Record<string,unknown>|null,promotedAt:new Date(value.promoted_at as string|Date).toISOString(),sortKey:String(value.sort_key??'')};}

export class PostgresPreviewRepository implements PreviewRepository{
  constructor(private readonly db:Pick<Pool,'query'>=pool){}
  async snapshotBoundary(){const result=await this.db.query('select coalesce(max(sequence),0)::text as sequence from public_change_log');return Number(result.rows[0]?.sequence??0);}
  async oldestSnapshotSequence(){const result=await this.db.query('select oldest_snapshot_sequence::text from public_history_controls where singleton=true');return Number(result.rows[0]?.oldest_snapshot_sequence??0);}
  async oldestChangeSequence(){const result=await this.db.query('select oldest_change_sequence::text as sequence from public_history_controls where singleton=true');return result.rows[0]?.sequence==null?null:Number(result.rows[0].sequence);}
  async list(input:ListInput){
    const values:unknown[]=[input.resourceType,input.snapshotSequence],where=["s.resource_type=$1","s.lifecycle='active'"];
    const add=(value:unknown,sql:(n:number)=>string)=>{values.push(value);where.push(sql(values.length));};
    if(input.championshipId)add(input.championshipId,n=>`s.championship_id=$${n}`);
    if(input.championshipSlug)add(input.championshipSlug,n=>`s.championship_id=(select c.id::text from championships c where c.slug=$${n} and c.active=true limit 1)`);
    if(input.from)add(input.from,n=>`(s.canonical_state->>'startsAt')::timestamptz >= $${n}::timestamptz`);
    if(input.to)add(input.to,n=>`(s.canonical_state->>'startsAt')::timestamptz <= $${n}::timestamptz`);
    if(input.status)add(input.status,n=>`s.canonical_state->>'status'=$${n}`);
    if(input.sessionType)add(input.sessionType,n=>`s.canonical_state->>'sessionType'=$${n}`);
    if(input.after){values.push(input.after.sortKey,input.after.resourceId);where.push(`(coalesce(s.canonical_state->>'startsAt',s.canonical_state->>'name',''),s.resource_id) > ($${values.length-1},$${values.length}::uuid)`);}
    values.push(input.limit+1);
    const result=await this.db.query(`with snapshot as (
      select distinct on (resource_type,resource_id) * from public_resource_versions
      where resource_type=$1 and publication_sequence<=$2
      order by resource_type,resource_id,publication_sequence desc
    ) select s.*,s.published_at promoted_at,coalesce(s.canonical_state->>'startsAt',s.canonical_state->>'name','') sort_key
      from snapshot s where ${where.join(' and ')} order by sort_key,s.resource_id limit $${values.length}`,values);
    return result.rows.map(value=>row(value as Record<string,unknown>));
  }
  async detail(type:ResourceType,id:string){const result=await this.db.query(`select s.*,coalesce(s.canonical_state->>'startsAt',s.canonical_state->>'name','') sort_key from public_resource_states s where s.resource_type=$1 and s.resource_id=$2 and s.lifecycle='active'`,[type,id]);return result.rowCount?row(result.rows[0] as Record<string,unknown>):null;}
  async changes(after:number,limit:number,includeData:boolean){const result=await this.db.query(`select c.*,v.lifecycle,v.canonical_state,v.published_at as promoted_at,coalesce(v.canonical_state->>'startsAt',v.canonical_state->>'name','') sort_key from public_change_log c left join public_resource_versions v on v.publication_sequence=c.sequence where c.sequence>$1 order by c.sequence limit $2`,[after,limit+1]);return result.rows.map(value=>{const record=value as Record<string,unknown>;const current=includeData&&record.operation!=='removed'&&record.canonical_state?row({...record,revision:record.resource_revision}):null;return {sequence:Number(record.sequence),resourceType:String(record.resource_type) as ResourceType,resourceId:String(record.resource_id),revision:Number(record.resource_revision),operation:String(record.operation) as ChangeRow['operation'],changedFields:record.changed_fields as string[],occurredAt:new Date(record.occurred_at as string|Date).toISOString(),current};});}
}
