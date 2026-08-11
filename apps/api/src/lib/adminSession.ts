import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool } from './db.js';
import { hashAdminPassword, normalizeAdminUsername, verifyAdminPassword } from './adminCredentials.js';

export const SESSION_IDLE_MS = 60 * 60 * 1000;
export const SESSION_ABSOLUTE_MS = 8 * 60 * 60 * 1000;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_BLOCK_MS = 15 * 60 * 1000;
export const LOGIN_FAILURE_LIMIT = 5;

export type HumanSession = {
  id: string;
  username: string;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
};

export type LoginResult =
  | { status: 'success'; session: HumanSession; token: string }
  | { status: 'invalid' }
  | { status: 'blocked'; retryAfterSeconds: number }
  | { status: 'uninitialized' };

let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashAdminPassword('dummy password never accepted'));
const tokenDigest = (token: string) => createHash('sha256').update(token).digest();

async function audit(client: PoolClient, values: {
  actor: string;
  action: string;
  requestId: string;
  newValue?: Record<string, unknown>;
}): Promise<void> {
  await client.query(
    `insert into admin_audit_log(actor,action,resource_type,resource_id,request_id,old_value,new_value)
     values($1,$2,'authentication',null,$3,null,$4::jsonb)`,
    [values.actor, values.action, values.requestId, JSON.stringify(values.newValue ?? {})]
  );
}

async function transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const value = await operation(client);
    await client.query('commit');
    return value;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function loginAdministrator(input: {
  username: string;
  password: string;
  requestId: string;
  now?: Date;
}): Promise<LoginResult> {
  const now = input.now ?? new Date();
  return transaction(async (client) => {
    await client.query(
      `delete from admin_sessions
       where (revoked_at is not null and revoked_at < $1::timestamptz - interval '24 hours')
          or idle_expires_at <= $1 or absolute_expires_at <= $1`,
      [now]
    );
    await client.query(
      `insert into admin_login_guard(singleton_key) values(true)
       on conflict(singleton_key) do nothing`
    );
    const guardResult = await client.query<{
      failed_attempts: number;
      window_started_at: Date | null;
      blocked_until: Date | null;
    }>('select failed_attempts,window_started_at,blocked_until from admin_login_guard where singleton_key=true for update');
    const guard = guardResult.rows[0];
    if (guard?.blocked_until && guard.blocked_until > now) {
      await audit(client, { actor: 'administrator', action: 'auth.login_blocked', requestId: input.requestId, newValue: { auth_method: 'human_session' } });
      return { status: 'blocked', retryAfterSeconds: Math.max(1, Math.ceil((guard.blocked_until.getTime() - now.getTime()) / 1000)) };
    }

    const accountResult = await client.query<{
      id: string;
      username: string;
      password_hash: string;
      active: boolean;
    }>('select id,username,password_hash,active from admin_accounts where username_normalized=$1', [normalizeAdminUsername(input.username)]);
    const account = accountResult.rows[0];
    if (!accountResult.rowCount) {
      const initialized = await client.query('select 1 from admin_accounts limit 1');
      if (!initialized.rowCount) return { status: 'uninitialized' };
    }
    const valid = await verifyAdminPassword(account?.password_hash ?? await getDummyHash(), input.password);
    if (!account?.active || !valid) {
      const windowActive = Boolean(guard?.window_started_at && now.getTime() - guard.window_started_at.getTime() < LOGIN_WINDOW_MS);
      const failures = windowActive ? (guard?.failed_attempts ?? 0) + 1 : 1;
      const windowStartedAt = windowActive ? guard?.window_started_at : now;
      const blockedUntil = failures >= LOGIN_FAILURE_LIMIT ? new Date(now.getTime() + LOGIN_BLOCK_MS) : null;
      await client.query(
        `update admin_login_guard set failed_attempts=$1,window_started_at=$2,blocked_until=$3,updated_at=$4
         where singleton_key=true`,
        [failures, windowStartedAt, blockedUntil, now]
      );
      await audit(client, {
        actor: 'administrator',
        action: blockedUntil ? 'auth.login_blocked' : 'auth.login_failed',
        requestId: input.requestId,
        newValue: { auth_method: 'human_session' }
      });
      return blockedUntil
        ? { status: 'blocked', retryAfterSeconds: LOGIN_BLOCK_MS / 1000 }
        : { status: 'invalid' };
    }

    await client.query(
      `update admin_login_guard set failed_attempts=0,window_started_at=null,blocked_until=null,updated_at=$1
       where singleton_key=true`,
      [now]
    );
    const token = randomBytes(32).toString('base64url');
    const id = randomUUID();
    const absoluteExpiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_MS);
    const idleExpiresAt = new Date(now.getTime() + SESSION_IDLE_MS);
    await client.query(
      `insert into admin_sessions(id,admin_account_id,token_hash,created_at,last_seen_at,idle_expires_at,absolute_expires_at)
       values($1,$2,$3,$4,$4,$5,$6)`,
      [id, account.id, tokenDigest(token), now, idleExpiresAt, absoluteExpiresAt]
    );
    await audit(client, { actor: account.username, action: 'auth.login_succeeded', requestId: input.requestId, newValue: { auth_method: 'human_session' } });
    return { status: 'success', token, session: { id, username: account.username, idleExpiresAt, absoluteExpiresAt } };
  });
}

export async function validateHumanSession(token: string, now = new Date()): Promise<HumanSession | null> {
  if (!token) return null;
  return transaction(async (client) => {
    await client.query(
      `delete from admin_sessions
       where (revoked_at is not null and revoked_at < $1::timestamptz - interval '24 hours')
          or idle_expires_at <= $1 or absolute_expires_at <= $1`,
      [now]
    );
    const result = await client.query<{
      id: string;
      username: string;
      idle_expires_at: Date;
      absolute_expires_at: Date;
      revoked_at: Date | null;
      active: boolean;
    }>(
      `select s.id,a.username,s.idle_expires_at,s.absolute_expires_at,s.revoked_at,a.active
       from admin_sessions s join admin_accounts a on a.id=s.admin_account_id
       where s.token_hash=$1 for update of s`,
      [tokenDigest(token)]
    );
    const row = result.rows[0];
    if (!row || !row.active || row.revoked_at || row.idle_expires_at <= now || row.absolute_expires_at <= now) return null;
    const idleExpiresAt = new Date(Math.min(now.getTime() + SESSION_IDLE_MS, row.absolute_expires_at.getTime()));
    await client.query('update admin_sessions set last_seen_at=$1,idle_expires_at=$2 where id=$3', [now, idleExpiresAt, row.id]);
    return { id: row.id, username: row.username, idleExpiresAt, absoluteExpiresAt: row.absolute_expires_at };
  });
}

export async function logoutHumanSession(token: string, requestId: string, now = new Date()): Promise<void> {
  if (!token) return;
  await transaction(async (client) => {
    const result = await client.query<{ username: string }>(
      `update admin_sessions s set revoked_at=coalesce(s.revoked_at,$2)
       from admin_accounts a where s.admin_account_id=a.id and s.token_hash=$1 and s.revoked_at is null
       returning a.username`,
      [tokenDigest(token), now]
    );
    if (result.rowCount) await audit(client, { actor: result.rows[0].username, action: 'auth.logout', requestId, newValue: { auth_method: 'human_session' } });
  });
}

export function createCsrfToken(sessionId: string, secret: string): string {
  const nonce = randomBytes(24).toString('base64url');
  return `${nonce}.${createHmac('sha256', secret).update(`${sessionId}.${nonce}`).digest('base64url')}`;
}

export function verifyCsrfToken(value: string, sessionId: string, secret: string): boolean {
  const [nonce, signature, extra] = value.split('.');
  if (!nonce || !signature || extra) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(`${sessionId}.${nonce}`).digest('base64url'));
  const provided = Buffer.from(signature);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export function constantTimeTokenEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
