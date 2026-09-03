import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

export type EncryptedProviderSecret = {
  ciphertext: Buffer;
  nonce: Buffer;
  keyVersion: number;
  algorithm: typeof ALGORITHM;
};

export class ProviderMasterKeyError extends Error {
  constructor(message = 'Configuration de chiffrement fournisseur indisponible.') {
    super(message);
    this.name = 'ProviderMasterKeyError';
  }
}

export class ProviderSecretCipher {
  readonly #keys: ReadonlyMap<number, Buffer>;
  readonly activeVersion: number;

  constructor(keys: ReadonlyMap<number, Buffer>, activeVersion: number) {
    const copied = new Map<number, Buffer>();
    for (const [version, key] of keys) {
      if (!Number.isSafeInteger(version) || version < 1 || key.length !== 32) throw new ProviderMasterKeyError();
      copied.set(version, Buffer.from(key));
    }
    if (!copied.has(activeVersion)) throw new ProviderMasterKeyError();
    this.#keys = copied;
    this.activeVersion = activeVersion;
  }

  static fromEnvironment(env: NodeJS.ProcessEnv = process.env): ProviderSecretCipher | null {
    const serialized = env.PROVIDER_MASTER_KEYS;
    const active = env.PROVIDER_ACTIVE_KEY_VERSION;
    if (!serialized && !active) return null;
    if (!serialized || !active || !/^\d+$/.test(active)) throw new ProviderMasterKeyError();
    let parsed: unknown;
    try { parsed = JSON.parse(serialized); } catch { throw new ProviderMasterKeyError(); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new ProviderMasterKeyError();
    const keys = new Map<number, Buffer>();
    for (const [rawVersion, encoded] of Object.entries(parsed)) {
      if (!/^\d+$/.test(rawVersion) || typeof encoded !== 'string') throw new ProviderMasterKeyError();
      const key = Buffer.from(encoded, 'base64');
      if (key.toString('base64') !== encoded || key.length !== 32) throw new ProviderMasterKeyError();
      keys.set(Number(rawVersion), key);
    }
    return new ProviderSecretCipher(keys, Number(active));
  }

  encrypt(plaintext: string, providerId: string, secretName: string): EncryptedProviderSecret {
    if (!plaintext.trim()) throw new Error('Le secret ne peut pas être vide.');
    const key = this.#keys.get(this.activeVersion);
    if (!key) throw new ProviderMasterKeyError();
    const nonce = randomBytes(NONCE_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, nonce);
    cipher.setAAD(this.#aad(providerId, secretName, this.activeVersion));
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return {
      ciphertext: Buffer.concat([encrypted, cipher.getAuthTag()]),
      nonce,
      keyVersion: this.activeVersion,
      algorithm: ALGORITHM
    };
  }

  decrypt(secret: EncryptedProviderSecret, providerId: string, secretName: string): string {
    if (secret.algorithm !== ALGORITHM || secret.nonce.length !== NONCE_BYTES || secret.ciphertext.length <= TAG_BYTES) {
      throw new ProviderMasterKeyError('Secret fournisseur invalide ou altéré.');
    }
    const key = this.#keys.get(secret.keyVersion);
    if (!key) throw new ProviderMasterKeyError('Version de clé maître non prise en charge.');
    try {
      const payload = secret.ciphertext.subarray(0, -TAG_BYTES);
      const tag = secret.ciphertext.subarray(-TAG_BYTES);
      const decipher = createDecipheriv(ALGORITHM, key, secret.nonce);
      decipher.setAAD(this.#aad(providerId, secretName, secret.keyVersion));
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(payload), decipher.final()]).toString('utf8');
    } catch {
      throw new ProviderMasterKeyError('Secret fournisseur invalide ou altéré.');
    }
  }

  #aad(providerId: string, secretName: string, version: number): Buffer {
    return Buffer.from(`mse-provider-secret\0${providerId}\0${secretName}\0${version}`, 'utf8');
  }
}

const sensitiveKey = /authorization|cookie|password|secret|token|api[_-]?key|master[_-]?key/i;
export function assertProviderConfigContainsNoSecrets(value: unknown): void {
  if (Array.isArray(value)) return value.forEach(assertProviderConfigContainsNoSecrets);
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (sensitiveKey.test(key)) throw new Error('La configuration fournisseur ne doit contenir aucun credential.');
    assertProviderConfigContainsNoSecrets(child);
  }
}

export function redactProviderData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactProviderData);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !sensitiveKey.test(key))
    .map(([key, child]) => [key, redactProviderData(child)]));
}
