import {createHash,randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {withTransaction} from '../lib/db.js';
import {canonicalPublicState} from '../normalization/publicationState.js';
import {isReconcilableField,reconcile,reconciliationChecksum,type CanonicalOverride,type Contribution,type FieldRule,type Policy} from './deterministicReconciliation.js';
import {legacyEventFieldToReconciliationField} from './legacyEventFieldMapping.js';

type Kind='meeting'|'event';
export type PreviewRequest={entityKind:Kind;entityUuid:string;policyId:string;evaluationAt:string};
export type ApplyRequest=PreviewRequest&{previewChecksum:string;idempotencyKey:string;actorId:string;failBeforeCommit?:boolean};
const requestHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const columns:{meeting:Record<string,string>;event:Record<string,string>}={meeting:{name:'name',round:'round',startsAt:'starts_at',endsAt:'ends_at',venueId:'venue_id',venueLayoutId:'venue_layout_id'},event:{name:'name',sessionLabel:'session_title',sessionType:'session_type_key',startsAt:'starts_at',endsAt:'ends_at',status:'status',venueId:'venue_id',venueLayoutId:'venue_layout_id'}};
const normalizeValue=(field:string,value:unknown)=>{if(value instanceof Date)return value.toISOString();if((field==='startsAt'||field==='endsAt')&&value!=null&&Number.isFinite(Date.parse(String(value))))return new Date(String(value)).toISOString();return value;};
const normalizeValues=(values:Record<string,unknown>)=>Object.fromEntries(Object.entries(values).map(([field,value])=>[field,normalizeValue(field,value)]));
const latestContributionVersions=(rows:any[])=>{
  const grouped=new Map<string,any[]>();
  for(const row of rows){const key=String(row.source_entity_id),items=grouped.get(key)??[];items.push(row);grouped.set(key,items);}
  return [...grouped.values()].map(items=>{
    const revision=Math.max(...items.map(item=>Number(item.source_revision)));
    const latest=items.filter(item=>Number(item.source_revision)===revision);
    const identities=new Set(latest.map(item=>String(item.contribution_checksum)));
    if(identities.size!==1)throw new Error('ambiguous_source_contribution_succession');
    return latest.sort((a,b)=>String(a.contribution_checksum).localeCompare(String(b.contribution_checksum)))[0];
  }).sort((a,b)=>String(a.contribution_checksum).localeCompare(String(b.contribution_checksum))||String(a.id).localeCompare(String(b.id)));
};
export class StaleReconciliationPreviewError extends Error{constructor(){super('stale_reconciliation_preview');}}

export class PostgresReconciliationService{
  preview(input:PreviewRequest){return withTransaction(client=>this.snapshot(client,input,false));}
  apply(input:ApplyRequest){return withTransaction(client=>this.applyInTransaction(client,input));}
  // Acquisition owns the transaction: contribution, effective canonical state
  // and versioned publication must either all commit or all roll back.
  async reconcileLinkedInTransaction(client:PoolClient,input:{entityKind:Kind;entityUuid:string;evaluationAt:string}){
    await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[`${input.entityKind}:${input.entityUuid}`]);
    const scope=input.entityKind==='meeting'
      ?(await client.query('select championship_id,championship_season_id from meetings where id=$1',[input.entityUuid])).rows[0]
      :(await client.query('select event.championship_id,meeting.championship_season_id from events event join meeting_events relation on relation.event_id=event.id join meetings meeting on meeting.id=relation.meeting_id where event.normalized_uuid=$1',[input.entityUuid])).rows[0];
    if(!scope)throw new Error('canonical_entity_not_found');
    // No implicit priority between a global and a season-specific policy.
    // Refuse overlapping active scopes rather than invent policy precedence.
    const policies=(await client.query(`select id from reconciliation_policies where championship_id=$1 and resource_kind=$2 and status='active' and (championship_season_id is null or championship_season_id=$3) order by id for share`,[scope.championship_id,input.entityKind,scope.championship_season_id])).rows;
    if(policies.length!==1)throw new Error(policies.length?'handoff_reconciliation_policy_ambiguous':'handoff_reconciliation_policy_missing');
    const request={...input,policyId:String(policies[0].id)},preview=await this.snapshot(client,request,true);
    // applyInTransaction persists review decisions/conflicts without materializing
    // an ineligible effective state. Technical exceptions still escape to rollback.
    return this.applyInTransaction(client,{...request,previewChecksum:preview.previewChecksum,idempotencyKey:`handoff:${preview.previewChecksum}`,actorId:'canonical-acquisition-handoff'});
  }
  private async snapshot(client:PoolClient,input:PreviewRequest,lock:boolean){
    await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[`${input.entityKind}:${input.entityUuid}`]);
    const canonical=input.entityKind==='meeting'?(await client.query(`select * from meetings where id=$1 ${lock?'for update':''}`,[input.entityUuid])).rows[0]:(await client.query(`select * from events where normalized_uuid=$1 ${lock?'for update':''}`,[input.entityUuid])).rows[0];
    if(!canonical)throw new Error('canonical_entity_not_found');
    const publicState=(await client.query(`select revision public_revision,state_checksum public_checksum,canonical_state public_state from public_resource_states where resource_type=$1 and resource_id=$2 ${lock?'for update':''}`,[input.entityKind,input.entityUuid])).rows[0]??{};
    Object.assign(canonical,publicState);
    const table=input.entityKind==='meeting'?'meeting_source_contributions':'event_source_contributions',column=input.entityKind==='meeting'?'meeting_id':'event_uuid';
    const allContributionRows=(await client.query(`select contribution.*,instance.adapter_key,instance.enabled provider_enabled,instance.state provider_state from ${table} contribution join provider_source_entities source on source.id=contribution.source_entity_id join provider_instances instance on instance.id=source.provider_instance_id where contribution.${column}=$1 order by contribution.source_entity_id,contribution.source_revision,contribution.contribution_checksum,contribution.id ${lock?'for share of contribution,instance':''}`,[input.entityUuid])).rows;
    const contributionRows=latestContributionVersions(allContributionRows);
    const policyRow=(await client.query(`select * from reconciliation_policies where id=$1 ${lock?'for share':''}`,[input.policyId])).rows[0];if(!policyRow||policyRow.status!=='active')throw new Error('active_policy_not_found');
    const canonicalSeason=input.entityKind==='meeting'?canonical.championship_season_id:(await client.query('select meeting.championship_season_id from meeting_events relation join meetings meeting on meeting.id=relation.meeting_id where relation.event_id=$1',[canonical.id])).rows[0]?.championship_season_id;
    if(String(policyRow.championship_id)!==String(canonical.championship_id)||(policyRow.championship_season_id!=null&&String(policyRow.championship_season_id)!==String(canonicalSeason)))throw new Error('policy_scope_mismatch');
    const ruleRows=(await client.query('select * from reconciliation_policy_field_rules where policy_id=$1 order by field_name',[input.policyId])).rows;
    for(const rule of ruleRows)if(!isReconcilableField(input.entityKind,String(rule.field_name))||!Object.hasOwn(columns[input.entityKind],String(rule.field_name)))throw new Error(`non_reconcilable_field:${String(rule.field_name)}`);
    const rawOverrideRows=(await client.query(`select * from canonical_field_overrides where entity_kind=$1 and entity_uuid=$2 and status='active' order by field_name ${lock?'for share':''}`,[input.entityKind,input.entityUuid])).rows;
    const overrideRows=rawOverrideRows.map(row=>({...row,field_name:input.entityKind==='event'?(legacyEventFieldToReconciliationField(String(row.field_name))??String(row.field_name)):String(row.field_name)}));
    if(new Set(overrideRows.map(row=>String(row.field_name))).size!==overrideRows.length)throw new Error('ambiguous_canonical_override_field');
    const currentState=Object.fromEntries(Object.entries(columns[input.entityKind]).map(([logical,columnName])=>[logical,normalizeValue(logical,canonical[columnName])]));
    const contributions:Contribution[]=contributionRows.map(row=>({id:String(row.id),providerKey:String(row.adapter_key),values:normalizeValues(row.normalized_values),structuralReferences:row.structural_references,eligible:row.provider_enabled===true&&row.provider_state==='active'&&row.withdrawn_at==null,withdrawn:row.withdrawn_at!=null,sourceUpdatedAt:row.source_updated_at?.toISOString?.()??row.source_updated_at}));
    const rules:FieldRule[]=ruleRows.map(row=>({field:String(row.field_name),class:row.field_class,providerPriority:row.provider_priority,scheduleToleranceSeconds:row.schedule_tolerance_seconds??undefined,staleAfterSeconds:row.stale_after_seconds??undefined,compatibleStatusTransitions:row.status_rules}));
    const policy:Policy={id:String(policyRow.id),version:Number(policyRow.version),resourceKind:policyRow.resource_kind,rules};
    const overrides:CanonicalOverride[]=overrideRows.map(row=>({field:String(row.field_name),value:row.override_value,revision:Number(row.revision)}));
    let result=reconcile({resourceKind:input.entityKind,currentState,contributions,policy,overrides,evaluationAt:input.evaluationAt});
    const expectedStructural=input.entityKind==='meeting'
      ?{championshipId:String(canonical.championship_id),championshipSeasonId:String(canonical.championship_season_id)}
      :{meetingId:String((await client.query('select meeting_id from meeting_events where event_id=$1',[canonical.id])).rows[0]?.meeting_id??''),championshipId:String(canonical.championship_id),championshipSeasonId:String((await client.query('select meeting.championship_season_id from meeting_events relation join meetings meeting on meeting.id=relation.meeting_id where relation.event_id=$1',[canonical.id])).rows[0]?.championship_season_id??'')};
    const structuralConflicts=contributionRows.filter(row=>row.provider_enabled===true&&row.provider_state==='active'&&row.withdrawn_at==null).flatMap(row=>Object.entries(expectedStructural).filter(([field,expected])=>row.structural_references?.[field]!=null&&String(row.structural_references[field])!==expected).map(([field,expected])=>({field:`structural:${field}`,outcome:'review_required' as const,conflict:{severity:'critical' as const,reason:`structural reference mismatch (expected ${expected})`,contributionIds:[String(row.id)]}})));
    if(structuralConflicts.length)result={...result,effectiveState:{...currentState},decisions:[...result.decisions,...structuralConflicts],materializationEligible:false,effectiveChecksum:reconciliationChecksum(currentState)};
    const parent=input.entityKind==='event'?(await client.query('select meeting.* from meeting_events relation join meetings meeting on meeting.id=relation.meeting_id where relation.event_id=$1',[canonical.id])).rows[0]:null;
    const persistedProjection=input.entityKind==='meeting'
      ?{resourceKind:'meeting',name:canonical.name,sessionType:'other',sessionLabel:null,championshipId:canonical.championship_id,championshipSeasonId:canonical.championship_season_id,venueId:canonical.venue_id,venueLayoutId:canonical.venue_layout_id,season:canonical.season,round:canonical.round,startsAt:normalizeValue('startsAt',canonical.starts_at),endsAt:normalizeValue('endsAt',canonical.ends_at),timezone:canonical.timezone}
      :{resourceKind:'event',name:canonical.name,sessionType:canonical.session_type_key,sessionLabel:canonical.session_title,status:canonical.status,championshipId:canonical.championship_id,championshipSeasonId:parent?.championship_season_id??null,circuitId:canonical.circuit_id,venueId:canonical.venue_id,venueLayoutId:canonical.venue_layout_id,season:parent?.season??null,round:parent?.round??null,startsAt:normalizeValue('startsAt',canonical.starts_at),endsAt:normalizeValue('endsAt',canonical.ends_at),timezone:canonical.timezone};
    const completeCurrent=canonicalPublicState({...canonicalPublicState(canonical.public_state??{}),...persistedProjection});
    const completeEffective=canonicalPublicState({...completeCurrent,...result.effectiveState});
    result={...result,effectiveState:result.materializationEligible?completeEffective:completeCurrent,effectiveChecksum:reconciliationChecksum(result.materializationEligible?completeEffective:completeCurrent)};
    const inputs={entityKind:input.entityKind,entityUuid:input.entityUuid,canonicalRevision:Number(canonical.public_revision??0),canonicalChecksum:reconciliationChecksum(completeCurrent),publicChecksum:canonical.public_checksum??null,contributions:contributionRows.map(row=>({id:String(row.id),sourceRevision:Number(row.source_revision),checksum:String(row.contribution_checksum),eligible:row.provider_enabled===true&&row.provider_state==='active'&&row.withdrawn_at==null,providerState:String(row.provider_state),withdrawnAt:row.withdrawn_at??null})).sort((a,b)=>a.id.localeCompare(b.id)),policy:{id:String(policyRow.id),version:Number(policyRow.version),checksum:String(policyRow.checksum)},overrides:overrideRows.map(row=>({id:String(row.id),revision:Number(row.revision),fingerprint:String(row.request_fingerprint)})).sort((a,b)=>a.id.localeCompare(b.id)),evaluationAt:input.evaluationAt,effectiveChecksum:result.effectiveChecksum,materializationEligible:result.materializationEligible,decisions:result.decisions};
    return {result,inputs,previewChecksum:reconciliationChecksum(inputs),canonical,currentState};
  }
  private async applyInTransaction(client:PoolClient,input:ApplyRequest){
    await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[`${input.entityKind}:${input.entityUuid}`]);
    const fingerprint=requestHash(input),replay=(await client.query(`select * from reconciliation_runs where entity_kind=$1 and entity_uuid=$2 and idempotency_key=$3 for share`,[input.entityKind,input.entityUuid,input.idempotencyKey])).rows[0];
    if(replay){if(replay.request_fingerprint!==fingerprint)throw new Error('idempotency_conflict');return {outcome:replay.outcome,previewChecksum:replay.preview_checksum,effectiveChecksum:replay.effective_checksum,replay:true};}
    const snapshot=await this.snapshot(client,input,true);if(snapshot.previewChecksum!==input.previewChecksum)throw new StaleReconciliationPreviewError();
    const changed=snapshot.inputs.canonicalChecksum!==snapshot.result.effectiveChecksum,outcome=!snapshot.result.materializationEligible?'review_required':changed?'applied':'no_op',delta=changed&&snapshot.result.materializationEligible?1:0,runId=randomUUID();
    await client.query(`insert into reconciliation_runs(id,entity_kind,entity_uuid,policy_id,evaluation_at,contribution_set_checksum,override_set_checksum,preview_checksum,effective_checksum,mode,outcome,expected_revision_delta,expected_public_change_delta,idempotency_key,request_fingerprint,actor_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,'apply',$10,$11,$11,$12,$13,$14)`,[runId,input.entityKind,input.entityUuid,input.policyId,input.evaluationAt,snapshot.result.contributionSetChecksum,snapshot.result.overrideSetChecksum,input.previewChecksum,snapshot.result.effectiveChecksum,outcome,delta,input.idempotencyKey,fingerprint,input.actorId]);
    for(const decision of snapshot.result.decisions){await client.query(`insert into reconciliation_field_decisions(id,run_id,field_name,outcome,effective_value,winning_contribution_id,provenance) values($1,$2,$3,$4,$5::jsonb,$6,$7::jsonb)`,[randomUUID(),runId,decision.field,decision.outcome,JSON.stringify(decision.value??null),decision.winnerContributionId??null,JSON.stringify(decision)]);if(decision.conflict)await client.query(`insert into reconciliation_conflicts(id,entity_kind,entity_uuid,field_name,policy_id,contribution_set_checksum,severity,status,details) values($1,$2,$3,$4,$5,$6,$7,'REVIEW_REQUIRED',$8::jsonb) on conflict(entity_kind,entity_uuid,field_name,policy_id,contribution_set_checksum) do nothing`,[randomUUID(),input.entityKind,input.entityUuid,decision.field,input.policyId,snapshot.result.contributionSetChecksum,decision.conflict.severity,JSON.stringify(decision.conflict)]);}
    if(!snapshot.result.materializationEligible||!changed)return {outcome,previewChecksum:input.previewChecksum,effectiveChecksum:snapshot.result.effectiveChecksum,replay:false};
    const selected=Object.entries(snapshot.result.effectiveState).filter(([field,value])=>columns[input.entityKind][field]&&reconciliationChecksum(value)!==reconciliationChecksum(snapshot.currentState[field])),assignments=selected.map(([field],index)=>`${columns[input.entityKind][field]}=$${index+2}`),values=selected.map(([,value])=>value),canonicalTable=input.entityKind==='meeting'?'meetings':'events',identity=input.entityKind==='meeting'?'id':'normalized_uuid';
    if(assignments.length)await client.query(`update ${canonicalTable} set ${assignments.join(',')},updated_at=now() where ${identity}=$1`,[input.entityUuid,...values]);
    const revision=Number(snapshot.canonical.public_revision??0)+1,operation=snapshot.canonical.public_revision?'updated':'created';
    await client.query(`insert into public_resource_states(resource_type,resource_id,championship_id,revision,lifecycle,canonical_state,state_checksum,promoted_at) values($1,$2,$3,$4,'active',$5::jsonb,$6,now()) on conflict(resource_type,resource_id) do update set revision=excluded.revision,canonical_state=excluded.canonical_state,state_checksum=excluded.state_checksum,promoted_at=excluded.promoted_at`,[input.entityKind,input.entityUuid,snapshot.canonical.championship_id,revision,JSON.stringify(snapshot.result.effectiveState),snapshot.result.effectiveChecksum]);
    const change=(await client.query(`insert into public_change_log(resource_type,resource_id,resource_revision,operation,changed_fields,state_checksum,occurred_at) values($1,$2,$3,$4,$5,$6,$7) returning sequence`,[input.entityKind,input.entityUuid,revision,operation,selected.map(([field])=>field),snapshot.result.effectiveChecksum,input.evaluationAt])).rows[0];
    await client.query(`insert into public_resource_versions(resource_type,resource_id,revision,publication_sequence,operation,championship_id,lifecycle,canonical_state,state_checksum,published_at) values($1,$2,$3,$4,$5,$6,'active',$7::jsonb,$8,$9)`,[input.entityKind,input.entityUuid,revision,change.sequence,operation,snapshot.canonical.championship_id,JSON.stringify(snapshot.result.effectiveState),snapshot.result.effectiveChecksum,input.evaluationAt]);
    if(input.failBeforeCommit)throw new Error('reconciliation_publication_injected_failure');
    return {outcome,previewChecksum:input.previewChecksum,effectiveChecksum:snapshot.result.effectiveChecksum,revision,sequence:Number(change.sequence),replay:false};
  }
}
