export type EventSource = { origin: 'manual'|'provider'|'mixed'; provider_key?: string|null; external_id?: string|null };
export function isProviderEvent(event: EventSource){return event.origin!=='manual' && Boolean(event.provider_key || event.external_id)}
export function shouldCreateCorrection(event: EventSource, providerValue: unknown, localValue: unknown){return isProviderEvent(event) && JSON.stringify(providerValue)!==JSON.stringify(localValue)}
export function effectiveValue<T>(providerValue:T, overrideValue:T|undefined){return overrideValue===undefined?providerValue:overrideValue}
export function providerConflict(previousProvider:unknown,nextProvider:unknown,overrideValue:unknown){return overrideValue!==undefined&&JSON.stringify(previousProvider)!==JSON.stringify(nextProvider)}
