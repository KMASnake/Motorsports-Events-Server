import type {PoolClient} from 'pg';
import {pool} from '../lib/db.js';
import {readHandoffEnvelope} from './canonicalHandoffState.js';
import type {JsonObject} from './contracts.js';
import type {AcquisitionWorkClass} from './acquisitionOrchestrator.js';

export type DueAcquisitionRetry={id:string;provider_instance_id:string;stream_id:string;traversal_id:string;logical_unit_key:string;work_class:AcquisitionWorkClass;season:number;safe_unit_key:string;provider_championship_id:string;championship_id:string;cursor:JsonObject;cursor_version:number;phase:'current'|'historical';historical_state:JsonObject;mapping_version_id:string|null;effective_deadline:Date;adapter_key:string};
const deadline=`greatest(u.next_retry_at,u.local_backoff_until,u.quota_deadline,case when u.retry_after_state='valid' then u.retry_after_at end,q.provider_backoff_until,q.next_eligible_at,s.stream_backoff_until,s.next_eligible_at)`;
export type RetrySelectionCursor={deadline:Date;id:string};
export function retryHandoffAllowsAcquisition(row:DueAcquisitionRetry){try{const entry=readHandoffEnvelope(row.historical_state).traversals[row.traversal_id];return !entry||entry.state==='ACQUIRING';}catch{return false;}}
// SQL is bounded before decoding cursor/handoff. Invalid or superseded identities fail closed.
export async function dueAcquisitionRetries(now:Date,limit:number,id:string|null=null,client:Pick<PoolClient,'query'>=pool,owned=false,after:RetrySelectionCursor|null=null){
  if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new Error('retry_selection_limit_invalid');
  const rows=(await client.query<DueAcquisitionRetry>(`select u.id,u.provider_instance_id,u.stream_id,u.traversal_id,u.logical_unit_key,t.work_class,t.season,t.safe_unit_key,s.provider_championship_id,pc.championship_id,s.cursor,s.cursor_version,s.phase,s.historical_state,p.adapter_key,m.mapping_version_id,${deadline} effective_deadline
    from provider_acquisition_retry_units u join provider_acquisition_traversals t on t.id=u.traversal_id and t.stream_id=u.stream_id
    join sync_streams s on s.id=u.stream_id join provider_championships pc on pc.id=s.provider_championship_id and pc.provider_instance_id=u.provider_instance_id
    join provider_instances p on p.id=u.provider_instance_id join championships c on c.id=pc.championship_id
    left join provider_quota_runtime q on q.provider_instance_id=u.provider_instance_id
    left join provider_acquisition_traversal_mappings m on m.traversal_id=t.id
    where ($5::timestamptz is null or ${deadline}>$5 or (${deadline}=$5 and u.id>$6::uuid)) and ($2::uuid is null or u.id=$2) and u.state in('retry_wait','quota_wait') and u.next_retry_at is not null and ${deadline}<=$1
    and u.emitted_attempt_count+(select count(*) from provider_acquisition_retry_charges r join provider_request_charges ch on ch.id=r.charge_id where r.retry_unit_id=u.id and ch.emitted is null)<u.max_emitted_attempts
    and not t.complete and t.status in('running','partial','failed') and p.enabled and p.state='active' and pc.sync_state='active' and c.active
    and (s.state in('ready','pending','error','backoff') or ($4 and s.state='running'))
    and ($4 or s.lease_owner is null or s.lease_expires_at<=$1)
    order by ${deadline},u.id limit $3`,[now,id,limit,owned,after?.deadline??null,after?.id??null])).rows;
  return rows;
}
