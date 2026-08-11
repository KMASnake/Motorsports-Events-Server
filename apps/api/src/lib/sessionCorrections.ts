import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { sameCorrectionValue } from './correctionPolicy.js';
import { validateSessionPeriod } from './sessionContracts.js';
import type { ProviderSessionPatch, SessionCorrectionInput } from './sessionCorrectionValue.js';

export const correctableSessionFields = [
  'title', 'starts_at', 'ends_at', 'status', 'published', 'description'
] as const;
export type CorrectableSessionField = typeof correctableSessionFields[number];
type SessionPatch = Partial<Record<CorrectableSessionField, unknown>>;
type AuditIdentity = { actor: string; requestId: string; action: string };

export type SessionCorrectionRow = {
  id: string;
  session_id: string;
  provider_key: string;
  external_id: string | null;
  field_name: CorrectableSessionField;
  provider_value: unknown;
  override_value: unknown;
  status: 'active' | 'conflict';
};

type SessionRow = Record<string, unknown> & {
  id: string;
  event_id: string;
  name: string;
  starts_at: string | Date;
  ends_at: string | Date | null;
  origin: 'manual' | 'provider' | 'import' | 'mixed';
  provider_key: string | null;
  external_id: string | null;
};

const fieldSet = new Set<string>(correctableSessionFields);
const databaseField = (field: CorrectableSessionField): string => field === 'title' ? 'name' : field;

export function assertCorrectableSessionField(field: string): CorrectableSessionField {
  if (!fieldSet.has(field)) throw new SessionCorrectionValidationError(`Champ de correction interdit: ${field}`);
  return field as CorrectableSessionField;
}

function sessionValue(session: SessionRow, field: CorrectableSessionField): unknown {
  const value = session[databaseField(field)];
  if ((field === 'starts_at' || field === 'ends_at') && value) return new Date(value as string | Date).toISOString();
  return value;
}

async function lockSession(client: PoolClient, id: string): Promise<SessionRow | null> {
  return (await client.query('select * from sessions where id=$1 for update', [id])).rows[0] as SessionRow ?? null;
}

async function lockCorrection(client: PoolClient, id: string): Promise<SessionCorrectionRow | null> {
  const row = (await client.query(`select id,session_id,provider_key,external_id,field_name,
      provider_value,override_value,status from session_corrections where id=$1 for update`, [id])).rows[0];
  if (!row) return null;
  row.field_name = assertCorrectableSessionField(row.field_name);
  return row as SessionCorrectionRow;
}

async function activeCorrections(client: PoolClient, sessionId: string): Promise<Map<CorrectableSessionField, SessionCorrectionRow>> {
  const rows = (await client.query(`select id,session_id,provider_key,external_id,field_name,
      provider_value,override_value,status from session_corrections
      where session_id=$1 and status in ('active','conflict') for update`, [sessionId])).rows;
  return new Map(rows.map((row) => {
    const field = assertCorrectableSessionField(row.field_name);
    return [field, { ...row, field_name: field } as SessionCorrectionRow];
  }));
}

function assertProviderSession(session: SessionRow): void {
  if (session.origin === 'manual' || (!session.provider_key && !session.external_id)) {
    throw new SessionCorrectionConflictError('Les corrections sont réservées aux Sessions fournisseur.');
  }
}

function validateEffectivePeriod(session: SessionRow, patch: SessionPatch): void {
  const startsAt = String(patch.starts_at ?? sessionValue(session, 'starts_at'));
  const endsValue = 'ends_at' in patch ? patch.ends_at : sessionValue(session, 'ends_at');
  const error = validateSessionPeriod(startsAt, endsValue === null ? null : String(endsValue));
  if (error) throw new SessionCorrectionValidationError(error);
}

async function updateSession(client: PoolClient, session: SessionRow, patch: SessionPatch): Promise<SessionRow> {
  validateEffectivePeriod(session, patch);
  const entries = Object.entries(patch).filter(([field]) => fieldSet.has(field));
  if (!entries.length) return session;
  const assignments = entries.map(([field], index) => `${databaseField(assertCorrectableSessionField(field))}=$${index + 2}`);
  const result = await client.query(
    `update sessions set ${assignments.join(',')},updated_at=now() where id=$1 returning *`,
    [session.id, ...entries.map(([, value]) => value)]
  );
  return result.rows[0] as SessionRow;
}

async function writeAudit(
  client: PoolClient,
  identity: AuditIdentity,
  resourceId: string,
  oldValue: unknown,
  newValue: unknown
): Promise<void> {
  await client.query(`insert into admin_audit_log(
      actor,action,resource_type,resource_id,request_id,old_value,new_value
    ) values($1,$2,'session-correction',$3,$4,$5::jsonb,$6::jsonb)`, [
    identity.actor, identity.action, resourceId, identity.requestId,
    JSON.stringify(oldValue), JSON.stringify(newValue)
  ]);
}

export async function setSessionOverride(
  client: PoolClient,
  sessionId: string,
  input: SessionCorrectionInput,
  audit: AuditIdentity
): Promise<{ deleted: boolean; correction?: SessionCorrectionRow }> {
  const session = await lockSession(client, sessionId);
  if (!session) throw new SessionCorrectionNotFoundError('Session introuvable.');
  assertProviderSession(session);
  const corrections = await activeCorrections(client, sessionId);
  const current = corrections.get(input.field_name);
  const providerValue = current?.provider_value ?? sessionValue(session, input.field_name);
  const oldValue = { session, correction: current ?? null };
  if (sameCorrectionValue(providerValue, input.override_value)) {
    if (!current) return { deleted: true };
    const updatedSession = await updateSession(client, session, { [input.field_name]: providerValue });
    await client.query('delete from session_corrections where id=$1', [current.id]);
    await writeAudit(client, audit, current.id, oldValue, { session: updatedSession, correction: null });
    return { deleted: true };
  }
  const updatedSession = await updateSession(client, session, { [input.field_name]: input.override_value });
  const result = await client.query(`insert into session_corrections(
      id,session_id,provider_key,external_id,field_name,provider_value,override_value,created_by
    ) values($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8)
    on conflict(session_id,field_name) do update set
      override_value=excluded.override_value,status='active',created_by=excluded.created_by,
      conflict_detected_at=null,updated_at=now() returning *`, [
    current?.id ?? randomUUID(), sessionId, session.provider_key, session.external_id,
    input.field_name, JSON.stringify(providerValue), JSON.stringify(input.override_value), audit.actor
  ]);
  const correction = result.rows[0] as SessionCorrectionRow;
  await writeAudit(client, audit, correction.id, oldValue, { session: updatedSession, correction });
  return { deleted: false, correction };
}

export async function synchronizeProviderSession(
  client: PoolClient,
  sessionId: string,
  patch: ProviderSessionPatch,
  audit: AuditIdentity
): Promise<SessionRow> {
  const session = await lockSession(client, sessionId);
  if (!session) throw new SessionCorrectionNotFoundError('Session introuvable.');
  assertProviderSession(session);
  const corrections = await activeCorrections(client, sessionId);
  const effectivePatch: SessionPatch = {};
  const oldValue = { session, corrections: [...corrections.values()] };
  for (const [rawField, nextProvider] of Object.entries(patch)) {
    const field = assertCorrectableSessionField(rawField);
    const correction = corrections.get(field);
    if (!correction) {
      effectivePatch[field] = nextProvider;
      continue;
    }
    if (sameCorrectionValue(correction.override_value, nextProvider)) {
      effectivePatch[field] = nextProvider;
      await client.query('delete from session_corrections where id=$1', [correction.id]);
      corrections.delete(field);
      continue;
    }
    effectivePatch[field] = correction.override_value;
    const conflict = !sameCorrectionValue(correction.provider_value, nextProvider);
    const updated = (await client.query(`update session_corrections set provider_value=$2::jsonb,
        status=$3,last_provider_seen_at=now(),
        conflict_detected_at=case when $3='conflict' then coalesce(conflict_detected_at,now()) else null end,
        updated_at=now() where id=$1 returning *`, [
      correction.id, JSON.stringify(nextProvider), conflict ? 'conflict' : 'active'
    ])).rows[0] as SessionCorrectionRow;
    corrections.set(field, updated);
  }
  const updatedSession = await updateSession(client, session, effectivePatch);
  await writeAudit(client, audit, sessionId, oldValue, { session: updatedSession, corrections: [...corrections.values()] });
  return updatedSession;
}

export async function resolveSessionCorrection(
  client: PoolClient,
  correctionId: string,
  action: 'accept-provider' | 'keep-override' | 'restore-provider' | 'set-override',
  audit: AuditIdentity,
  input?: SessionCorrectionInput
): Promise<{ deleted: boolean; correction?: SessionCorrectionRow }> {
  const identity = await client.query('select session_id from session_corrections where id=$1', [correctionId]);
  if (!identity.rowCount) throw new SessionCorrectionNotFoundError('Correction Session introuvable.');
  const session = await lockSession(client, identity.rows[0].session_id);
  if (!session) throw new SessionCorrectionNotFoundError('Session introuvable.');
  const correction = await lockCorrection(client, correctionId);
  if (!correction) throw new SessionCorrectionNotFoundError('Correction Session introuvable.');
  if (input && input.field_name !== correction.field_name) {
    throw new SessionCorrectionValidationError('Le champ demandé ne correspond pas à la correction.');
  }
  const oldValue = { session, correction };
  if (action === 'accept-provider' || action === 'restore-provider'
      || (input && sameCorrectionValue(input.override_value, correction.provider_value))) {
    const updatedSession = await updateSession(client, session, { [correction.field_name]: correction.provider_value });
    await client.query('delete from session_corrections where id=$1', [correctionId]);
    await writeAudit(client, audit, correctionId, oldValue, { session: updatedSession, correction: null });
    return { deleted: true };
  }
  const overrideValue = input?.override_value ?? correction.override_value;
  const updatedSession = await updateSession(client, session, { [correction.field_name]: overrideValue });
  const updated = (await client.query(`update session_corrections set override_value=$2::jsonb,
      status='active',conflict_detected_at=null,updated_at=now() where id=$1 returning *`, [
    correctionId, JSON.stringify(overrideValue)
  ])).rows[0] as SessionCorrectionRow;
  await writeAudit(client, audit, correctionId, oldValue, { session: updatedSession, correction: updated });
  return { deleted: false, correction: updated };
}

export class SessionCorrectionNotFoundError extends Error {}
export class SessionCorrectionConflictError extends Error {}
export class SessionCorrectionValidationError extends Error {}
