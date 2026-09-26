import { describe, expect, it } from 'vitest';
import { assertProviderConfigContainsNoSecrets, ProviderMasterKeyError, ProviderSecretCipher, redactProviderData } from '../src/providers/providerSecrets.js';

const key = (fill: number) => Buffer.alloc(32, fill);
const providerId = '10000000-0000-4000-8000-000000000001';

describe('ProviderSecretCipher', () => {
  it('round-trips AES-256-GCM without storing plaintext', () => {
    const cipher = new ProviderSecretCipher(new Map([[1, key(1)]]), 1);
    const encrypted = cipher.encrypt('SUPER_SECRET_SENTINEL_5_2', providerId, 'api_key');
    expect(encrypted.algorithm).toBe('aes-256-gcm');
    expect(encrypted.ciphertext.toString()).not.toContain('SUPER_SECRET_SENTINEL_5_2');
    expect(cipher.decrypt(encrypted, providerId, 'api_key')).toBe('SUPER_SECRET_SENTINEL_5_2');
  });

  it('uses a unique nonce and ciphertext for repeated writes', () => {
    const cipher = new ProviderSecretCipher(new Map([[1, key(2)]]), 1);
    const first = cipher.encrypt('same-value', providerId, 'api_key');
    const second = cipher.encrypt('same-value', providerId, 'api_key');
    expect(first.nonce.equals(second.nonce)).toBe(false);
    expect(first.ciphertext.equals(second.ciphertext)).toBe(false);
  });

  it.each(['ciphertext','nonce'] as const)('rejects tampered %s', (field) => {
    const cipher = new ProviderSecretCipher(new Map([[1, key(3)]]), 1);
    const encrypted = cipher.encrypt('value', providerId, 'api_key');
    const changed = Buffer.from(encrypted[field]); changed[0] ^= 1;
    expect(() => cipher.decrypt({ ...encrypted, [field]: changed }, providerId, 'api_key')).toThrow(/altéré/);
  });

  it('rejects a wrong key and unsupported key version', () => {
    const v1 = new ProviderSecretCipher(new Map([[1, key(4)]]), 1);
    const encrypted = v1.encrypt('value', providerId, 'api_key');
    const wrong = new ProviderSecretCipher(new Map([[1, key(5)]]), 1);
    expect(() => wrong.decrypt(encrypted, providerId, 'api_key')).toThrow(/altéré/);
    const v2Only = new ProviderSecretCipher(new Map([[2, key(6)]]), 2);
    expect(() => v2Only.decrypt(encrypted, providerId, 'api_key')).toThrow(/Version/);
  });

  it('reads an old version while new writes use the active version', () => {
    const v1 = new ProviderSecretCipher(new Map([[1, key(7)]]), 1);
    const old = v1.encrypt('old-value', providerId, 'api_key');
    const rotated = new ProviderSecretCipher(new Map([[1, key(7)],[2, key(8)]]), 2);
    expect(rotated.decrypt(old, providerId, 'api_key')).toBe('old-value');
    expect(rotated.encrypt('new-value', providerId, 'api_key').keyVersion).toBe(2);
  });

  it('fails safely for missing or invalid environment keys', () => {
    expect(ProviderSecretCipher.fromEnvironment({})).toBeNull();
    expect(() => ProviderSecretCipher.fromEnvironment({ PROVIDER_ACTIVE_KEY_VERSION: '1' })).toThrow(ProviderMasterKeyError);
    expect(() => ProviderSecretCipher.fromEnvironment({ PROVIDER_MASTER_KEYS: '{', PROVIDER_ACTIVE_KEY_VERSION: '1' })).toThrow(ProviderMasterKeyError);
    expect(() => ProviderSecretCipher.fromEnvironment({ PROVIDER_MASTER_KEYS: '{}', PROVIDER_ACTIVE_KEY_VERSION: '1' })).toThrow(ProviderMasterKeyError);
    expect(() => ProviderSecretCipher.fromEnvironment({ PROVIDER_MASTER_KEYS: '{"1":"not-base64"}', PROVIDER_ACTIVE_KEY_VERSION: '1' })).toThrow(ProviderMasterKeyError);
    expect(() => ProviderSecretCipher.fromEnvironment({ PROVIDER_MASTER_KEYS: '{"1":"YQ=="}', PROVIDER_ACTIVE_KEY_VERSION: '1' })).toThrow(ProviderMasterKeyError);
    expect(() => ProviderSecretCipher.fromEnvironment({ PROVIDER_MASTER_KEYS: '{"1":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="}', PROVIDER_ACTIVE_KEY_VERSION: 'invalid' })).toThrow(ProviderMasterKeyError);
    expect(() => ProviderSecretCipher.fromEnvironment({ PROVIDER_MASTER_KEYS: '{"0":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="}', PROVIDER_ACTIVE_KEY_VERSION: '0' })).toThrow(ProviderMasterKeyError);
  });

  it('redacts the sentinel and all sensitive descendants', () => {
    const sanitized = JSON.stringify(redactProviderData({
      providerId,
      apiKey: 'SUPER_SECRET_SENTINEL_5_2',
      nested: { Authorization: 'SUPER_SECRET_SENTINEL_5_2', safe: true }
    }));
    expect(sanitized).not.toContain('SUPER_SECRET_SENTINEL_5_2');
    expect(sanitized).toContain('providerId');
    expect(sanitized).toContain('safe');
  });

  it('refuses credentials in non-secret provider configuration', () => {
    expect(() => assertProviderConfigContainsNoSecrets({ nested: { api_key: 'forbidden' } })).toThrow(/credential/);
    expect(() => assertProviderConfigContainsNoSecrets({ base_url: 'https://fixture.invalid' })).not.toThrow();
  });
});
