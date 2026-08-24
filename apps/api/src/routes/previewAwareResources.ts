import type { FastifyInstance } from 'fastify';
import type { PreviewClientSecurityService } from '../preview/clientSecurity.js';
import type { PreviewRepository } from '../preview/repository.js';
import { championshipRoutes } from './championships.js';
import { eventRoutes } from './events.js';
import { previewClientAdminRoutes, previewSecurityRoutes } from './previewSecurity.js';

export interface PreviewAwareResourceOptions {
  previewEnabled: boolean;
  security?: PreviewClientSecurityService;
  cursorSecret?: string;
  repository?: PreviewRepository;
  now?: () => Date;
}

export async function previewAwareResourceRoutes(
  app: FastifyInstance,
  options: PreviewAwareResourceOptions
): Promise<void> {
  await app.register(championshipRoutes, { includePublic: !options.previewEnabled });
  await app.register(eventRoutes, { includePublic: !options.previewEnabled });

  if (!options.previewEnabled) return;
  if (!options.security || !options.cursorSecret) {
    throw new Error('Preview security and cursor secret are required when Preview API is enabled.');
  }

  await app.register(previewClientAdminRoutes, { security: options.security });
  await app.register(previewSecurityRoutes, {
    security: options.security,
    cursorSecret: options.cursorSecret,
    repository: options.repository,
    now: options.now
  });
}
