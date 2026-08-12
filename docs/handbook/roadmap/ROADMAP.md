# Roadmap

- Lot 4.1 : validé
- Lot 4.2 : validé
- Lot 4.3 : validé utilisateur, fusionné dans `main` via PR #27 le 2026-08-11
- Lot 4 : terminé fonctionnellement
- Lot 4.4 : authentification de la console d'administration, validée utilisateur et fusionnée dans `main` via PR #28 le 2026-08-12
- Lot 5 : Fournisseurs et moteur de synchronisation API — Phase 0 validée ; 5.1 validé ; 5.2 validé ; concept 5.3 validé et autorisé

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

Statut : `sub-lot-5.3-concept-validated-authorized`.

La conception générale reste définie par `docs/handoff/LOT-5-PROVIDERS-SYNC-CONCEPT.md`, la SPEC et l'errata. Le périmètre détaillé de 5.3 est précisé par `docs/handoff/LOT-5.3-DISCOVERY-CONCEPT.md` et `docs/handoff/LOT-5.3-DISCOVERY-ACCEPTANCE.md`, qui priment pour 5.3 en cas de contradiction avec les formulations de Phase 0.

### État des sous-lots

- 5.1 — DB + contrats : validé mainteneur ;
- 5.2 — secrets et configuration fournisseur : validé mainteneur ;
- 5.3 — découverte championnats et source config : concept validé, implémentation autorisée ;
- 5.4+ : non autorisés tant que 5.3 n'est pas audité et validé.

### Objectif global

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
- un même fournisseur peut utiliser plusieurs endpoints/stratégies selon le championnat ;
- WRC est fourni par OCBlackTop et reste un flux OCBlackTop, jamais un adaptateur autonome ;
- un seul fournisseur principal actif par championnat en V1 ; les sources alternatives peuvent rester enregistrées inactives.

### Lot 5.3 — Découverte et source config

5.3 utilise les vrais adaptateurs OCBlackTop et TheSportsDB pour le test de connexion et la découverte, sans lancer de synchronisation d'événements.

Règles validées :

- une découverte réelle persiste le résultat fournisseur sans créer automatiquement de championnat métier ;
- un résultat non associé reste `À associer / à créer` jusqu'à validation manuelle ;
- un mapping déjà explicitement validé peut être réutilisé ;
- l'administrateur choisit d'associer à un championnat existant ou de créer explicitement un nouveau championnat à partir des données préremplies ;
- les résultats non associés sont persistés dans une entité dédiée distincte de `provider_championships` ;
- la `source_config` proposée est conservée séparément de la configuration validée ;
- une redécouverte ne remplace jamais automatiquement la configuration active ;
- en cas de divergence, l'administration propose l'action explicite `Adopter la configuration découverte` ;
- cette adoption est auditée et ne déclenche aucune synchronisation ;
- état d'un lien validé : `Configuré — non synchronisé` ou équivalent sûr.

### Découverte périodique

- activable/désactivable par fournisseur ;
- intervalle par défaut : 30 jours ;
- minimum : 7 jours ;
- `last_discovery_at` persistant ;
- prochaine échéance calculée par le système ;
- bouton de redécouverte manuelle disponible ;
- 5.3 implémente le modèle et l'éligibilité ;
- l'exécution périodique effective est branchée sur le scheduler persistant en 5.4, sans créer de scheduler parallèle en 5.3.

### Coût API et quotas pour la découverte

- comptabiliser toutes les requêtes de découverte ;
- utiliser les limites sûres configurées en 5.2 ;
- refuser ou reporter une découverte non sûre ;
- ne jamais contourner les limites via une commande manuelle ;
- ne pas consommer volontairement la réserve de 30 % dédiée à l'année courante ;
- ne pas anticiper le moteur complet de quotas/cadence de 5.5.

### Championnat non retrouvé

- aucune suppression automatique ;
- après 3 découvertes complètes consécutives sans retrouver un championnat connu : état `Non retrouvé chez le fournisseur` ;
- échec, interruption, quota, résultat partiel ou erreur ne comptent pas comme absence ;
- réapparition remet le compteur à zéro et résout l'état.

### Historique DISCOVERY

Chaque opération de découverte conserve un historique minimal durable avec origine manuelle/périodique, timestamps, durée, statut, nombre de requêtes, trouvés, nouveaux, non retrouvés, divergences, erreur expurgée ou motif de report. Cette traçabilité devra converger vers l'infrastructure commune runs/logs de 5.8 sans l'anticiper entièrement.

### Bootstrap, historique et synchronisation — lots suivants

- premier passage année courante prioritaire ;
- round-robin entre championnats actifs ;
- historique ensuite en arrière-plan ;
- découverte des saisons si disponible ;
- sinon exploration `N-1`, `N-2`, etc. jusqu'à une saison réellement vide ;
- année de départ manuelle possible ;
- boucle permanente de l'année courante ;
- scheduler persistant, leases et curseurs ;
- moteur de quota/cadence complet ;
- normalisation, idempotence, corrections, présence événements ;
- logs/runs/alertes complets ;
- UI finale fidèle aux maquettes validées.

### Valeurs par défaut déjà validées

- réserve quota mensuel année courante : 30 % ;
- concurrence fournisseur : 1 ;
- seuil d'événement absent : 3 cycles complets ;
- rétention logs détaillés : 30 jours ;
- rotation logs : quotidienne ou 100 Mo, premier seuil atteint ;
- découverte automatique : 30 jours par défaut, minimum 7 jours ;
- championnat fournisseur non retrouvé : 3 découvertes complètes consécutives.

### Interface validée

Les concepts visuels ont été validés pour page Fournisseurs, détail fournisseur, Configuration, Quotas, Championnats, Synchronisation, Historique & logs et import logo championnat. L'implémentation UI complète reste prévue en 5.9 et doit respecter `docs/handoff/UI_CONTRACT.md` et `docs/ui-reference/validated-mockups`.

### Stop rule

Après chaque sous-lot, Codex doit s'arrêter pour audit et validation explicite du mainteneur. L'autorisation de 5.3 n'autorise ni 5.4 ni les sous-lots suivants.