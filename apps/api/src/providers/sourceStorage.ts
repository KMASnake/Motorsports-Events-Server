import type { JsonObject, JsonValue } from './contracts.js';

export const MAX_PROVIDER_SOURCE_BYTES = 256 * 1024;

const sensitiveKeys = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'api-key',
  'x-api-key',
  'api_key',
  'x_api_key',
  'apikey',
  'access-token',
  'access_token',
  'refresh-token',
  'refresh_token',
  'token',
  'password',
  'client-secret',
  'client_secret',
  'secret',
  'credentials'
]);

const normalizedKey = (key: string) => key.trim().toLowerCase();

function sanitizeValue(value: JsonValue): JsonValue {
  if (typeof value === 'string') {
    let url: URL;
    try { url = new URL(value); }
    catch { return value; }
    if (url.username || url.password) {
      throw new Error('Credentialized provider URLs cannot be persisted.');
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === 'object') {
    const sanitized: Record<string, JsonValue> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (sensitiveKeys.has(normalizedKey(key))) continue;
      sanitized[key] = sanitizeValue(nested);
    }
    return sanitized;
  }
  return value;
}

export function sanitizeProviderSourceData(value: JsonObject): JsonObject {
  const sanitized = sanitizeValue(value) as JsonObject;
  const bytes = Buffer.byteLength(JSON.stringify(sanitized), 'utf8');
  if (bytes > MAX_PROVIDER_SOURCE_BYTES) {
    throw new Error(`Provider source data exceeds the ${MAX_PROVIDER_SOURCE_BYTES}-byte limit.`);
  }
  return sanitized;
}
