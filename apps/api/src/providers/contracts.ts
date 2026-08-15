export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;
export type JsonObject = { readonly [key: string]: JsonValue };

export type ProviderFieldType = 'text' | 'url' | 'integer' | 'boolean' | 'select' | 'secret';

export interface ProviderFieldSchema {
  readonly key: string;
  readonly label: string;
  readonly type: ProviderFieldType;
  readonly required: boolean;
  readonly secret?: boolean;
  readonly options?: readonly { readonly value: string; readonly label: string }[];
  readonly help?: string;
}

export interface ProviderAdapterCapabilities {
  readonly supportsChampionshipDiscovery: boolean;
  readonly supportsSeasonDiscovery: boolean;
  readonly supportsQuotaHeaders: boolean;
  readonly supportsConnectionTest: boolean;
}

export interface ProviderAdapterContext<ProviderConfig extends JsonObject> {
  readonly providerInstanceId: string;
  readonly providerConfig: ProviderConfig;
  /** Credentials are supplied by the future secret service, never by source configuration. */
  readonly credentials: Readonly<Record<string, string>>;
  /** Incremented by the adapter after every actual HTTP request. */
  readonly requestCounter?: { increment(): void; readonly value: number };
  readonly requestGate?: ProviderRequestGate;
}

export interface ProviderRequestGate {
  beforeRequest(): Promise<{ allowed: boolean; chargeId?: string; nextEligibleAt?: string | null; reason?: string | null }>;
  afterResponse(chargeId: string, response: ProviderResponseMetadata): Promise<void>;
  afterError(chargeId: string, error: { code: string; statusCode?: number }): Promise<void>;
}

export interface ProviderStreamContext<
  ProviderConfig extends JsonObject,
  SourceConfig extends JsonObject
> extends ProviderAdapterContext<ProviderConfig> {
  readonly providerChampionshipId: string;
  readonly championshipId: string;
  readonly sourceConfig: SourceConfig;
}

export interface ConnectionResult {
  readonly ok: boolean;
  readonly message: string;
  readonly checkedAt: string;
}

export interface DiscoveredChampionship<SourceConfig extends JsonObject> {
  readonly externalChampionshipId: string;
  readonly name: string;
  readonly sourceConfig: SourceConfig;
  readonly metadata?: JsonObject;
}

export interface ChampionshipDiscoveryResult<SourceConfig extends JsonObject> {
  readonly items: readonly DiscoveredChampionship<SourceConfig>[];
  /** True only when the provider or adapter can prove the returned catalog exhaustive. */
  readonly complete: boolean;
  readonly provenance: 'provider-discovered' | 'adapter-known-catalog';
}

export interface SeasonDiscoveryResult {
  readonly seasons: readonly number[];
  readonly complete: boolean;
}

export interface WorkSelection<SourceConfig extends JsonObject> {
  readonly phase: 'current' | 'historical';
  readonly season: number;
  readonly sourceConfig: SourceConfig;
}

export interface FetchWorkUnitInput<
  ProviderConfig extends JsonObject,
  SourceConfig extends JsonObject,
  Cursor extends JsonObject
> extends ProviderStreamContext<ProviderConfig, SourceConfig> {
  readonly phase: 'current' | 'historical';
  readonly season: number;
  readonly cursor: Cursor;
  readonly signal: AbortSignal;
}

export type FetchWorkUnitStatus = 'progress' | 'complete' | 'cursor_invalid';

export type ProviderSourceEntityKind = 'meeting' | 'event' | 'session';

export interface AcquiredProviderSourceItem {
  readonly entityKind: ProviderSourceEntityKind;
  readonly externalId: string;
  readonly identityIsSynthetic: boolean;
  readonly parentExternalId: string | null;
  readonly parentEntityKind: ProviderSourceEntityKind | null;
  readonly season: number;
  readonly sourceData: JsonObject;
}

export interface ProviderItemAnomaly {
  readonly scope: 'item';
  readonly index: number;
  readonly code: string;
  readonly message: string;
  readonly externalId: string | null;
}

export interface ProviderBlockingAnomaly {
  readonly scope: 'stream';
  readonly code: string;
  readonly message: string;
}

export interface SafeAcquisitionRestart {
  readonly scope: 'season';
  readonly season: number;
}

export interface FetchWorkUnitResult<Raw, Cursor extends JsonObject> {
  readonly status: FetchWorkUnitStatus;
  readonly items: readonly Raw[];
  readonly itemAnomalies: readonly ProviderItemAnomaly[];
  readonly nextCursor: Cursor;
  readonly requestCount: number;
  /** True only when the adapter has certain provider-side termination evidence. */
  readonly complete: boolean;
  readonly completionReason: 'end_of_collection' | 'explicit_empty_scope' | null;
  readonly safeRestart?: SafeAcquisitionRestart;
}

export class ProviderAcquisitionError extends Error {
  readonly complete = false;
  readonly anomaly: ProviderBlockingAnomaly;
  constructor(code: string, message: string) {
    super(message);
    this.anomaly = { scope: 'stream', code, message };
  }
}

export interface ProviderResponseMetadata {
  readonly status: number;
  readonly headers: Readonly<Record<string, string | undefined>>;
}

export interface QuotaObservation {
  readonly windowKind: 'minute' | 'hour' | 'day' | 'month';
  readonly limit: number | null;
  readonly remaining: number | null;
  readonly resetsAt: string | null;
  readonly reliable: boolean;
}

export interface NormalizationContext {
  readonly providerInstanceId: string;
  readonly providerChampionshipId: string;
  readonly championshipId: string;
}

export interface NormalizedProviderEvent {
  readonly externalId: string | null;
  readonly name: string;
  readonly sessionTitle: string | null;
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly status: 'draft' | 'scheduled' | 'completed' | 'cancelled' | 'postponed';
  readonly published: boolean;
  readonly description: string | null;
  readonly normalizedProviderHash: string;
}

export interface NormalizationResult<Normalized> {
  readonly accepted: readonly Normalized[];
  readonly rejected: readonly { readonly reason: string }[];
}

export interface EmptySeasonEvidence<Cursor extends JsonObject> {
  readonly season: number;
  readonly cursor: Cursor;
  readonly completedTraversal: boolean;
  readonly receivedSuccessfulResponses: number;
  readonly receivedItems: number;
}

export interface EmptySeasonDecision {
  readonly confirmedEmpty: boolean;
  readonly reason: string;
}

export interface ProviderAdapter<
  ProviderConfig extends JsonObject,
  SourceConfig extends JsonObject,
  Cursor extends JsonObject,
  Raw,
  Normalized = NormalizedProviderEvent
> {
  readonly key: string;
  readonly capabilities: ProviderAdapterCapabilities;
  readonly providerConfigVersion: number;
  readonly sourceConfigVersion: number;
  readonly cursorVersion: number;

  providerForm(): readonly ProviderFieldSchema[];
  championshipForm(context: { readonly providerConfig: ProviderConfig }): readonly ProviderFieldSchema[];
  validateProviderConfig(value: unknown): ProviderConfig;
  validateSourceConfig(value: unknown, context: { readonly providerConfig: ProviderConfig }): SourceConfig;

  testConnection?(context: ProviderAdapterContext<ProviderConfig>): Promise<ConnectionResult>;
  discoverChampionships?(
    context: ProviderAdapterContext<ProviderConfig>
  ): Promise<ChampionshipDiscoveryResult<SourceConfig>>;
  discoverSeasons?(
    context: ProviderStreamContext<ProviderConfig, SourceConfig>
  ): Promise<SeasonDiscoveryResult>;

  initialCursor(selection: WorkSelection<SourceConfig>): Cursor;
  validateCursor(value: unknown): Cursor;
  serializeCursor(cursor: Cursor): JsonObject;
  restoreCursor(value: unknown, version: number): Cursor;
  fetchWorkUnit(
    input: FetchWorkUnitInput<ProviderConfig, SourceConfig, Cursor>
  ): Promise<FetchWorkUnitResult<Raw, Cursor>>;

  observeQuota?(response: ProviderResponseMetadata): QuotaObservation | readonly QuotaObservation[] | null;
  normalize(raw: Raw, context: NormalizationContext): NormalizationResult<Normalized>;
  confirmEmptySeason(evidence: EmptySeasonEvidence<Cursor>): Promise<EmptySeasonDecision>;
}

/**
 * A source configuration describes how an adapter addresses one championship.
 * Its URL-like values are data only: validating this object never authorizes or
 * performs an HTTP request. Runtime SSRF controls belong to a later sub-lot.
 */
export function assertProviderAdapterContract(
  adapter: ProviderAdapter<JsonObject, JsonObject, JsonObject, unknown, unknown>
): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(adapter.key)) {
    throw new Error('Provider adapter key must be a non-empty kebab-case identifier.');
  }
  for (const [name, version] of [
    ['provider config', adapter.providerConfigVersion],
    ['source config', adapter.sourceConfigVersion],
    ['cursor', adapter.cursorVersion]
  ] as const) {
    if (!Number.isSafeInteger(version) || version < 1) {
      throw new Error(`${name} version must be a positive integer.`);
    }
  }

  const capabilityMethods = [
    ['supportsChampionshipDiscovery', adapter.discoverChampionships],
    ['supportsSeasonDiscovery', adapter.discoverSeasons],
    ['supportsQuotaHeaders', adapter.observeQuota],
    ['supportsConnectionTest', adapter.testConnection]
  ] as const;
  for (const [capability, method] of capabilityMethods) {
    if (adapter.capabilities[capability] !== (typeof method === 'function')) {
      throw new Error(`Capability ${capability} does not match its adapter method.`);
    }
  }

}

export function assertChampionshipSourceFields(fields: readonly ProviderFieldSchema[]): void {
  if (fields.some((field) => field.type === 'secret' || field.secret)) {
    throw new Error('Championship source configuration must not contain credentials.');
  }
}
