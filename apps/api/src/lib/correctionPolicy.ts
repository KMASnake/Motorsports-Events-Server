export type EventSource = { origin: 'manual'|'provider'|'mixed'; provider_key?: string|null; external_id?: string|null };
export function isProviderEvent(event: EventSource){return event.origin!=='manual' && Boolean(event.provider_key || event.external_id)}
export function shouldCreateCorrection(event: EventSource, providerValue: unknown, localValue: unknown){return isProviderEvent(event) && JSON.stringify(providerValue)!==JSON.stringify(localValue)}
export function effectiveValue<T>(providerValue:T, overrideValue:T|undefined){return overrideValue===undefined?providerValue:overrideValue}
export function providerConflict(previousProvider:unknown,nextProvider:unknown,overrideValue:unknown){return overrideValue!==undefined&&JSON.stringify(previousProvider)!==JSON.stringify(nextProvider)}

export function normalizeCorrectionValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value === undefined ? null : value;
}

export function sameCorrectionValue(first: unknown, second: unknown): boolean {
  return JSON.stringify(normalizeCorrectionValue(first)) === JSON.stringify(normalizeCorrectionValue(second));
}

export type LocalOverrideDecision =
  | { action: 'none' }
  | { action: 'remove' }
  | { action: 'create' | 'update'; providerValue: unknown; overrideValue: unknown; keepConflict: boolean };

export function decideLocalOverride(
  source: EventSource,
  currentEffectiveValue: unknown,
  requestedValue: unknown,
  existing?: { provider_value: unknown; status: 'active' | 'conflict' }
): LocalOverrideDecision {
  if (!isProviderEvent(source)) return { action: 'none' };
  const next = normalizeCorrectionValue(requestedValue);
  if (existing) {
    if (sameCorrectionValue(existing.provider_value, next)) return { action: 'remove' };
    return {
      action: 'update',
      providerValue: normalizeCorrectionValue(existing.provider_value),
      overrideValue: next,
      keepConflict: existing.status === 'conflict'
    };
  }
  const providerValue = normalizeCorrectionValue(currentEffectiveValue);
  if (sameCorrectionValue(providerValue, next)) return { action: 'none' };
  return { action: 'create', providerValue, overrideValue: next, keepConflict: false };
}

export type ProviderSyncDecision = {
  effectiveValue: unknown;
  correctionAction: 'none' | 'update' | 'remove';
  conflict: boolean;
};

export function decideProviderSync(
  nextProviderValue: unknown,
  existing?: { provider_value: unknown; override_value: unknown; status: 'active' | 'conflict' }
): ProviderSyncDecision {
  const next = normalizeCorrectionValue(nextProviderValue);
  if (!existing) return { effectiveValue: next, correctionAction: 'none', conflict: false };
  if (sameCorrectionValue(existing.override_value, next)) {
    return { effectiveValue: next, correctionAction: 'remove', conflict: false };
  }
  return {
    effectiveValue: normalizeCorrectionValue(existing.override_value),
    correctionAction: 'update',
    conflict: existing.status === 'conflict' || !sameCorrectionValue(existing.provider_value, next)
  };
}
