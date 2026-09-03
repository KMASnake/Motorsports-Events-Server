import type { JsonValue, ProviderRequestGate } from './contracts.js';

export class ProviderHttpError extends Error {
  readonly complete = false;
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode?: number,
    readonly reason: string | null = null,
    readonly nextEligibleAt: string | null = null
  ) { super(message); }
}

export type ProviderFetch = typeof fetch;

const forbiddenHostname = (hostname: string): boolean => {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host === '::1' || host === '0.0.0.0') return true;
  if (/^127\./.test(host) || /^169\.254\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true;
  const match = /^(\d{1,3})\.(\d{1,3})\./.exec(host);
  if (match && Number(match[1]) === 172 && Number(match[2]) >= 16 && Number(match[2]) <= 31) return true;
  return host.startsWith('fe8') || host.startsWith('fe9') || host.startsWith('fea') || host.startsWith('feb')
    || host.startsWith('fc') || host.startsWith('fd');
};

async function readBounded(response: Response, limit: number): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > limit) {
        await reader.cancel();
        throw new ProviderHttpError('response_too_large', 'Réponse fournisseur trop volumineuse.');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

export async function fetchProviderJson(input: {
  url: URL;
  allowedHosts: readonly string[];
  headers?: Readonly<Record<string,string>>;
  counter?: { increment(): void };
  fetchImpl?: ProviderFetch;
  allowTestHttp?: boolean;
  timeoutMs?: number;
  maxBytes?: number;
  gate?: ProviderRequestGate;
  signal?: AbortSignal;
}): Promise<JsonValue> {
  const { url } = input;
  const validProtocol = url.protocol === 'https:' || (input.allowTestHttp === true && url.protocol === 'http:');
  const allowedHosts = input.allowedHosts.map((host) => host.toLowerCase());
  if (!validProtocol || url.username || url.password || forbiddenHostname(url.hostname)
    || !allowedHosts.includes(url.hostname.toLowerCase())) {
    throw new ProviderHttpError('unsafe_endpoint','Endpoint fournisseur refusé.');
  }
  const authorization=await input.gate?.beforeRequest();
  if(authorization&&!authorization.allowed)throw new ProviderHttpError(
    authorization.reason==='request_budget_exhausted'?'request_budget_exhausted':authorization.reason==='request_cancelled'?'aborted':'quota_deferred',
    authorization.reason??'Appel fournisseur différé.',
    undefined,
    authorization.reason??null,
    authorization.nextEligibleAt??null
  );
  const chargeId=authorization?.chargeId;
  input.counter?.increment();
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  input.signal?.addEventListener('abort', abortFromCaller, { once: true });
  if (input.signal?.aborted) controller.abort();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 8_000);
  try {
    const response = await (input.fetchImpl ?? fetch)(url, { headers: input.headers, redirect:'error', signal:controller.signal });
    const declaredLength = Number(response.headers.get('content-length') ?? 0);
    const limit = input.maxBytes ?? 1_000_000;
    if (declaredLength > limit) throw new ProviderHttpError('response_too_large','Réponse fournisseur trop volumineuse.');
    const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
    if (response.ok && contentType && contentType !== 'application/json' && !/^application\/[a-z0-9.+-]+\+json$/.test(contentType)) {
      throw new ProviderHttpError('invalid_content_type','Réponse fournisseur non JSON.');
    }
    const bytes = await readBounded(response, limit);
    let value: unknown;
    try { value = JSON.parse(new TextDecoder().decode(bytes)); }
    catch { throw new ProviderHttpError('invalid_json','Réponse fournisseur invalide.'); }
    if(chargeId)await input.gate?.afterResponse(chargeId,{status:response.status,headers:Object.fromEntries(response.headers.entries())});
    if (!response.ok) throw new ProviderHttpError(`http_${response.status}`,`Le fournisseur a répondu HTTP ${response.status}.`,response.status);
    return value as JsonValue;
  } catch (error) {
    const normalized=error instanceof ProviderHttpError?error:(error as Error).name==='AbortError'?(input.signal?.aborted?new ProviderHttpError('aborted','Acquisition fournisseur interrompue.'):new ProviderHttpError('timeout','Délai fournisseur dépassé.')):new ProviderHttpError('network_error','Connexion au fournisseur impossible.');
    if(chargeId&&normalized.code!=='quota_deferred')await input.gate?.afterError(chargeId,normalized);
    throw normalized;
  } finally { clearTimeout(timeout); input.signal?.removeEventListener('abort', abortFromCaller); }
}
