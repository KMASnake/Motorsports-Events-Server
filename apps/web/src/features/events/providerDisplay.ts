import type { EventOrigin } from './eventTypes';

export type ProviderSource = 'ocblacktop' | 'thesportsdb' | 'motorsports-events';

export const providerOptions: ReadonlyArray<{ value: ProviderSource; label: string }> = [
  { value: 'ocblacktop', label: 'OC BlackTop' },
  { value: 'thesportsdb', label: 'TheSportsDB' },
  { value: 'motorsports-events', label: 'Motorsports Events' }
];

export function providerSource(origin: EventOrigin | undefined, providerKey: string | null | undefined): ProviderSource {
  const normalized = providerKey?.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalized === 'ocblacktop') return 'ocblacktop';
  if (normalized === 'thesportsdb') return 'thesportsdb';
  if (origin === 'manual' || !normalized) return 'motorsports-events';
  return 'motorsports-events';
}

export function providerLabel(origin: EventOrigin | undefined, providerKey: string | null | undefined) {
  const source = providerSource(origin, providerKey);
  return providerOptions.find((option) => option.value === source)?.label ?? 'Motorsports Events';
}
