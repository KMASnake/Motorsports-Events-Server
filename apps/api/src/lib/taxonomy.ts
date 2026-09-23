import { z } from 'zod';

export const canonicalTaxonomyKey = z.string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/);

export const INITIAL_SESSION_TYPE_KEYS = [
  'practice',
  'practice_1',
  'practice_2',
  'practice_3',
  'qualifying',
  'sprint_qualifying',
  'sprint',
  'warmup',
  'race',
  'test',
  'stage',
  'special_stage',
  'other'
] as const;
