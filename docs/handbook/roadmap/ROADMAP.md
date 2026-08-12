# Roadmap

- Lot 4.1 : validé
- Lot 4.2 : validé
- Lot 4.3 : validé utilisateur, fusionné dans `main` via PR #27 le 2026-08-11
- Lot 4 : terminé fonctionnellement
- Lot 4.4 : authentification de la console d'administration, validée utilisateur et fusionnée dans `main` via PR #28 le 2026-08-12
- Lot 5 : Fournisseurs et moteur de synchronisation API — conception fonctionnelle et technique validée, Phase 0 de spécification à produire avant implémentation

## Lot 4.4 — Authentification administration — TERMINÉ

Le Lot 4.4 a été fusionné dans `main` via la PR #28, commit de fusion `b42a97129a8aa1cb9a42ce01ba0affb8e5a848a1`.

Capacités validées :

- un seul compte administrateur pour cette première version ;
- création du compte initial via une commande d'initialisation dédiée ;
- mot de passe hashé avec Argon2id ;
- page de connexion avec identifiant et mot de passe ;
- sessions opaques gérées côté serveur ;
- cookie de session `HttpOnly`, `Secure` et `SameSite` ;
- protection CSRF ;
- redirection des pages d'administration non authentifiées vers le login ;
- déconnexion avec révocation immédiate de la session serveur ;
- durée absolue maximale de 8 heures ;
- expiration après 1 heure d'inactivité ;
- protection anti-bruteforce : 5 échecs sur 15 minutes puis blocage temporaire de 15 minutes ;
- audit des événements d'authentification sans secret ;
- coexistence avec le mécanisme HMAC technique existant.

Validation finale : Windows + Docker Desktop + Chromium, VPS Docker isolé, 110 tests Node, lint, typecheck, builds et validation dépôt réussis. Les workflows CI #198 et Docker build #74 sont verts sur le SHA final de branche `5428c1bc2c65193e2b0b623297ea366c2ddd196e`.

La clôture post-fusion est consignée dans `docs/handoff/LOT-4.4-POST-MERGE-CLOSURE.md`.

## Lot 5 — Fournisseurs et moteur de synchronisation API

Statut : `concept-approved-specification-pending`.

La conception détaillée validée avec le mainteneur est consignée dans `docs/handoff/LOT-5-PROVIDERS-SYNC-CONCEPT.md`. Ce document prime sur les valeurs décoratives présentes dans les maquettes.

### Objectif

- récupérer le maximum de données disponibles sur toutes les années et sessions possibles ;
- synchroniser d'abord l'année courante lors de l'activation d'un championnat ;
- remplir ensuite l'historique en arrière-plan ;
- maintenir l'année courante en boucle permanente ;
- respecter automatiquement les quotas court terme et mensuels ;
- reprendre après quota, redémarrage ou crash via curseurs persistants ;
- conserver les corrections manuelles et la traçabilité fournisseur ;
- administrer et superviser fournisseurs, championnats, quotas, synchronisations, alertes et logs.

### Adaptateurs et fournisseurs

- un adaptateur par API fournisseur ;
- ajout d'une instance d'un adaptateur connu depuis l'administration ;
- nouvelle API inconnue = nouvel adaptateur dans le code ;
- formulaire de configuration spécifique à chaque adaptateur ;
- découverte automatique des championnats lorsque possible ;
- ajout manuel lorsque nécessaire : identifiant, endpoint/slug ou autre paramètre spécifique ;
- traitement WRC spécifique encapsulé dans son adaptateur, notamment pour les saisons ;
- un seul fournisseur principal actif par championnat en V1.

### Championnats

- championnat découvert = affiché `Découvert — non synchronisé` ;
- activation manuelle obligatoire ;
- possibilité de désactiver/réactiver ;
- désactivation : conservation en base et administration, arrêt de synchro et exclusion de l'API publique ;
- réactivation : republication des données éligibles et passage prioritaire sur l'année courante ;
- import d'un logo local lié au championnat métier, jamais écrasé par le fournisseur.

### Bootstrap et historique

- premier passage année courante prioritaire ;
- round-robin entre championnats actifs ;
- historique ensuite en arrière-plan ;
- découverte des saisons si disponible ;
- sinon exploration `N-1`, `N-2`, etc. jusqu'à une saison réellement vide ;
- année de départ manuelle possible pour forcer la profondeur ;
- une erreur, un quota ou une page intermédiaire vide ne vaut jamais saison vide.

### Boucle année courante

- parcourir du 1er janvier jusqu'à la fin des données disponibles ;
- à la fin, revenir au 1er janvier de l'année courante ;
- recommencer en permanence pour capter horaires, statuts, annulations et nouvelles sessions.

### Scheduler et curseurs

- scheduler persistant ;
- curseur sérialisé spécifique à l'adaptateur ;
- phase `current` / `historical`, saison et curseur persistés ;
- round-robin entre flux actifs ;
- lease/verrou persistant par flux ;
- aucun double traitement d'un même flux ;
- reprise automatique après crash/redémarrage ;
- concurrence configurable par fournisseur, valeur par défaut : `1`.

### Quotas et cadence

- cadence calculée automatiquement par le serveur ;
- prise en compte quotas court terme, mensuels, quota restant, temps avant reset, flux actifs, réserve et concurrence ;
- headers fournisseur prioritaires lorsqu'ils donnent un état fiable ;
- sinon compteur local ;
- aucune synchronisation automatique si les limites sûres sont inconnues ;
- réserve du quota mensuel dédiée à l'année courante : `30 %` par défaut, configurable ;
- l'historique consomme uniquement le surplus disponible ;
- `quota journalier` et `réserve annuelle` vus dans certaines maquettes ne sont pas des exigences métier.

### Retry et erreurs

- `429`, timeouts, réseau, DNS, `5xx` : retry automatique avec backoff exponentiel + jitter ;
- `401`, `403`, secret/configuration invalide : suspension et alerte administrateur ;
- `Synchroniser maintenant` ne contourne jamais les quotas, il priorise seulement le travail.

### Secrets

- secrets fournisseur chiffrés en base ;
- clé maître fournie uniquement par l'environnement ;
- chiffrement authentifié moderne ;
- nonce/IV unique ;
- `key_version` enregistré dès la V1 ;
- le secret n'est jamais relu par le navigateur après enregistrement ;
- aucun secret dans logs, audit ou réponses.

### Normalisation, idempotence et corrections

- normalisation par adaptateur ;
- mappings permanents pour rapprochements connus ;
- ambiguïtés = `À associer`, jamais de fusion hasardeuse silencieuse ;
- rapprochement prioritaire par `external_id`, puis clé métier sûre ;
- hash de représentation fournisseur normalisée pour éviter les écritures inutiles ;
- les corrections manuelles restent prioritaires sur la valeur fournisseur ;
- la nouvelle valeur fournisseur continue d'être conservée en arrière-plan.

### Disparitions fournisseur

- aucune suppression automatique ;
- signaler un événement après `3` cycles complets consécutifs d'absence par défaut ;
- seuil configurable ;
- une annulation explicitement fournie reste une mise à jour réelle de statut.

### Historique et logs

- historique synthétique durable par exécution en PostgreSQL ;
- logs techniques détaillés structurés ;
- compatibilité stdout/stderr Docker ;
- persistance dédiée pour consultation lorsque configurée ;
- rotation quotidienne ou à `100 Mo`, premier seuil atteint ;
- compression ;
- rétention détaillée par défaut : `30 jours` ;
- aucun secret dans les journaux.

### Interface validée

Les concepts visuels ont été validés pour :

- page Fournisseurs ;
- détail fournisseur ;
- Configuration ;
- Quotas ;
- Championnats ;
- Synchronisation ;
- Historique & logs ;
- import logo championnat.

L'implémentation doit conserver le design MEDS existant et respecter `docs/handoff/UI_CONTRACT.md` et `docs/ui-reference/validated-mockups`.

### Phase 0 obligatoire

Avant tout code applicatif, Codex doit produire :

- `docs/handoff/LOT-5-PROVIDERS-SYNC-SPEC.md` ;
- `docs/handoff/LOT-5-PROVIDERS-SYNC-ACCEPTANCE.md` ;
- `docs/handoff/LOT-5-PROVIDERS-SYNC-IMPACT-ANALYSIS.md` ;
- découpage du Lot 5 en étapes d'implémentation et de validation ;
- ADR uniquement si nécessaire ;
- plan de migration détaillé si le schéma doit évoluer.

Après cette Phase 0, Codex doit s'arrêter et attendre la validation explicite du mainteneur avant toute implémentation.
