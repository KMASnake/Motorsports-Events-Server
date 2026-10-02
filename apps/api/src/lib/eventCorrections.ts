import type { PoolClient } from 'pg';
import {CanonicalFieldOverrideService} from '../reconciliation/canonicalFieldOverrideService.js';
import {
  decideLocalOverride,
  decideProviderSync,
  isProviderEvent,
  normalizeCorrectionValue,
  sameCorrectionValue,
  type EventSource
} from './correctionPolicy.js';

export const correctableEventFields = [
  'championship_id', 'circuit_id', 'name', 'slug', 'category', 'starts_at',
  'ends_at', 'status', 'published', 'description', 'session_title'
] as const;

export type CorrectableEventField = typeof correctableEventFields[number];
export type CorrectableEventPatch = Partial<Record<CorrectableEventField, unknown>>;
export type EventDatabaseRow = EventSource & Record<string, unknown> & { id: string };

type CorrectionRow = {
  id: string;
  event_id: string;
  field_name: CorrectableEventField;
  provider_value: unknown;
  override_value: unknown;
  status: 'active' | 'conflict';
};
const overrideService=new CanonicalFieldOverrideService();

const fieldSet = new Set<string>(correctableEventFields);

export function assertCorrectableField(field: string): CorrectableEventField {
  if (!fieldSet.has(field)) throw new Error(`Champ de correction interdit: ${field}`);
  return field as CorrectableEventField;
}

export async function lockEvent(client: PoolClient, eventId: string): Promise<EventDatabaseRow | null> {
  const identity = await client.query('select normalized_uuid from events where id=$1', [eventId]);
  const normalizedUuid = identity.rows[0]?.normalized_uuid;
  if (normalizedUuid) {
    await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`event:${normalizedUuid}`]);
  }
  const result = await client.query('select * from events where id=$1 for update', [eventId]);
  return result.rows[0] ?? null;
}

async function activeCorrections(client: PoolClient, eventId: string): Promise<Map<CorrectableEventField, CorrectionRow>> {
  const result = await client.query(
    `select id,canonical_record_id event_id,field_name,provider_value_at_creation provider_value,override_value,
            case when legacy_status='conflict' then 'conflict' else 'active' end status
       from canonical_field_overrides
      where entity_kind='event' and canonical_record_id=$1 and status='active'
      for update`,
    [eventId]
  );
  return new Map(result.rows.map((row) => [assertCorrectableField(row.field_name), row as CorrectionRow]));
}

export async function reconcileAdministrativePatch(
  client: PoolClient,
  current: EventDatabaseRow,
  patch: CorrectableEventPatch,
  actor = 'administrator'
): Promise<void> {
  if (!isProviderEvent(current)) return;
  const existing = await activeCorrections(client, current.id);
  for (const field of correctableEventFields) {
    if (!(field in patch)) continue;
    const correction = existing.get(field);
    const decision = decideLocalOverride(current, current[field], patch[field], correction);
    if (decision.action === 'none') continue;
    if (decision.action === 'remove') {
      await overrideService.revokeCompatibleInTransaction(client,{entityKind:'event',entityUuid:String(current.normalized_uuid),overrideId:correction!.id,actorId:actor,reason:'Legacy Event administration: provider value explicitly restored',legacyOperationId:`event-patch:${current.id}:${field}`});
      continue;
    }
    if (decision.action === 'create') {
      await overrideService.setCompatibleInTransaction(client,{entityKind:'event',entityUuid:String(current.normalized_uuid),canonicalRecordId:current.id,fieldName:field,value:decision.overrideValue,providerValueAtCreation:decision.providerValue,actorId:actor,reason:'Legacy Event administration',legacyOperationId:`event-patch:${current.id}:${field}`,legacyStatus:'active'});
      continue;
    }
    await overrideService.setCompatibleInTransaction(client,{entityKind:'event',entityUuid:String(current.normalized_uuid),canonicalRecordId:current.id,fieldName:field,value:decision.overrideValue,providerValueAtCreation:decision.providerValue,actorId:actor,reason:'Legacy Event administration',legacyOperationId:`event-patch:${current.id}:${field}`,legacyStatus:decision.keepConflict?'conflict':'active'});
  }
}

export async function applyProviderPatch(
  client: PoolClient,
  current: EventDatabaseRow,
  patch: CorrectableEventPatch
): Promise<CorrectableEventPatch> {
  if (!isProviderEvent(current)) throw new Error('Synchronisation refusée pour un événement manuel.');
  const existing = await activeCorrections(client, current.id);
  const effectivePatch: CorrectableEventPatch = {};
  for (const field of correctableEventFields) {
    if (!(field in patch)) continue;
    const correction = existing.get(field);
    const nextProviderValue = normalizeCorrectionValue(patch[field]);
    const decision = decideProviderSync(nextProviderValue, correction);
    effectivePatch[field] = decision.effectiveValue;
    if (decision.correctionAction === 'update') await overrideService.recordProviderObservationInTransaction(client,{overrideId:correction!.id,entityUuid:String(current.normalized_uuid),providerValue:nextProviderValue,legacyStatus:decision.conflict?'conflict':'active'});
  }
  return effectivePatch;
}

export async function updateEventFields(
  client: PoolClient,
  eventId: string,
  patch: CorrectableEventPatch
): Promise<EventDatabaseRow> {
  const entries = Object.entries(patch).filter(([field]) => fieldSet.has(field));
  if (!entries.length) {
    const current = await lockEvent(client, eventId);
    if (!current) throw new Error('Événement introuvable.');
    return current;
  }
  const assignments = entries.map(([field], index) => `${assertCorrectableField(field)}=$${index + 2}`);
  const values = entries.map(([, value]) => normalizeCorrectionValue(value));
  const result = await client.query(
    `update events set ${assignments.join(',')},updated_at=now() where id=$1 returning *`,
    [eventId, ...values]
  );
  return result.rows[0];
}

export async function resolveCorrection(
  client: PoolClient,
  correctionId: string,
  action: 'accept-provider' | 'keep-override' | 'delete-override' | 'set-override',
  overrideValue?: unknown,
  expectedField?: CorrectableEventField
): Promise<{ deleted: boolean; correction?: CorrectionRow }> {
  const identity = await client.query(
    `select canonical_record_id event_id from canonical_field_overrides where id::text=$1 or legacy_event_correction_id=$1`,
    [correctionId]
  );
  if (!identity.rowCount) throw new Error('Correction introuvable.');
  await lockEvent(client, identity.rows[0].event_id);
  const result = await client.query(
    `select id,canonical_record_id event_id,field_name,provider_value_at_creation provider_value,override_value,
            case when legacy_status='conflict' then 'conflict' else 'active' end status
       from canonical_field_overrides where (id::text=$1 or legacy_event_correction_id=$1) and status='active' for update`,
    [correctionId]
  );
  if (!result.rowCount) throw new Error('Correction introuvable.');
  const row = result.rows[0] as CorrectionRow;
  const field = assertCorrectableField(row.field_name);
  if (expectedField && field !== expectedField) {
    throw new Error('Le champ de correction ne correspond pas à la correction demandée.');
  }

  if (action === 'keep-override') {
    await updateEventFields(client, row.event_id, { [field]: row.override_value });
    const updated=await overrideService.setCompatibleInTransaction(client,{entityKind:'event',entityUuid:String((await client.query('select normalized_uuid from events where id=$1',[row.event_id])).rows[0].normalized_uuid),canonicalRecordId:row.event_id,fieldName:field,value:row.override_value,providerValueAtCreation:row.provider_value,actorId:'administrator',reason:'Legacy correction keep override',legacyOperationId:`legacy-correction:${correctionId}:keep`,legacyStatus:'active'});
    return { deleted: false, correction: updated.override };
  }

  if (action === 'accept-provider' || action === 'delete-override' || sameCorrectionValue(overrideValue, row.provider_value)) {
    await updateEventFields(client, row.event_id, { [field]: row.provider_value });
    const eventUuid=String((await client.query('select normalized_uuid from events where id=$1',[row.event_id])).rows[0].normalized_uuid);
    await overrideService.revokeCompatibleInTransaction(client,{entityKind:'event',entityUuid:eventUuid,overrideId:row.id,actorId:'administrator',reason:`Legacy correction ${action}`,legacyOperationId:`legacy-correction:${correctionId}:${action}`});
    return { deleted: true };
  }

  const next = normalizeCorrectionValue(overrideValue);
  await updateEventFields(client, row.event_id, { [field]: next });
  const eventUuid=String((await client.query('select normalized_uuid from events where id=$1',[row.event_id])).rows[0].normalized_uuid);
  const updated=await overrideService.setCompatibleInTransaction(client,{entityKind:'event',entityUuid:eventUuid,canonicalRecordId:row.event_id,fieldName:field,value:next,providerValueAtCreation:row.provider_value,actorId:'administrator',reason:'Legacy correction set override',legacyOperationId:`legacy-correction:${correctionId}:set`,legacyStatus:'active'});
  return { deleted: false, correction: updated.override };
}
