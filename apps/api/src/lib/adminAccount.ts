import { randomUUID } from 'node:crypto';
import { pool, withTransaction } from './db.js';
import { hashAdminPassword, normalizeAdminUsername, validateAdminUsername } from './adminCredentials.js';

export async function createInitialAdministrator(usernameInput: string, password: string): Promise<void> {
  const username = validateAdminUsername(usernameInput);
  const usernameNormalized = normalizeAdminUsername(username);
  const passwordHash = await hashAdminPassword(password);

  await withTransaction(async (client) => {
    await client.query('lock table admin_accounts in exclusive mode');
    const existing = await client.query('select 1 from admin_accounts limit 1');
    if (existing.rowCount) throw new Error('An administrator account already exists.');
    await client.query(
      `insert into admin_accounts(id, username, username_normalized, password_hash)
       values($1,$2,$3,$4)`,
      [randomUUID(), username, usernameNormalized, passwordHash]
    );
    await client.query(
      `insert into admin_login_guard(singleton_key) values(true)
       on conflict(singleton_key) do nothing`
    );
  });
}

export async function resetAdministratorPassword(usernameInput: string, password: string): Promise<void> {
  const usernameNormalized = normalizeAdminUsername(validateAdminUsername(usernameInput));
  const passwordHash = await hashAdminPassword(password);

  await withTransaction(async (client) => {
    const result = await client.query(
      `update admin_accounts set password_hash=$1, password_changed_at=now(), updated_at=now()
       where username_normalized=$2`,
      [passwordHash, usernameNormalized]
    );
    if (result.rowCount !== 1) throw new Error('Administrator account not found.');
    await client.query('update admin_sessions set revoked_at=coalesce(revoked_at, now())');
    await client.query(
      `insert into admin_login_guard(singleton_key) values(true)
       on conflict(singleton_key) do update set
         failed_attempts=0, window_started_at=null, blocked_until=null, updated_at=now()`
    );
  });
}

export async function closeAdministratorStore(): Promise<void> {
  await pool.end();
}
