# Mapping des données

- `championship.discipline` libre → `disciplines.id` contrôlé ;
- championnats existants → `championships.discipline_id` ;
- saisons existantes → `category_id = NULL` ;
- anciennes divisions explicitement connues → catégories après revue humaine ;
- `rounds` → `events` ; `sessions.round_id` → `sessions.event_id` ;
- données locales sans fournisseur → `origin = manual` ;
- données importées → `origin = provider`, puis `mixed` après contribution manuelle.
