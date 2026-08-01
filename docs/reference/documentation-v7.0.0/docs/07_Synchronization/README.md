# Moteur de synchronisation — v5.4

Le moteur importe les données de fournisseurs externes, les valide, les
normalise, les rapproche des objets canoniques et publie les changements
retenus.

## Principes
- Idempotence.
- Traçabilité complète.
- Conservation des données brutes.
- Reprise après incident.
- Isolation par fournisseur.
- Corrections manuelles prioritaires.
- Aucun nom de fournisseur dans les descriptions publiques.
