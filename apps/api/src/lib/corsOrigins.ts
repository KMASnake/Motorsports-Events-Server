export function corsAllowedOrigins(
  environment: NodeJS.ProcessEnv = process.env
): string[] {
  const configured = environment.CORS_ALLOWED_ORIGINS?.split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  if (configured?.length) return [...new Set(configured)];

  if (environment.ADMIN_WEB_ORIGIN) {
    return [environment.ADMIN_WEB_ORIGIN.trim().replace(/\/+$/, '')];
  }

  return ['http://localhost:3000', 'http://127.0.0.1:3000'];
}
