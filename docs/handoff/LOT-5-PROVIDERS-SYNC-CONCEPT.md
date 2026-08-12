# Lot 5 — Fournisseurs et moteur de synchronisation API

Date : 2026-08-12

Statut : `concept-approved-specification-pending`

## Gouvernance

Ce document consigne les décisions fonctionnelles et techniques discutées et explicitement validées avec le mainteneur avant mise à jour de la roadmap. Les valeurs décoratives visibles dans les maquettes ne constituent pas des exigences si elles contredisent ce document.

Le Lot 5 ne doit pas être implémenté avant une Phase 0 de spécification, critères d'acceptation, analyse d'impact et découpage d'implémentation validés.

## Objectif

Construire une administration des fournisseurs et un moteur de synchronisation capable :

- d'obtenir le maximum d'informations disponibles sur toutes les années et toutes les sessions possibles ;
- d'effectuer une synchronisation historique globale lors de l'activation initiale d'un championnat ;
- de maintenir ensuite l'année courante en synchronisation continue ;
- de respecter automatiquement les quotas court terme et mensuels ;
- de reprendre exactement après quota, arrêt, crash ou redémarrage ;
- de conserver les corrections et données administratives déjà validées ;
- de superviser fournisseurs, championnats, synchronisations, quotas, erreurs et logs depuis l'administration.

## Modèle fonctionnel

### Adaptateur

Un adaptateur contient le code spécifique à une API fournisseur.

Il doit pouvoir, selon les capacités du fournisseur :

- tester la connexion ;
- découvrir les championnats ;
- exposer un formulaire de configuration spécifique ;
- découvrir les saisons ;
- récupérer une unité de travail ;
- interpréter les quotas et headers fournisseur ;
- sérialiser et restaurer son curseur ;
- normaliser les données dans le modèle Motorsports Events.

L'ajout d'une nouvelle API non supportée nécessite un nouvel adaptateur dans le code. L'ajout d'une nouvelle instance d'un adaptateur déjà supporté se fait depuis l'administration.

### Instance fournisseur

Une instance fournisseur contient notamment :

- type d'adaptateur ;
- nom ;
- URL/base URL si nécessaire ;
- configuration spécifique ;
- secret API chiffré ;
- limites de quota ;
- réserve mensuelle année courante ;
- concurrence maximale ;
- état actif/suspendu ;
- paramètres de logs et de rétention.

### Flux de synchronisation

L'unité logique est un flux `fournisseur + championnat`, avec état de phase, saison et curseur persistant. Une seule source principale est active par championnat dans la V1.

## Fournisseurs particuliers

### TheSportsDB

La configuration manuelle d'un championnat peut utiliser un identifiant de ligue/championnat spécifique à l'adaptateur.

### OCBlackTop

La configuration manuelle peut utiliser un endpoint/slug spécifique à l'adaptateur.

### WRC

Le WRC doit conserver une logique dédiée lorsqu'elle est nécessaire, notamment pour la navigation par saisons, comme cela avait déjà été fait dans le plugin MyBB. Cette spécificité reste encapsulée dans l'adaptateur ; le cœur de synchronisation reçoit ensuite le même modèle normalisé.

## Découverte des championnats

- découverte automatique lorsque l'API le permet ;
- un championnat nouvellement découvert est affiché explicitement comme `Découvert — non synchronisé` ;
- aucune synchronisation ne démarre automatiquement après découverte ;
- activation manuelle obligatoire ;
- si la découverte n'est pas disponible, ajout manuel avec formulaire spécifique à l'adaptateur ;
- désactivation possible sans suppression des données.

## Logos de championnats

L'administration doit permettre d'importer un logo local pour un championnat.

Règles :

- le logo appartient au championnat métier, pas au fournisseur ;
- il ne doit jamais être écrasé par une synchronisation fournisseur ;
- aperçu, remplacement et suppression doivent être possibles ;
- affichage sans déformation avec fallback existant ;
- les formats et limites exactes seront fixés pendant la spécification technique selon le pipeline existant.

## Bootstrap d'un championnat activé

Ordre obligatoire :

1. synchroniser en priorité l'année courante ;
2. si plusieurs championnats sont activés, effectuer un premier passage année courante en round-robin sur tous avant de donner du volume à l'historique ;
3. démarrer ensuite l'historique en arrière-plan ;
4. maintenir en permanence la priorité de l'année courante ;
5. l'historique utilise le quota disponible après réservation du budget année courante.

## Profondeur historique

Ordre de décision :

1. utiliser la découverte automatique des saisons si le fournisseur la fournit ;
2. sinon explorer `N-1`, `N-2`, `N-3` depuis l'année courante ;
3. continuer tant que les saisons retournent des données ;
4. arrêter sur une saison réellement vide confirmée par l'adaptateur ;
5. une erreur, un quota atteint ou une page vide intermédiaire ne doit jamais être interprété comme une saison vide ;
6. permettre une année de départ manuelle par championnat pour forcer la profondeur historique et traverser une éventuelle année intermédiaire vide.

## Synchronisation continue de l'année courante

Après le bootstrap et l'historique :

- parcourir l'année courante du 1er janvier jusqu'à la fin des données disponibles ;
- lorsque le curseur atteint la fin, repartir au 1er janvier de l'année courante ;
- répéter en boucle afin de détecter changements d'horaires, statuts, annulations et nouvelles sessions ;
- le curseur est persisté après chaque unité de travail réussie.

## Round-robin

Les championnats actifs d'un même fournisseur partagent les appels en round-robin.

L'unité de travail est définie par l'adaptateur : page, offset, lot, saison partielle, token, etc.

Un championnat volumineux ne doit pas monopoliser le quota du fournisseur.

## Scheduler, concurrence et reprise

- scheduler persistant ;
- aucun travail critique ne doit exister uniquement en mémoire ;
- lease/verrou persistant par flux pour empêcher une double synchronisation ;
- un seul worker actif pour un même flux ;
- différents flux peuvent travailler en parallèle si les quotas le permettent ;
- concurrence configurable par fournisseur ;
- valeur par défaut validée : `1` ;
- après crash/redémarrage : récupération des leases abandonnés, restauration des curseurs, recalcul des quotas/cadences puis reprise automatique.

## Curseur

Ne pas modéliser le curseur comme une simple page globale.

Le moteur doit conserver au minimum :

- fournisseur ;
- championnat ;
- phase `current` ou `historical` ;
- saison ;
- état de curseur sérialisé par l'adaptateur ;
- timestamp/état de dernière progression.

## Quotas et cadence automatique

L'administrateur configure les limites ; il ne configure pas une fréquence arbitraire de synchronisation.

Le moteur calcule dynamiquement la cadence soutenable à partir notamment :

- quota court terme ;
- quota mensuel ;
- quota restant ;
- temps restant avant reset ;
- nombre de flux actifs ;
- réserve année courante ;
- concurrence autorisée ;
- informations de quota fournies par les headers lorsque disponibles.

Le calcul doit être réévalué lorsque ces paramètres changent.

### Source des quotas

- si le fournisseur fournit des headers fiables, ils servent de source prioritaire pour l'état observé ;
- sinon Motorsports Events tient son propre compteur ;
- les limites configurées restent distinctes de la consommation observée.

### Quota inconnu

Aucune synchronisation automatique ne démarre tant qu'aucune limite sûre n'est définie, sauf si l'API expose de façon fiable ses limites.

### Réserve mensuelle année courante

- valeur par défaut validée : `30 %` du quota mensuel ;
- configurable par fournisseur ;
- l'historique ne consomme pas cette réserve ;
- lorsque le budget historique est épuisé, l'historique passe en attente sans erreur ;
- l'année courante continue tant que sa réserve le permet.

Les notions de `quota journalier` ou `réserve annuelle` présentes dans certaines maquettes sont décoratives et ne constituent pas des exigences validées.

## Commandes manuelles

Prévoir :

- synchroniser un fournisseur maintenant ;
- synchroniser un championnat maintenant ;
- pause ;
- reprise ;
- réinitialisation du curseur avec confirmation forte.

Une commande `Synchroniser maintenant` augmente la priorité de la tâche mais ne contourne jamais les quotas ni les protections du scheduler.

## Retry et erreurs

Erreurs transitoires telles que `429`, timeout, réseau, DNS ou `5xx` :

- retry automatique ;
- backoff exponentiel ;
- jitter ;
- reprise sans considérer un rate-limit court comme une erreur métier définitive.

Erreurs durables telles que `401`, `403`, secret invalide ou configuration invalide :

- suspendre le fournisseur/flux concerné ;
- créer une alerte administrateur ;
- attendre une intervention manuelle.

## Secrets fournisseurs

Les secrets fournisseur sont chiffrés en base.

Règles :

- clé maître fournie par l'environnement serveur et jamais stockée en base ;
- chiffrement authentifié moderne, par exemple AES-256-GCM ou équivalent approuvé pendant la spécification ;
- nonce/IV unique ;
- `key_version` stocké avec le secret ;
- une seule clé active pour les nouveaux secrets en V1, avec lecture temporaire des anciennes versions lors d'une future rotation ;
- le secret n'est jamais renvoyé par l'API après enregistrement ;
- l'UI affiche seulement `Clé API configurée` ;
- jamais de secret dans logs, audit, erreurs ou réponses.

## Normalisation et mappings

Pipeline :

1. donnée brute fournisseur ;
2. normalisation par l'adaptateur ;
3. rapprochement avec les références Motorsports Events ;
4. insertion/mise à jour du modèle métier.

Règles :

- correspondance certaine : association automatique ;
- mapping déjà connu : association automatique ;
- ambiguïté : statut `À associer`, intervention administrateur, puis mapping mémorisé ;
- ne jamais faire un rapprochement hasardeux silencieux.

## Source principale par championnat

V1 : un seul fournisseur principal actif par championnat.

Le modèle de données ne doit pas empêcher une évolution multisource future, mais aucun arbitrage multisource n'est à implémenter dans le Lot 5.

## Idempotence et déduplication

Ordre de rapprochement :

1. `external_id` fournisseur stable lorsqu'il existe ;
2. clé métier normalisée lorsqu'elle est suffisamment unique ;
3. ambiguïté : intervention manuelle au lieu d'une fusion silencieuse.

Conserver un hash de la dernière représentation fournisseur normalisée afin de détecter rapidement les données inchangées et d'éviter écritures/audits inutiles.

## Corrections manuelles

Les règles Corrections validées précédemment restent prioritaires.

- une nouvelle valeur fournisseur met à jour la valeur fournisseur ;
- un override local existant reste la valeur effective ;
- la synchronisation ne détruit jamais silencieusement une correction humaine ;
- lorsqu'une nouvelle valeur fournisseur diverge d'un override, l'administration doit pouvoir le signaler.

## Événements absents chez le fournisseur

- aucune suppression automatique ;
- après `3` cycles complets consécutifs sans retrouver un événement, créer un signalement `absent chez le fournisseur` ;
- seuil configurable par fournisseur ;
- une annulation explicitement fournie par l'API reste une vraie mise à jour de statut.

## Désactivation d'un championnat

Lorsqu'un championnat est désactivé :

- arrêter sa synchronisation ;
- conserver toutes ses données en base ;
- conserver l'accès administratif ;
- exclure ses données de l'API publique sans modifier individuellement tous les événements.

Lorsqu'il est réactivé :

- les données éligibles redeviennent publiables immédiatement ;
- lancer un passage prioritaire sur l'année courante ;
- puis reprendre le scheduler normal.

## Historique et logs

### Historique synthétique en base

Conserver une entrée durable par exécution avec au minimum :

- `sync_run_id` ;
- fournisseur ;
- championnat ;
- phase ;
- saison ;
- curseur avant/après ;
- timestamps/durée ;
- requêtes consommées ;
- éléments lus, créés, modifiés, inchangés/ignorés ;
- corrections ;
- avertissements/erreurs ;
- quota consommé.

### Logs techniques détaillés

- logs structurés, de préférence JSON ;
- sortie standard compatible Docker ;
- persistance optionnelle dans un volume dédié pour consultation administrative ;
- rotation quotidienne ou dès `100 Mo`, au premier seuil atteint ;
- compression des anciens logs ;
- rétention détaillée par défaut : `30 jours` ;
- paramètres configurables ;
- possibilité de conserver erreurs/événements importants plus longtemps selon la stratégie de rétention définie en Phase 0 ;
- jamais de clé API, Authorization, cookie, session ou secret.

## Administration et maquettes validées

Écrans fonctionnels validés avec le mainteneur :

- page générale Fournisseurs ;
- page détail fournisseur ;
- onglet Configuration ;
- onglet Quotas ;
- onglet Championnats ;
- onglet Synchronisation ;
- onglet Historique & logs ;
- import de logo championnat.

Les écrans doivent reprendre le design MEDS existant et respecter le contrat de fidélité visuelle du dépôt. Les références officielles `docs/ui-reference/validated-mockups` restent prioritaires pour le langage visuel.

### Page Fournisseurs

Afficher notamment :

- état fournisseur ;
- santé/connexion API ;
- quotas ;
- prochaine remise à zéro ;
- cadence calculée ;
- dernière/prochaine synchro ;
- championnats actifs/découverts/en erreur ;
- alertes actionnables.

### Page détail fournisseur

Sections/onglets validés :

- Configuration ;
- Quotas ;
- Championnats ;
- Synchronisation ;
- Historique & logs.

## Alertes administratives

Prévoir au minimum :

- clé API invalide ;
- quota critique/épuisé ;
- fournisseur suspendu ;
- championnat découvert ;
- rapprochement manuel nécessaire ;
- événement absent après le seuil de cycles ;
- synchronisation bloquée ;
- erreurs répétées.

Pas de notifications externes obligatoires en V1.

## Valeurs par défaut validées

- réserve du quota mensuel pour l'année courante : `30 %` ;
- rétention logs techniques détaillés : `30 jours` ;
- rotation logs : quotidienne ou `100 Mo`, premier seuil atteint ;
- concurrence par fournisseur : `1`.

Toutes sont configurables.

## Phase 0 obligatoire avant implémentation

Codex doit produire et faire valider avant code :

- `docs/handoff/LOT-5-PROVIDERS-SYNC-SPEC.md` ;
- `docs/handoff/LOT-5-PROVIDERS-SYNC-ACCEPTANCE.md` ;
- `docs/handoff/LOT-5-PROVIDERS-SYNC-IMPACT-ANALYSIS.md` ;
- découpage en étapes d'implémentation et de validation ;
- ADR uniquement pour les décisions architecturales durables qui ne sont pas déjà couvertes ;
- plan de migration détaillé si des changements de schéma sont requis.

Aucun code applicatif ne doit être écrit avant validation explicite de cette Phase 0.
