# Lot 5.6-D — Orchestration durable

Date : 2026-08-15  
Statut : **CORRIGÉ — RÉ-AUDIT MAINTENEUR REQUIS**

## Périmètre livré

- current couvre `current_hot` puis `current_future` jusqu’à la terminaison
  explicite du fournisseur ; J+30 ne constitue qu’une fenêtre de priorité ;
- bootstrap durable : current, recent catchup, puis deep history ; current reste
  éligible pendant l’historique selon l’équité du scheduler 5.4 ;
- l’historique progresse saison par saison et s’arrête après cinq saisons vides
  complètes consécutives par défaut, ou à la borne configurée ;
- 429, timeout, erreur, traversal partiel et curseur invalide ne comptent jamais
  comme saison vide ;
- une réactivation relance current et reprend seulement l’historique incomplet ;
- finalization émet une anomalie persistante après le délai configurable sans
  suppression, dépublication, override ni mutation forcée du statut ;
- les fins théoriques utilisent, dans l’ordre, la fin fournisseur, la dernière
  session, la médiane de trois pairs de même périmètre/type, la règle adaptateur,
  puis la fin du jour civil dans le fuseau fournisseur ; provenance et caractère
  estimé restent persistés.

## Persistance et atomicité

La migration additive `0019_lot56_durable_orchestration` ajoute l’étape current,
le début de cycle et les jalons d’achèvement historique/finalization. Son down
est destiné exclusivement aux bases jetables de développement/test.

Le changement d’état d’orchestration est exécuté par le callback `afterPersist`
dans la même transaction que les entités, observations, traversal, fencing et
checkpoint 5.6-C. Aucun moteur HTTP, quota, scheduler ou normalisateur parallèle
n’est introduit.

## Corrections après audit

- les providers ne documentant aucun scope temporel, l’approche B validée est
  appliquée : un unique traversal `current_global` acquiert tout le futur, puis
  la migration additive `0020_lot56_current_refresh_scope` persiste pour chaque
  entité son périmètre `past`, `current_hot` ou `current_future` ; aucun second
  appel identique n’est effectué sous un label future ;
- `afterPersist` reçoit désormais les compteurs cumulés durables du traversal.
  Une dernière page vide après 75 éléments ne peut donc plus déclarer la saison
  vide ;
- deep history impose `state.deep_history_season`, tandis que current,
  finalization et recent catchup imposent l’année civile courante du fuseau
  fournisseur. Toute contradiction est refusée avant traversal et appel au
  quota gate ;
- finalization n’est choisie que pour une entité non terminée dont la fin
  théorique est passée mais reste dans la fenêtre de grâce. Une entité terminée
  ou déjà au-delà de la grâce ne provoque aucun rafraîchissement inutile.

## Matrice de preuves (30 scénarios)

1. bootstrap neuf commence par current ;
2. current hot est prioritaire ;
3. finalization est prioritaire ;
4. current future n’est pas affamé ;
5. current dépasse J+30 ;
6. current futur exige une terminaison explicite ;
7. recent catchup suit current ;
8. deep history suit recent catchup ;
9. current reste maintenu pendant deep history ;
10. N-1 puis N-2 progressent durablement ;
11. saison vide complète incrémente le compteur ;
12. saison non vide remet le compteur à zéro ;
13. cinq saisons vides complètes terminent l’historique ;
14. borne `from_season` termine l’historique ;
15. mode `none` désactive l’historique ;
16. 429 ne compte pas comme vide ;
17. timeout ne compte pas comme vide ;
18. réponse partielle ne compte pas comme vide ;
19. curseur invalide ne compte pas comme vide ;
20. historique complet ne se relance pas automatiquement ;
21. réactivation relance current immédiatement ;
22. réactivation conserve l’historique complet ;
23. fin fournisseur prioritaire ;
24. dernière session utilisée à défaut ;
25. médiane de trois pairs comparables utilisée ;
26. règle adaptateur utilisée à défaut ;
27. fin de jour civil respecte le fuseau et la DST ;
28. délai de finalization configurable à 30 jours par défaut ;
29. anomalie persistante sans statut final forcé ;
30. minuit, UTC, DST et dates 1900/1950/1969 restent déterministes.

## Commandes et résultats

- `npm run typecheck --workspace @mse/api` : PASS ;
- `npm run build --workspace @mse/api` : PASS ;
- `npm test --workspace @mse/api` : **200/200 PASS** ;
- `./scripts/validate-repository.sh` : PASS (51 tests historiques, 18 ignorés
  faute de dépendances Python optionnelles) ;
- `./scripts/test-lot56-orchestration.sh` : PASS, PostgreSQL réel jetable et
  migrations `0019`/`0020` en up/down/up ;
- `./scripts/test-lot56-acquisition.sh` : **72/72 PASS**, adaptateurs et sécurité
  5.6-B ;
- `./scripts/test-lot56-transaction.sh` : PASS, transaction/fencing 5.6-C ;
- `./scripts/test-lot56-foundations.sh` : PASS, fondations/sécurité 5.6-A.

## Frontière et gouvernance

Aucune normalisation métier, fusion d’identité, suppression, dépublication ou
fonctionnalité 5.7 n’est ajoutée. Le Lot 5.6 global reste non validé,
`maintainer_validated=false`, `merge_authorized=false`,
`authorized_sub_lot=5.6`. **STOP avant 5.6-E.**
