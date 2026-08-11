import argon2 from 'argon2';

export const ADMIN_PASSWORD_MIN_LENGTH = 12;

export function normalizeAdminUsername(username: string): string {
  return username.trim().normalize('NFKC').toLocaleLowerCase('en-US');
}

export function validateAdminUsername(username: string): string {
  const trimmed = username.trim();
  if (!trimmed || trimmed.length > 128) {
    throw new Error('Administrator username must contain between 1 and 128 characters.');
  }
  return trimmed;
}

export function validateAdminPassword(password: string): void {
  if (password.length < ADMIN_PASSWORD_MIN_LENGTH || password.length > 1024) {
    throw new Error(`Administrator password must contain between ${ADMIN_PASSWORD_MIN_LENGTH} and 1024 characters.`);
  }
}

export async function hashAdminPassword(password: string): Promise<string> {
  validateAdminPassword(password);
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65_536,
    timeCost: 3,
    parallelism: 1,
    hashLength: 32
  });
}

export async function verifyAdminPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
