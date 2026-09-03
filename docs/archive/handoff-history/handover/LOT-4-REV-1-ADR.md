# Décisions d'architecture — Événements

## ADR-001 — Calendrier comme vue principale

Statut : Accepté.

La page Événements est une interface de planification. Le calendrier est donc
la vue principale. La liste reste disponible pour les opérations de masse.

## ADR-002 — Source de données unique

Calendrier, liste et panneau de détail utilisent la même requête
d'administration et le même état client. Aucun tableau de données dupliqué.

## ADR-003 — API publique distincte

L'interface d'administration consomme `/api/v1/admin/events`.
Les clients consomment `/api/v1/events`.

## ADR-004 — Desktop uniquement

Résolution de référence : 1440×900.
Résolution minimale : 1280×720.
Pas de développement smartphone.

## ADR-005 — Maquette comme contrat

Toute divergence par rapport à `events-validated.png` doit être documentée et
approuvée.
