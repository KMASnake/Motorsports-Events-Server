import type { EventOrigin } from './eventTypes';

export interface ProviderIdentity {
  origin?: EventOrigin;
  provider_key?: string | null;
}

export interface ProviderOption {
  value: string;
  label: string;
}

const providerLabels: ReadonlyArray<ProviderOption> = [
  { value: 'ocblacktop', label: 'OC BlackTop' },
  { value: 'thesportsdb', label: 'TheSportsDB' },
  { value: 'motorsports-events', label: 'Motorsports Events' }
];

const normalizedKey = (providerKey: string | null | undefined) => providerKey?.trim().toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';

export function providerSource(origin: EventOrigin | undefined, providerKey: string | null | undefined): string {
  const normalized = normalizedKey(providerKey);
  if (normalized === 'ocblacktop') return 'ocblacktop';
  if (normalized === 'thesportsdb') return 'thesportsdb';
  if (origin === 'manual') return 'motorsports-events';
  if (!normalized) return 'provider-identity-missing';
  return `provider:${providerKey!.trim().toLowerCase()}`;
}

function readableProviderKey(providerKey: string) {
  return providerKey
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .map((word) => ['api','db','fia','f1'].includes(word.toLowerCase()) ? word.toUpperCase() : `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

export function providerLabel(origin: EventOrigin | undefined, providerKey: string | null | undefined) {
  if (origin !== undefined && origin !== 'manual' && !normalizedKey(providerKey)) return 'Identité fournisseur manquante';
  const source = providerSource(origin, providerKey);
  const known = providerLabels.find((option) => option.value === source);
  return known?.label ?? readableProviderKey(providerKey?.trim() || 'Motorsports Events');
}

export function availableProviderOptions(identities: ProviderIdentity[]): ProviderOption[] {
  const present = new Map<string, string>();
  for (const identity of identities) {
    const value = providerSource(identity.origin, identity.provider_key);
    present.set(value, providerLabel(identity.origin, identity.provider_key));
  }
  return [...present].map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label, 'fr'));
}
