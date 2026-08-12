import type { JsonValue } from './contracts.js';

export class ProviderHttpError extends Error {
  constructor(readonly code: string, message: string, readonly statusCode?: number) { super(message); }
}

export type ProviderFetch = typeof fetch;

export async function fetchProviderJson(input: {
  url: URL;
  allowedHosts: readonly string[];
  headers?: Readonly<Record<string,string>>;
  counter?: { increment(): void };
  fetchImpl?: ProviderFetch;
  allowTestHttp?: boolean;
  timeoutMs?: number;
  maxBytes?: number;
}): Promise<JsonValue> {
  const { url } = input;
  const validProtocol = url.protocol === 'https:' || (input.allowTestHttp === true && url.protocol === 'http:');
  if (!validProtocol || !input.allowedHosts.includes(url.hostname)) throw new ProviderHttpError('unsafe_endpoint','Endpoint fournisseur refusé.');
  input.counter?.increment();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 8_000);
  try {
    const response = await (input.fetchImpl ?? fetch)(url, { headers: input.headers, redirect:'error', signal:controller.signal });
    const declaredLength = Number(response.headers.get('content-length') ?? 0);
    const limit = input.maxBytes ?? 1_000_000;
    if (declaredLength > limit) throw new ProviderHttpError('response_too_large','Réponse fournisseur trop volumineuse.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > limit) throw new ProviderHttpError('response_too_large','Réponse fournisseur trop volumineuse.');
    let value: unknown;
    try { value = JSON.parse(new TextDecoder().decode(bytes)); }
    catch { throw new ProviderHttpError('invalid_json','Réponse fournisseur invalide.'); }
    if (!response.ok) throw new ProviderHttpError(`http_${response.status}`,`Le fournisseur a répondu HTTP ${response.status}.`,response.status);
    return value as JsonValue;
  } catch (error) {
    if (error instanceof ProviderHttpError) throw error;
    if ((error as Error).name === 'AbortError') throw new ProviderHttpError('timeout','Délai fournisseur dépassé.');
    throw new ProviderHttpError('network_error','Connexion au fournisseur impossible.');
  } finally { clearTimeout(timeout); }
}
