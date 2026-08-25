import Fastify from 'fastify';
import { verifyApplicationSchema, pool } from './lib/db.js';
import { secureFastifyOptions } from './lib/httpSecurity.js';
import { ProviderSecretCipher } from './providers/providerSecrets.js';
import { ProviderConfigurationService } from './providers/providerService.js';
import { providerAdapterRegistry } from './providers/registry.js';
import { registerBuiltInAdapters } from './providers/realAdapters.js';
import { ProviderDiscoveryService } from './providers/discoveryService.js';
import { PersistentSchedulerService } from './providers/schedulerService.js';
import { QuotaCadenceService } from './providers/quotaCadenceService.js';
import { DiscoverySchedulerRuntime } from './providers/discoverySchedulerRuntime.js';

await verifyApplicationSchema();
registerBuiltInAdapters(providerAdapterRegistry);

const loggerHost = Fastify(secureFastifyOptions());
const providerService = new ProviderConfigurationService(
  providerAdapterRegistry,
  ProviderSecretCipher.fromEnvironment()
);
const schedulerService = new PersistentSchedulerService();
const discoveryService = new ProviderDiscoveryService(providerService, new QuotaCadenceService());
const pollSeconds = Math.min(30, Math.max(10, Number(process.env.SCHEDULER_POLL_SECONDS) || 15));
const runtime = new DiscoverySchedulerRuntime(
  schedulerService,
  discoveryService,
  loggerHost.log,
  pollSeconds * 1000
);

let stopping = false;
async function stop(signal: NodeJS.Signals): Promise<void> {
  if (stopping) return;
  stopping = true;
  try {
    loggerHost.log.info({ signal }, 'Provider worker stopping');
    await runtime.stop();
    await pool.end();
    loggerHost.log.info({ signal }, 'Provider worker stopped');
    await loggerHost.close();
    process.exit(0);
  } catch (error) {
    loggerHost.log.error({ signal, error }, 'Provider worker shutdown failed');
    process.exit(1);
  }
}

process.once('SIGTERM', () => void stop('SIGTERM'));
process.once('SIGINT', () => void stop('SIGINT'));

runtime.start();
loggerHost.log.info({ workerId: runtime.workerId }, 'Provider worker started');
