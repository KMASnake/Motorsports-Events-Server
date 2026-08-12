# Lot 5.4 — Scheduler persistant, curseurs et leases

Date : 2026-08-12

Statut : concept validé par le mainteneur, implémentation autorisable après validation documentaire

Ce document complète et amende `LOT-5-PROVIDERS-SYNC-SPEC.md` pour le périmètre 5.4 et les règles de boucle `current` auparavant décrites pour 5.6. En cas de contradiction sur ces sujets, ce document prime.

## 1. Objectif

Le sous-lot 5.4 construit l'infrastructure persistante d'ordonnancement : streams, curseurs, leases, reprise après crash, équité entre flux, pause/reprise/reset et boost manuel de priorité.

5.4 ne réalise pas l'ingestion métier complète des Events, ne construit pas le moteur complet de quotas/cadence de 5.5 et ne construit pas l'UI Fournisseurs de 5.9.

## 2. Streams persistants

Un `provider_championship` synchronisable conserve au plus deux streams physiques :

- `current` ;
- `historical`.

Le flux `historical` sait représenter deux classes logiques distinctes sans créer nécessairement un troisième stream physique :

- `recent_catchup` ;
- `deep_history`.

Le moteur générique ne doit pas interpréter la pagination, les endpoints ou la structure des curseurs adaptateur.

## 3. Fenêtre current glissante

La règle ancienne « repartir au 1er janvier de l'année courante » est remplacée.

Le flux `current` travaille sur une fenêtre glissante :

`aujourd'hui - current_window_days -> fin des données disponibles`

Puis il recommence depuis la nouvelle valeur `aujourd'hui - current_window_days`.

Valeur par défaut : `7 jours`.

La valeur est configurable par championnat, avec possibilité d'hériter d'une valeur par défaut fournisseur si le modèle retenu le permet proprement.

La fenêtre est recalculée lors d'une réactivation et lors du changement de date ; elle n'est pas figée à la date de première activation.

## 4. Historique et rattrapage récent

Tout ce qui précède la fenêtre `current` appartient au flux historique.

Ordre logique :

1. `recent_catchup` : partie de l'année courante antérieure à la fenêtre current ;
2. année qui vient de se terminer lors d'un changement d'année ;
3. `deep_history` : N-1, N-2, N-3, etc. jusqu'à saison vide confirmée.

Au changement d'année, l'ancienne année est ajoutée en priorité au rattrapage sans perdre la progression de l'historique profond.

Le modèle doit donc pouvoir conserver simultanément la progression historique profonde et une file/état de rattrapage récent.

Une réponse vide isolée, une erreur, un timeout ou un résultat partiel ne suffisent jamais à conclure qu'une saison est vide. La confirmation reste une responsabilité de l'adaptateur via le contrat prévu.

## 5. Ordonnancement pondéré

Les trois classes de travail utilisent un round-robin pondéré global :

- `current` : poids 3 ;
- `recent_catchup` : poids 2 ;
- `deep_history` : poids 1.

Valeurs par défaut : `3/2/1`, configurables globalement.

Une classe sans travail ne réserve pas inutilement sa part : sa capacité est redistribuée immédiatement aux autres classes éligibles.

5.4 choisit l'ordre entre travaux déjà éligibles. La décision de budget/quota complète appartient à 5.5.

## 6. Unité de travail

Un worker traite une seule unité adaptateur avant de rendre la main au scheduler.

Une unité n'est pas universellement une page : elle peut représenter une page, une plage temporelle, une portion de saison ou tout autre fragment défini par l'adaptateur.

Le contrat doit empêcher une unité non bornée de devenir une synchronisation complète déguisée. Les limites précises liées au quota seront finalisées en 5.5.

## 7. Lease

Valeurs par défaut :

- durée de lease : `120 secondes` ;
- heartbeat : environ `30 secondes`.

Le heartbeat renouvelle le lease tant que le worker reste propriétaire légitime.

Les leases sont persistants en PostgreSQL et doivent fonctionner avec plusieurs instances serveur.

## 8. Fencing token obligatoire

Chaque acquisition de lease possède une génération monotone ou `fencing_token`.

Tout commit d'une unité doit vérifier au minimum :

- `stream_id` ;
- `lease_owner` ;
- `lease_generation` / fencing token courant.

Un worker possédant un ancien token après expiration/reprise du lease doit être incapable de committer, même s'il revient tardivement.

## 9. Concurrence

Pool global de workers : `4` par défaut, configurable.

Concurrence fournisseur : `1` par défaut, configurable via `max_concurrency`.

La limite fournisseur doit être garantie de manière transactionnelle/persistante, pas par un simple compteur en mémoire.

Plusieurs fournisseurs peuvent travailler en parallèle si le pool global le permet.

## 10. Atomicité curseur + résultat

Le curseur ne progresse jamais avant que le résultat correspondant ne soit durablement validé.

Schéma conceptuel :

```text
BEGIN
  mutations de fixture/sink transactionnel 5.4
  éventuels états nécessaires
  cursor_after
  stream state
  run outcome
COMMIT
```

Si une étape échoue, tout est rollbacké et l'unité reste rejouable au dernier curseur commité.

5.4 démontre cette garantie avec un sink/fixture synthétique. L'ingestion complète Events, mappings et corrections appartient aux lots suivants.

## 11. Activation, pause, reprise et arrêt

Un championnat configuré en 5.3 reste `inactive` tant qu'une activation explicite n'a pas lieu dans le futur moteur.

États opérationnels attendus côté synchronisation : `inactive`, `active`, `paused`, `error` ou équivalents cohérents avec le schéma existant.

- `pause` : aucun nouveau lease, l'unité déjà en cours peut terminer proprement ;
- `resume` : reprise au curseur existant, sans reset ;
- `inactive` : arrêt durable non destructif ;
- `error` : état récupérable après résolution, sans effacement du curseur.

## 12. Désactivation du championnat métier

Règle normative :

`championship.active = false` implique :

- retrait de l'API publique ;
- arrêt automatique de sa synchronisation ;
- aucune nouvelle acquisition de lease ;
- conservation intégrale des données, corrections, mappings, runs, source configs et curseurs.

Aucune suppression automatique.

À la réactivation :

- republication des données éligibles ;
- synchronisation réactivable ;
- `current` recalculé sur `aujourd'hui - current_window_days` ;
- historique repris depuis son état durable ;
- boost temporaire de priorité au flux current.

## 13. Reset de curseur

Reset toujours explicite, ciblé et audité.

Choix séparés :

- reset `current` ;
- reset `historical`.

Le reset ne supprime aucune donnée métier. Il réinitialise uniquement le point de reprise et les états dérivés nécessaires du stream visé.

## 14. Synchroniser maintenant

`Synchroniser maintenant` signifie uniquement : priorité temporaire.

Valeur par défaut : boost `15 minutes`.

Le boost disparaît :

- après la première unité réussie ;
- ou à expiration.

Le boost ne contourne jamais :

- quota ;
- réserve ;
- backoff ;
- suspension fournisseur ;
- lease ;
- limite de concurrence.

## 15. Reprise après crash

Au redémarrage ou lorsqu'un lease expire :

- le run abandonné est conservé et marqué `interrupted` ;
- le lease expiré est récupérable ;
- le stream repart au dernier curseur durablement commité ;
- le fencing empêche l'ancien worker de committer plus tard.

Aucune intervention manuelle n'est nécessaire pour une reprise normale après crash.

## 16. Erreurs — frontière 5.4 / 5.5

5.4 implémente les structures et transitions génériques :

- compteur d'échecs ;
- `next_eligible_at` ;
- état `error` ;
- suspension fournisseur pour erreur d'authentification durable ;
- conservation du curseur ;
- reprise après résolution.

5.5 implémente la politique temporelle complète :

- séquence de backoff ;
- jitter ;
- `Retry-After` ;
- 429 ;
- interactions quota/cadence/fenêtres.

Le bouton `Synchroniser maintenant` ne contourne pas un backoff actif.

## 17. 401/403

Une erreur d'authentification fournisseur durable doit pouvoir suspendre l'instance fournisseur et empêcher de nouveaux leases pour ses flux.

Le détail complet des alertes persistantes appartient à 5.8.

## 18. Découverte périodique 5.3

Le scheduler 5.4 doit pouvoir exécuter l'éligibilité de découverte périodique modélisée en 5.3, sans créer un scheduler parallèle.

Cette intégration respecte les gardes conservatrices existantes et ne transforme pas 5.4 en moteur complet de quotas.

## 19. Non-objectifs 5.4

Ne pas implémenter :

- ingestion/normalisation Events complète ;
- bootstrap métier complet ;
- politique complète quota/cadence ;
- logique 429/jitter complète ;
- mappings et corrections complets ;
- UI Fournisseurs ;
- fusion multisource.

## 20. Validation conceptuelle

Le concept 5.4 a été revu et validé par le mainteneur le 2026-08-12.
