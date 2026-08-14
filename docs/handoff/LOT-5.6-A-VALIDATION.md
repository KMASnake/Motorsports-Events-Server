# Lot 5.6-A — Validation des fondations de persistance

Date : 2026-08-15  
Statut : **CORRIGÉ APRÈS AUDIT — EN ATTENTE DE RÉ-AUDIT MAINTENEUR**

## Périmètre livré

- migration additive et versionnée `0016_lot56_durable_acquisition` ;
- état d'acquisition 5.6 séparé des curseurs 5.4 ;
- entités source courantes uniques et rejouables ;
- traversals et observations de complétude ;
- journal fonctionnel des changements ;
- anomalies agrégées ;
- cycles illimités résolution/réapparition avec une seule occurrence active ;
- présence et non-observation durable, cette dernière uniquement après un
  traversal complet ;
- cohérence relationnelle fournisseur/championnat et parent/enfant ;
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
- tests unitaires sanitization : 6/6 PASS ;
- PostgreSQL réel : migration 0016 PASS ;
- dates 1950, 1969 et 1900 avec conversion UTC : PASS ;
- unicité réelle de l'identité source : PASS ;
- incohérence fournisseur/championnat : refusée ;
- parent hors périmètre : refusé ;
- deux cycles anomalie complets puis réapparition : PASS ;
- présence durable : PASS ;
- non-observation après traversal complet : PASS ;
- non-observation après traversal partiel : refusée ;
- traversal incomplet évoluant vers complet : PASS ;
- régression complet vers partiel : refusée et preuve de non-observation
  préservée ;
- secrets camelCase/snake_case/kebab-case : supprimés ;
- URL user/password et query-string credentialisée : refusées ;
- down destructif avec données : refusé, PASS ;
- cycle up/down/up sur base jetable : PASS.

## Acceptance couverte à ce stade

Fondations relationnelles réellement prouvées de AC-5.6-010 à 013, 023, 041,
070, 080 à 083, 092, 100 à 102, 120 à 123, 151, 153, 155 et 161. Les
comportements d'acquisition correspondants restent à prouver dans les sous-lots
suivants.

## Gate

STOP avant 5.6-B. Le Lot 5.6 reste non validé, non clôturé et non fusionnable.
Les Lots 5.7+ restent non autorisés.
