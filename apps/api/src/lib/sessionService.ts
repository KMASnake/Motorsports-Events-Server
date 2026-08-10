import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { CreateSessionBody, UpdateSessionBody } from './sessionContracts.js';

export type SessionRow = Record<string, unknown> & {
  id: string;
  event_id: string;
  origin: 'manual' | 'provider' | 'import' | 'mixed';
};

function withTitle(row: SessionRow): SessionRow {
  return { ...row, title: row.name };
}

type AuditIdentity = { actor: string; requestId: string; action: string };

async function writeAudit(
  client: PoolClient,
  identity: AuditIdentity,
  sessionId: string,
  oldValue: SessionRow | null,
  newValue: SessionRow | null
): Promise<void> {
  await client.query(
    `insert into admin_audit_log(
       actor,action,resource_type,resource_id,request_id,old_value,new_value
     ) values($1,$2,'session',$3,$4,$5::jsonb,$6::jsonb)`,
    [identity.actor, identity.action, sessionId, identity.requestId,
      JSON.stringify(oldValue), JSON.stringify(newValue)]
  );
}

async function assertEvent(client: PoolClient, eventId: string): Promise<void> {
  if (!(await client.query('select 1 from events where id=$1', [eventId])).rowCount) {
    throw new SessionReferenceError('L’événement sélectionné n’existe pas.');
  }
}

export async function createManualSession(
  client: PoolClient,
  eventId: string,
  body: CreateSessionBody,
  audit: AuditIdentity
): Promise<SessionRow> {
  await assertEvent(client, eventId);
  const id = randomUUID();
  const result = await client.query(
    `insert into sessions(
       id,event_id,name,type,starts_at,ends_at,status,published,description,
       origin,provider_key,external_id
     ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,'manual',null,null)
     returning *`,
    [id, eventId, body.title, 'other', body.starts_at, body.ends_at ?? null,
      body.status, body.published, body.description ?? null]
  );
  const created = result.rows[0] as SessionRow;
  await writeAudit(client, audit, id, null, created);
  return withTitle(created);
}

export async function lockSession(client: PoolClient, id: string): Promise<SessionRow | null> {
  const row = (await client.query('select * from sessions where id=$1 for update', [id])).rows[0] as SessionRow | undefined;
  return row ?? null;
}

export async function updateManualSession(
  client: PoolClient,
  id: string,
  patch: UpdateSessionBody,
  audit: AuditIdentity
): Promise<SessionRow | null> {
  const current = await lockSession(client, id);
  if (!current) return null;
  if (current.origin !== 'manual') {
    throw new SessionConflictError('Une Session fournisseur nécessite le futur workflow de corrections.');
  }
  const databasePatch = { ...patch, ...('title' in patch ? { name: patch.title } : {}) } as UpdateSessionBody & { name?: string };
  const allowed = ['name', 'starts_at', 'ends_at', 'status', 'published', 'description'] as const;
  const entries = allowed.filter((field) => field in databasePatch).map((field) => [field, databasePatch[field]] as const);
  const assignments = entries.map(([field], index) => `${field}=$${index + 2}`);
  const result = await client.query(
    `update sessions set ${assignments.join(',')},updated_at=now() where id=$1 returning *`,
    [id, ...entries.map(([, value]) => value)]
  );
  const updated = result.rows[0] as SessionRow;
  await writeAudit(client, audit, id, current, updated);
  return withTitle(updated);
}

export async function deleteManualSession(
  client: PoolClient,
  id: string,
  audit: AuditIdentity
): Promise<boolean> {
  const current = await lockSession(client, id);
  if (!current) return false;
  if (current.origin !== 'manual') {
    throw new SessionConflictError('Une Session fournisseur nécessite le futur workflow de corrections.');
  }
  await client.query('delete from sessions where id=$1', [id]);
  await writeAudit(client, audit, id, current, null);
  return true;
}

export class SessionReferenceError extends Error {}
export class SessionConflictError extends Error {}
