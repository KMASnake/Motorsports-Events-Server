import {
  assertProviderAdapterContract,
  type JsonObject,
  type ProviderAdapter
} from './contracts.js';

export type RegisteredProviderAdapter = ProviderAdapter<
  JsonObject,
  JsonObject,
  JsonObject,
  unknown,
  unknown
>;

export class ProviderAdapterRegistry {
  readonly #adapters = new Map<string, RegisteredProviderAdapter>();

  register(adapter: RegisteredProviderAdapter): void {
    assertProviderAdapterContract(adapter);
    if (this.#adapters.has(adapter.key)) {
      throw new Error(`Provider adapter already registered: ${adapter.key}`);
    }
    this.#adapters.set(adapter.key, adapter);
  }

  get(key: string): RegisteredProviderAdapter | undefined {
    return this.#adapters.get(key);
  }

  list(): readonly RegisteredProviderAdapter[] {
    return [...this.#adapters.values()].sort((left, right) => left.key.localeCompare(right.key));
  }
}

export const providerAdapterRegistry = new ProviderAdapterRegistry();
