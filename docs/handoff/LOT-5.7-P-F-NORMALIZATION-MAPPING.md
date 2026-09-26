# 5.7-P-F — Persisted normalization mappings

Migration `0030_lot57pf_normalization_mapping_persistence` stores bounded,
versioned normalization mapping documents owned by a provider/championship
association. A mapping version is an immutable semantic contract. Correcting a
mapping therefore creates a new version instead of changing an existing row.

The active pointer selects a mapping only for future traversals. A traversal's
immutable mapping binding is authoritative for deterministic replay, even when
another mapping version later becomes active. Existing traversals are not
backfilled and remain unbound.

Fixture mappings used by certification scripts are test data, not runtime
configuration. Migration 0030 creates no mapping, activates no provider and
does not change acquisition, publication or Preview state.
