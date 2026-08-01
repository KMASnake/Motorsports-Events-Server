# Indexation v6.1

- `championships(discipline_id, status)`
- `categories(championship_id, status, display_order)`
- `seasons(championship_id, category_id, year)`
- index unique direct : `seasons(championship_id, label) WHERE category_id IS NULL`
- index unique catégorisé : `seasons(championship_id, category_id, label) WHERE category_id IS NOT NULL`
- `events(season_id, event_number)` et `events(starts_at)`
- `sessions(event_id, starts_at)` et `sessions(starts_at, status)`
- `provider_mappings(provider_id, entity_type, external_id)` unique.
