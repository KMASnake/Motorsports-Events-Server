# Lot 5.6 — Plan d'implémentation approuvé

Date : 2026-08-15  
Statut : **APPROUVÉ POUR 5.6-A À 5.6-I — GATE MAINTENEUR ENTRE SOUS-LOTS**

## Découpage

1. 5.6-A — persistance et contrats source ;
2. 5.6-B — acquisition adaptateur sécurisée ;
3. 5.6-C — transaction d'unité ;
4. 5.6-D — orchestration durable ;
5. 5.6-E — temporalité et finalization ;
6. 5.6-F — protection des corrections et observations ;
7. 5.6-G — API et actions ACP ;
8. 5.6-H — interface ACP ;
9. 5.6-I — recette complète, audit et passation.

## Précisions mainteneur obligatoires

- Le `down.sql` 0016 est réservé aux bases jetables de développement/test. Il
  n'est pas un rollback opérationnel sûr après acquisition. Toute suppression
  de données 5.6 doit être signalée explicitement et refusée par défaut.
- Toute donnée fournisseur est sanitizée avant persistance. Les credentials,
  Authorization, clés API, cookies, tokens, headers sensibles et URL
  credentialisées sont interdits. Les tailles persistées sont bornées.
- Les contrats 5.4 de `sync_streams.cursor` et `historical_state` sont
  immuables. L'état additionnel 5.6 utilise des extensions dédiées lorsqu'il ne
  peut pas être représenté sans changement sémantique.
- Les preuves sont proportionnées à chaque sous-lot. Chromium n'est obligatoire
  qu'après un changement UI et dans la recette globale 5.6.
- Codex ne peut jamais positionner `maintainer_validated=true`, autoriser une
  fusion, autoriser 5.7+, clôturer 5.6 ou fusionner dans `main`.

Après chaque sous-lot, l'implémentation s'arrête en attente de la décision du
mainteneur.

