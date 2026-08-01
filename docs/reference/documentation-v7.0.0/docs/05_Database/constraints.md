# Contraintes v6.1

- `championships.discipline_id` est NOT NULL.
- `categories.championship_id` est NOT NULL.
- `seasons.championship_id` est NOT NULL.
- `seasons.category_id` est NULLABLE.
- une clé étrangère composite garantit que `(category_id, championship_id)` correspond à une catégorie du même championnat.
- unicité des codes : discipline globale, championnat global, catégorie dans son championnat.
- unicité saison : `(championship_id, category_id nullable, label)` via deux index partiels PostgreSQL.
- les suppressions métier sont logiques.
