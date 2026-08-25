import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { catalogRoutes } from './routes/catalog.js';
import { correctionRoutes } from './routes/corrections.js';
import { verifyApplicationSchema } from './lib/db.js';
import { registerAdminAuth } from './lib/adminAuth.js';
import { registerAdminAudit } from './lib/adminAudit.js';
import { auditRoutes } from './routes/audit.js';
import { sessionRoutes } from './routes/sessions.js';
import { sessionCorrectionRoutes } from './routes/sessionCorrections.js';
import { authRoutes } from './routes/auth.js';
import { adminCookieConfig } from './lib/adminCookies.js';
import { providerRoutes } from './routes/providers.js';
import { ProviderSecretCipher } from './providers/providerSecrets.js';
import { ProviderConfigurationService } from './providers/providerService.js';
import { providerAdapterRegistry } from './providers/registry.js';
import { registerBuiltInAdapters } from './providers/realAdapters.js';
import { ProviderDiscoveryService } from './providers/discoveryService.js';
import { providerDiscoveryRoutes } from './routes/providerDiscovery.js';
import { ManualChampionshipSourceService } from './providers/manualSourceService.js';
import { providerManualSourceRoutes } from './routes/providerManualSources.js';
import { PersistentSchedulerService } from './providers/schedulerService.js';
import { providerSchedulerRoutes } from './routes/providerScheduler.js';
import { registerSecurityHeaders, secureFastifyOptions } from './lib/httpSecurity.js';
import { registerUuidParamValidation } from './lib/routeParams.js';
import { QuotaCadenceService } from './providers/quotaCadenceService.js';
import { AcquisitionAdminService } from './providers/acquisitionAdminService.js';
import { SourceProtectionService } from './providers/sourceProtectionService.js';
import { providerAcquisitionAdminRoutes } from './routes/providerAcquisitionAdmin.js';
import { PreviewClientSecurityService } from './preview/clientSecurity.js';
import { previewAwareResourceRoutes } from './routes/previewAwareResources.js';
import { registerRuntimeMetrics } from './lib/runtimeMetrics.js';

const app = Fastify(secureFastifyOptions());
registerSecurityHeaders(app);
registerUuidParamValidation(app);
await registerRuntimeMetrics(app);
await verifyApplicationSchema();
const webOrigin = process.env.ADMIN_WEB_ORIGIN ?? 'http://localhost:3000';
const sessionSecret = process.env.ADMIN_SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 32) throw new Error('ADMIN_SESSION_SECRET doit contenir au moins 32 caractères.');
const cookie = adminCookieConfig();
await app.register(cors, { origin: webOrigin, credentials: true });
registerAdminAuth(app, process.env.ADMIN_AUTH_SECRET, { cookie, sessionSecret, webOrigin });
registerAdminAudit(app);

app.addHook('onRequest', async (request) => {
  const methodHasNoExpectedBody =
    request.method === 'DELETE' || request.method === 'GET' || request.method === 'HEAD';

  const contentLength = request.headers['content-length'];
  const transferEncoding = request.headers['transfer-encoding'];
  const hasNoBody =
    (contentLength === undefined || contentLength === '0') &&
    transferEncoding === undefined;

  if (methodHasNoExpectedBody && hasNoBody) {
    delete request.headers['content-type'];
  }
});

await app.register(healthRoutes);
await app.register(authRoutes, { cookie, sessionSecret, webOrigin });
await app.register(dashboardRoutes);
await app.register(catalogRoutes);
const previewEnabled = process.env.PREVIEW_API_ENABLED === 'true';
const previewSecurity = previewEnabled
  ? new PreviewClientSecurityService(process.env.PREVIEW_API_KEY_PEPPER ?? '')
  : undefined;
await app.register(previewAwareResourceRoutes, {
  previewEnabled,
  security: previewSecurity,
  cursorSecret: process.env.PREVIEW_CURSOR_SECRET
});
await app.register(correctionRoutes);
await app.register(auditRoutes);
await app.register(sessionRoutes);
await app.register(sessionCorrectionRoutes);
registerBuiltInAdapters(providerAdapterRegistry);
const providerService=new ProviderConfigurationService(providerAdapterRegistry,ProviderSecretCipher.fromEnvironment());
const quotaService=new QuotaCadenceService();
await app.register(providerRoutes,{service:providerService,quota:quotaService});
const discoveryService=new ProviderDiscoveryService(providerService,quotaService);
await app.register(providerDiscoveryRoutes,{service:discoveryService});
await app.register(providerManualSourceRoutes,{service:new ManualChampionshipSourceService(providerService)});
const schedulerService=new PersistentSchedulerService();
await app.register(providerSchedulerRoutes,{service:schedulerService});
await app.register(providerAcquisitionAdminRoutes,{admin:new AcquisitionAdminService(),protection:new SourceProtectionService(),scheduler:schedulerService});
const port = Number(process.env.API_PORT ?? 3001);
const host = '0.0.0.0';

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
