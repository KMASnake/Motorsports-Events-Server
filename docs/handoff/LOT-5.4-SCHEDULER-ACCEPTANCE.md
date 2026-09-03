# Lot 5.4 — Critères d'acceptation Scheduler, curseurs et leases

Date : 2026-08-12

Statut : critères validés par le mainteneur

Ce document complète et amende `LOT-5-PROVIDERS-SYNC-ACCEPTANCE.md` pour le sous-lot 5.4 et les règles de boucle current liées. En cas de contradiction, ce document prime.

## Critères bloquants

### Modèle et migrations

- migration 5.4 UP/DOWN validée sur PostgreSQL réel ;
- streams persistants `current` et `historical` par lien synchronisable ;
- état historique capable de distinguer `recent_catchup` et `deep_history` sans perdre l'un ou l'autre ;
- curseur opaque + `cursor_version` persistés ;
- lease persistant, génération/fencing token et timestamps persistés ;
- aucune perte des données 5.1/5.2/5.3 lors de migration/rollback protégé.

### Current glissant

- `current_window_days = 7` par défaut ;
- valeur configurable ;
- point de départ calculé à `aujourd'hui - current_window_days` ;
- fin de cycle current => recalcul de la fenêtre, jamais retour forcé au 1er janvier ;
- réactivation => recalcul de la fenêtre current ;
- changement d'année => nouvelle fenêtre courante sans reset manuel.

### Rattrapage et historique profond

- la partie antérieure à la fenêtre current est couverte par `recent_catchup` ;
- l'année qui vient de se terminer devient prioritaire dans le rattrapage ;
- la progression `deep_history` est conservée pendant ce rattrapage ;
- descente N-1/N-2/... préparée sans considérer une réponse vide isolée comme fin historique ;
- confirmation de saison vide reste adaptateur-dépendante.

### Round-robin pondéré

- poids globaux par défaut `current/recent/deep = 3/2/1` ;
- poids configurables ;
- absence de travail dans une classe redistribue la capacité ;
- aucune classe active ne peut être affamée durablement par une autre dans les conditions de test ;
- plusieurs championnats démontrent l'équité du scheduler.

### Unités de travail

- une acquisition worker traite une unité adaptateur bornée ;
- le scheduler n'impose aucune pagination universelle ;
- l'adaptateur reste propriétaire du curseur et de la définition de l'unité ;
- 5.4 n'effectue pas d'ingestion Events réelle.

### Leases et fencing

- lease par défaut `120 s` ;
- heartbeat cible environ `30 s` ;
- acquisition atomique PostgreSQL ;
- lease expiré récupérable ;
- chaque nouvelle acquisition incrémente/génère un fencing token ;
- un worker avec ancien token ne peut pas committer ;
- test avec deux workers concurrents prouve qu'un seul commit valide est accepté.

### Pool et concurrence

- pool global par défaut `4`, configurable ;
- `max_concurrency` fournisseur par défaut `1` respecté ;
- deux fournisseurs distincts peuvent travailler en parallèle ;
- deux workers ne dépassent pas volontairement la concurrence d'un même fournisseur ;
- la garantie ne repose pas uniquement sur la mémoire du processus.

### Atomicité

- résultat synthétique + nouveau curseur + état stream + issue de run sont commités atomiquement ;
- échec avant commit => rollback du résultat et du curseur ;
- replay de l'unité au dernier curseur durable ;
- aucun trou de progression démontré après crash simulé.

### Crash/reprise

- arrêt forcé pendant une unité ;
- expiration lease ;
- run précédent conservé `interrupted` ;
- autre worker reprend au dernier curseur commité ;
- ancien worker tardif rejeté par fencing.

### Pause / reprise / reset

- pause bloque les nouvelles acquisitions mais laisse terminer l'unité déjà acquise ;
- reprise ne reset pas le curseur ;
- reset `current` et reset `historical` sont séparés ;
- reset audité ;
- reset ne supprime aucune donnée métier.

### Synchroniser maintenant

- boost de priorité par défaut `15 min` ;
- boost expire après une première unité réussie ou après délai ;
- boost ne contourne pas quota, réserve, backoff, suspension, lease ni concurrence ;
- action auditée.

### Désactivation / réactivation championnat

- désactivation championnat => retrait API publique + arrêt synchro ;
- aucune nouvelle acquisition de lease pour championnat désactivé ;
- données, source configs, runs et curseurs conservés ;
- aucun DELETE automatique ;
- réactivation => republication des données éligibles, current recalculé sur la fenêtre glissante et historique repris ;
- current reçoit une priorité temporaire à la reprise.

### Erreurs et frontière 5.5

- 5.4 possède compteur d'échec, état error, next_eligible_at et suspension fournisseur générique ;
- 401/403 durables peuvent suspendre l'instance et bloquer les nouveaux leases ;
- curseur inchangé en cas d'échec ;
- politique exacte 429/Retry-After/backoff exponentiel/jitter reste hors 5.4 et est testée en 5.5 ;
- `Synchroniser maintenant` ne contourne pas un backoff déjà actif.

### Découverte périodique

- le scheduler 5.4 peut sélectionner une découverte 5.3 devenue due ;
- aucun second scheduler parallèle n'est créé ;
- une découverte non éligible/quota-safe n'est pas forcée.

### Anti-scope

Les tests doivent prouver l'absence de :

- création ou mise à jour réelle d'Events fournisseur ;
- moteur complet de quotas 5.5 ;
- normalisation/mappings complets 5.7 ;
- UI Fournisseurs 5.9 ;
- fusion multisource.

## Validation attendue

- tests unitaires déterministes avec horloge injectable ;
- recette PostgreSQL/Docker réelle ;
- scénario multi-worker/multi-instance simulé ou réel ;
- crash + lease expiré + fencing ;
- migration UP/DOWN/réapplication ;
- lint, typecheck, tests et builds globaux verts ;
- documentation `LOT-5.4-VALIDATION.md` produite ;
- aucun test visuel requis tant que `apps/web/**` n'est pas modifié.
