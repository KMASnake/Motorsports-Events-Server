import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
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
  'ends_at', 'status', 'published', 'description'
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

const fieldSet = new Set<string>(correctableEventFields);

export function assertCorrectableField(field: string): CorrectableEventField {
  if (!fieldSet.has(field)) throw new Error(`Champ de correction interdit: ${field}`);
  return field as CorrectableEventField;
}

export async function lockEvent(client: PoolClient, eventId: string): Promise<EventDatabaseRow | null> {
  const result = await client.query('select * from events where id=$1 for update', [eventId]);
  return result.rows[0] ?? null;
}

async function activeCorrections(client: PoolClient, eventId: string): Promise<Map<CorrectableEventField, CorrectionRow>> {
  const result = await client.query(
    `select id,event_id,field_name,provider_value,override_value,status
       from event_corrections
      where event_id=$1 and status in ('active','conflict')
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
      await client.query('delete from event_corrections where id=$1', [correction!.id]);
      continue;
    }
    if (decision.action === 'create') {
      await client.query(
        `insert into event_corrections(
          id,event_id,provider_key,external_id,field_name,provider_value,override_value,created_by
        ) values($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8)
        on conflict(event_id,field_name) do update
          set provider_key=excluded.provider_key,
              external_id=excluded.external_id,
              provider_value=excluded.provider_value,
              override_value=excluded.override_value,
              status='active',
              created_by=excluded.created_by,
              last_provider_seen_at=null,
              conflict_detected_at=null,
              updated_at=now()`,
        [
          randomUUID(), current.id, current.provider_key, current.external_id, field,
          JSON.stringify(decision.providerValue), JSON.stringify(decision.overrideValue), actor
        ]
      );
      continue;
    }
    await client.query(
      `update event_corrections
          set override_value=$2::jsonb,
              status=$3,
              updated_at=now()
        where id=$1`,
      [correction!.id, JSON.stringify(decision.overrideValue), decision.keepConflict ? 'conflict' : 'active']
    );
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
    if (decision.correctionAction === 'remove') {
      await client.query('delete from event_corrections where id=$1', [correction!.id]);
    } else if (decision.correctionAction === 'update') {
      await client.query(
        `update event_corrections
            set provider_value=$2::jsonb,
                status=$3,
                last_provider_seen_at=now(),
                conflict_detected_at=case when $3='conflict' then coalesce(conflict_detected_at,now()) else null end,
                updated_at=now()
          where id=$1`,
        [correction!.id, JSON.stringify(nextProviderValue), decision.conflict ? 'conflict' : 'active']
      );
    }
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
  overrideValue?: unknown
): Promise<{ deleted: boolean; correction?: CorrectionRow }> {
  const identity = await client.query(
    'select event_id from event_corrections where id=$1',
    [correctionId]
  );
  if (!identity.rowCount) throw new Error('Correction introuvable.');
  await lockEvent(client, identity.rows[0].event_id);
  const result = await client.query(
    `select id,event_id,field_name,provider_value,override_value,status
       from event_corrections where id=$1 for update`,
    [correctionId]
  );
  if (!result.rowCount) throw new Error('Correction introuvable.');
  const row = result.rows[0] as CorrectionRow;
  const field = assertCorrectableField(row.field_name);

  if (action === 'keep-override') {
    await updateEventFields(client, row.event_id, { [field]: row.override_value });
    const updated = await client.query(
      `update event_corrections
          set status='active',conflict_detected_at=null,updated_at=now()
        where id=$1 returning *`,
      [correctionId]
    );
    return { deleted: false, correction: updated.rows[0] };
  }

  if (action === 'accept-provider' || action === 'delete-override' || sameCorrectionValue(overrideValue, row.provider_value)) {
    await updateEventFields(client, row.event_id, { [field]: row.provider_value });
    await client.query('delete from event_corrections where id=$1', [correctionId]);
    return { deleted: true };
  }

  const next = normalizeCorrectionValue(overrideValue);
  await updateEventFields(client, row.event_id, { [field]: next });
  const updated = await client.query(
    `update event_corrections
        set override_value=$2::jsonb,status='active',conflict_detected_at=null,updated_at=now()
      where id=$1 returning *`,
    [correctionId, JSON.stringify(next)]
  );
  return { deleted: false, correction: updated.rows[0] };
}
