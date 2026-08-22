# ADR-0021 — État de publication durable interne 5.7-P-C

Date : 2026-08-22  
Statut : accepté, implémentation validée par le mainteneur le 2026-08-22

## Décision

Le candidat normalisé fiable est promu vers `public_resource_states` dans la
même transaction que sa révision et `public_change_log`. La séquence est
allouée par PostgreSQL et n’est jamais remise à zéro. Un checksum de la
représentation publique canonique rend les changements internes idempotents.

Un candidat `review_required` ou `blocked` ne crée pas de première publication
et ne remplace jamais le last-known-good. Une annulation est une mise à jour ;
une suppression qualifiée crée un tombstone permanent conservant l’UUID. Le
kill switch arrête uniquement les promotions et conserve l’état fiable.

Les rebuilds rejouent les candidats durables en ordre stable, sans réinitialiser
UUID, tombstones ou séquences. L’état produit par C reste strictement interne.
Aucune route Preview ni sécurité client n’appartient à cette décision.

## Conséquences

- migration additive 0025 avec DOWN peuplé refusé par défaut ;
- verrou transactionnel par ressource, reçus idempotents et fencing réutilisé ;
- 5.7-P-D à F, le Lot 5.7 complet, 5.8+ et merge `main` restent non autorisés.
