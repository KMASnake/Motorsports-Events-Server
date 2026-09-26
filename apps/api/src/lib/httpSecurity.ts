import type { FastifyInstance, FastifyServerOptions } from 'fastify';

export const DEFAULT_BODY_LIMIT = 1_048_576;

export function trustedProxyConfiguration(value = process.env.TRUST_PROXY_CIDRS): false | string[] {
  if (!value?.trim()) return false;
  const entries = value.split(',').map((entry) => entry.trim()).filter(Boolean);
  if (!entries.length || entries.some((entry) => entry === '*' || entry.toLowerCase() === 'true')) {
    throw new Error('TRUST_PROXY_CIDRS doit contenir uniquement des adresses ou CIDR explicites.');
  }
  return entries;
}

export function secureFastifyOptions(env: NodeJS.ProcessEnv = process.env): FastifyServerOptions {
  return {
    bodyLimit: DEFAULT_BODY_LIMIT,
    trustProxy: trustedProxyConfiguration(env.TRUST_PROXY_CIDRS),
    logger: {
      redact: {
        paths: [
          'req.headers.authorization', 'req.headers.cookie', 'req.headers.x-api-key',
          'res.headers.set-cookie', 'headers.authorization', 'headers.cookie',
          'headers.x-api-key', 'body.password', '*.password', '*.secret', '*.token',
          '*.api_key', '*.api-key', '*.master_key'
        ],
        censor: '[REDACTED]'
      }
    }
  };
}

export function registerSecurityHeaders(app: FastifyInstance, production = process.env.NODE_ENV === 'production'): void {
  app.addHook('onSend', async (_request, reply) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('referrer-policy', 'no-referrer');
    reply.header('x-frame-options', 'DENY');
    reply.header('content-security-policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    reply.header('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    if (production) reply.header('strict-transport-security', 'max-age=31536000; includeSubDomains');
  });
}
