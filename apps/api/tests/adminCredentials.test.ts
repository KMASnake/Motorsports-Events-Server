import { describe, expect, it } from 'vitest';
import {
  hashAdminPassword,
  normalizeAdminUsername,
  validateAdminPassword,
  validateAdminUsername,
  verifyAdminPassword
} from '../src/lib/adminCredentials.js';

describe('administrator credentials', () => {
  it('normalizes the singleton account identifier consistently', () => {
    expect(normalizeAdminUsername('  Admin  ')).toBe('admin');
    expect(validateAdminUsername(' Admin ')).toBe('Admin');
  });

  it('rejects blank usernames and short passwords', () => {
    expect(() => validateAdminUsername('   ')).toThrow();
    expect(() => validateAdminPassword('too-short')).toThrow();
  });

  it('stores an Argon2id PHC hash and verifies without exposing the password', async () => {
    const password = 'a sufficiently long password';
    const hash = await hashAdminPassword(password);
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=65536,t=3,p=1\$/);
    expect(hash).not.toContain(password);
    await expect(verifyAdminPassword(hash, password)).resolves.toBe(true);
    await expect(verifyAdminPassword(hash, 'incorrect password')).resolves.toBe(false);
  });
});
