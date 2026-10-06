import type { JsonValue, ProviderRequestGate } from './contracts.js';
import { failureClassification, normalizeRetryAfter, relevantProviderHeaders, transportFailure, type ProviderFailureClassification } from './providerFailure.js';

export class ProviderHttpError extends Error {
  readonly complete = false;
  readonly classification: ProviderFailureClassification;
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode?: number,
    readonly reason: string | null = null,
    readonly nextEligibleAt: string | null = null,
    context: Partial<ProviderFailureClassification> = {}
  ) { super(message); this.classification = failureClassification(code, {httpStatus:statusCode ?? null, ...context}); }
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
        await reader.cancel().catch(() => undefined);
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
  now?: () => Date;
}): Promise<JsonValue> {
  const { url } = input;
  const validProtocol = url.protocol === 'https:' || (input.allowTestHttp === true && url.protocol === 'http:');
  const allowedHosts = input.allowedHosts.map((host) => host.toLowerCase());
  if (!validProtocol || url.username || url.password || forbiddenHostname(url.hostname)
    || !allowedHosts.includes(url.hostname.toLowerCase())) {
    throw new ProviderHttpError('unsafe_endpoint','Endpoint fournisseur refusé.');
  }
  let context: Partial<ProviderFailureClassification> = {};
  const callbackError = (stage: string, accounting = input.gate?.failureDomain === 'accounting') => new ProviderHttpError(
    accounting ? 'internal_accounting_error' : 'internal_callback_error',
    'Callback fournisseur interne en échec.', context.httpStatus ?? undefined, null, null,
    {...context, callbackStage:stage}
  );
  if(input.signal?.aborted)throw new ProviderHttpError('aborted','Appel annulé avant émission.');
  let authorization: Awaited<ReturnType<ProviderRequestGate['beforeRequest']>> | undefined;
  try { authorization = await input.gate?.beforeRequest(); }
  catch { throw callbackError('beforeRequest'); }
  if(authorization&&!authorization.allowed)throw new ProviderHttpError(
    authorization.reason==='request_budget_exhausted'?'request_budget_exhausted':authorization.reason==='request_cancelled'?'aborted':'quota_deferred',
    authorization.reason??'Appel fournisseur différé.', undefined,
    authorization.reason??null, authorization.nextEligibleAt??null
  );
  const chargeId=authorization?.chargeId;
  if(input.signal?.aborted){if(chargeId)await input.gate?.cancelAuthorization?.(chargeId);throw new ProviderHttpError('aborted','Appel annulé avant émission.');}
  try { input.counter?.increment(); } catch { if(chargeId)await input.gate?.cancelAuthorization?.(chargeId);throw callbackError('requestCounter', false); }
  const controller = new AbortController();
  let timedOut = false;
  let outcomeAttempted = false;
  let readingBody = false;
  const abortFromCaller = () => controller.abort();
  input.signal?.addEventListener('abort', abortFromCaller, { once: true });
  if (input.signal?.aborted) controller.abort();
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, input.timeoutMs ?? 8_000);
  const afterResponse = async (response: Response) => {
    if (!chargeId || !input.gate) return;
    outcomeAttempted = true;
    try { await input.gate.afterResponse(chargeId, {status:response.status, headers:context.headers ?? {}}); }
    catch { throw callbackError('afterResponse'); }
  };
  try {
    const response = await (input.fetchImpl ?? fetch)(url, { headers: input.headers, redirect:'error', signal:controller.signal });
    const headers = relevantProviderHeaders(response.headers);
    context = {httpStatus:response.status, headers, providerResponseReceived:true};
    try { context = {...context, ...normalizeRetryAfter(headers['retry-after'], (input.now ?? (() => new Date()))())}; }
    catch { throw new ProviderHttpError('internal_error','Horloge de classification indisponible.',response.status); }
    // HTTP failures are authoritative; their bodies need neither buffering nor JSON decoding.
    if (!response.ok) {
      try { void response.body?.cancel().catch(() => undefined); } catch { /* Status remains authoritative. */ }
      await afterResponse(response);
      throw new ProviderHttpError(`http_${response.status}`,`Le fournisseur a répondu HTTP ${response.status}.`,response.status, null, null, context);
    }
    const declaredLength = Number(response.headers.get('content-length') ?? 0);
    const limit = input.maxBytes ?? 1_000_000;
    if (declaredLength > limit) throw new ProviderHttpError('response_too_large','Réponse fournisseur trop volumineuse.');
    const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
    if (contentType && contentType !== 'application/json' && !/^application\/[a-z0-9.+-]+\+json$/.test(contentType)) {
      throw new ProviderHttpError('invalid_content_type','Réponse fournisseur non JSON.');
    }
    readingBody = true;
    const bytes = await readBounded(response, limit);
    readingBody = false;
    let text: string;
    try { text = new TextDecoder('utf-8', {fatal:true}).decode(bytes); }
    catch { throw new ProviderHttpError('invalid_content_encoding','Encodage fournisseur invalide.'); }
    let value: unknown;
    try { value = JSON.parse(text); }
    catch { throw new ProviderHttpError('invalid_json','Réponse fournisseur invalide.'); }
    await afterResponse(response);
    return value as JsonValue;
  } catch (error) {
    const transport = error instanceof ProviderHttpError ? null : transportFailure(error, input.signal?.aborted === true, timedOut, readingBody);
    const normalized = error instanceof ProviderHttpError
      ? new ProviderHttpError(error.code, error.message, error.statusCode ?? context.httpStatus ?? undefined, error.reason, error.nextEligibleAt,
        {...error.classification, ...context, callbackStage:error.classification.callbackStage})
      : new ProviderHttpError(transport!.code, 'Transport fournisseur en échec.', context.httpStatus ?? undefined, null, null,
        {...context, category:transport!.category, transportCode:transport!.transportCode});
    if(chargeId && input.gate && !outcomeAttempted) {
      outcomeAttempted = true;
      try { await input.gate.afterError(chargeId, normalized); }
      catch { throw callbackError('afterError'); }
    }
    throw normalized;
  } finally { controller.abort(); clearTimeout(timeout); input.signal?.removeEventListener('abort', abortFromCaller); }
}
