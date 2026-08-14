# Lot 5.6-A — Validation des fondations de persistance

Date : 2026-08-15  
Statut : **IMPLÉMENTÉ — EN ATTENTE DE VALIDATION MAINTENEUR**

## Périmètre livré

- migration additive et versionnée `0016_lot56_durable_acquisition` ;
- état d'acquisition 5.6 séparé des curseurs 5.4 ;
- entités source courantes uniques et rejouables ;
- traversals et observations de complétude ;
- journal fonctionnel des changements ;
- anomalies agrégées ;
- paramètres current-hot, finalization et deep history ;
- sanitization récursive et taille source limitée à 256 Kio ;
- refus des URL credentialisées ;
- `down.sql` destructif refusé par défaut dès que des données 5.6 existent.

## Portée du down.sql

Le fichier descendant existe exclusivement pour une base jetable de test ou de
développement. Il ne constitue pas un rollback opérationnel sûr. Après
acquisition, son exécution détruit les données source, observations, journaux et
anomalies 5.6 ; cette opération est donc bloquée par défaut.

## Preuves exécutées

- syntaxe shell : PASS ;
- typecheck API : PASS ;
- tests unitaires sanitization : 3/3 PASS ;
- PostgreSQL réel : migration 0016 PASS ;
- date 1950 avec conversion UTC : PASS ;
- unicité de l'identité source : PASS ;
- down destructif avec données : refusé, PASS ;
- cycle up/down/up sur base jetable : PASS.

## Acceptance couverte à ce stade

Fondations de AC-5.6-010 à 013, 023, 041, 070, 080 à 083, 092, 100 à 102,
120 à 123 et 151 à 155. Les comportements d'acquisition correspondants restent
à prouver dans les sous-lots suivants.

## Gate

STOP avant 5.6-B. Le Lot 5.6 reste non validé, non clôturé et non fusionnable.
Les Lots 5.7+ restent non autorisés.

