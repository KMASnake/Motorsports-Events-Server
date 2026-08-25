import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (relativePath: string) => readFileSync(
  new URL(`../../../${relativePath}`, import.meta.url),
  'utf8'
);

describe('provider runtime isolation', () => {
  it('keeps the HTTP API process free of the provider scheduler runtime', () => {
    const server = source('apps/api/src/server.ts');
    expect(server).not.toContain('DiscoverySchedulerRuntime');
    expect(server).not.toContain('discoveryRuntime.start()');
  });

  it('starts and gracefully stops the runtime from the dedicated worker entrypoint', () => {
    const worker = source('apps/api/src/worker.ts');
    expect(worker).toContain('new DiscoverySchedulerRuntime');
    expect(worker).toContain('runtime.start()');
    expect(worker).toContain('await runtime.stop()');
    expect(worker).toContain("process.once('SIGTERM'");
    expect(worker).toContain("process.once('SIGINT'");
    expect(worker).toContain('process.exit(0)');
  });

  it('defines a separate worker service without Preview or HTTP credentials', () => {
    const compose = source('docker-compose.yml');
    const worker = compose.slice(compose.indexOf('\n  worker:'), compose.indexOf('\n  migrate:'));
    expect(worker).toContain('apps/api/dist/worker.js');
    expect(worker).toContain('PROVIDER_MASTER_KEYS');
    expect(worker).not.toContain('PREVIEW_API_ENABLED');
    expect(worker).not.toContain('ADMIN_SESSION_SECRET');
    expect(worker).not.toContain('ports:');
  });
});
