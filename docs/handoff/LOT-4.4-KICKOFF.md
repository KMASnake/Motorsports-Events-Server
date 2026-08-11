# Lot 4.4 — Préparation

Date : 2026-08-11
Statut : `prepared-not-started`

## Prérequis

Le Lot 4.3 est clos, validé utilisateur et fusionné dans `main` via la PR #27 (`d16e2bbe5698913e2046c1f645819057ed9196b8`).

Le Lot 4.4 doit démarrer depuis le `main` post-fusion. Aucun développement ne doit commencer avant validation explicite du cadrage fonctionnel et technique ci-dessous.

## Objectif proposé

Faire évoluer les opérations de calendrier autour du modèle désormais stabilisé « un Événement = une Session », sans remettre en cause les décisions des Lots 4.2 et 4.3.

Axes à cadrer avant implémentation :

- duplication avancée d'un événement ;
- éventuelle création répétée/récurrente d'événements ;
- détection et présentation des conflits/chevauchements ;
- comportement des données fournisseur et overrides lors d'une duplication ;
- ergonomie calendrier associée ;
- garanties UTC, minuit et DST ;
- audit et sécurité des mutations administratives ;
- non-régression du champ unique `session_title`.

Ces axes sont une **proposition de cadrage**, pas encore une spécification autorisant le code.

## Décisions Lot 4.3 à préserver

- un Événement représente une Session métier ;
- un seul champ métier `session_title` ;
- aucune réintroduction d'un couple visible `name/type` ;
- aucune collection multi-Sessions dans la fiche Événement ;
- dates stockées en UTC ;
- métadonnées fournisseur non exposées dans les formulaires métier ;
- données fournisseur et overrides locaux restent séparés ;
- API publique = valeur effective uniquement ;
- routes admin protégées ;
- mutations sensibles auditées ;
- migrations versionnées, réversibles et séparées du démarrage API.

## Phase 0 obligatoire

Avant toute modification applicative, Codex doit produire :

1. `docs/handoff/LOT-4.4-SPEC.md` ;
2. `docs/handoff/LOT-4.4-ACCEPTANCE.md` ;
3. une analyse d'impact base/API/Web/tests ;
4. un ADR uniquement si une nouvelle décision architecturale permanente est nécessaire ;
5. un plan de migration si le schéma doit évoluer ;
6. une stratégie de données synthétiques et de non-régression ;
7. un découpage en étapes auditables avec point d'arrêt après chaque étape importante.

## Questions à trancher dans la spécification

### Duplication

- quels champs sont copiés ?
- quelle nouvelle date/heure est appliquée ?
- un événement fournisseur dupliqué devient-il obligatoirement manuel ?
- les overrides/corrections sont-ils exclus de la copie ?
- comment traiter slug, identifiants externes et métadonnées techniques ?

### Récurrence

- la récurrence est-elle une aide à la création en série ou un objet métier persistant ?
- quelles fréquences sont réellement nécessaires ?
- comment gérer exceptions et modifications d'une occurrence ?
- comment garantir UTC/DST sans dérive horaire ?

### Conflits

- un chevauchement doit-il seulement avertir ou pouvoir bloquer ?
- quels événements sont comparés : même championnat, même circuit, même sport, tous ?
- quelles informations doivent être présentées à l'administrateur ?
- comment distinguer conflit métier et simple chevauchement volontaire ?

## Tests minimum à prévoir

- duplication simple ;
- duplication d'un événement fournisseur sans copier ses métadonnées techniques ;
- conservation de `session_title` ;
- nouvelle valeur de date avec offset explicite ;
- minuit ;
- DST ;
- chevauchements volontaires ;
- conflits détectés ;
- rollback sur erreur ;
- sécurité 401/403/admin ;
- audit sans secret ;
- non-régression Events/Corrections/Calendrier du Lot 4.2 ;
- non-régression du modèle Event-as-Session du Lot 4.3 ;
- Chromium sur les parcours réellement ajoutés.

## Point d'arrêt

La première tâche du Lot 4.4 est **le cadrage**, pas le code.

Après production de la SPEC, des critères d'acceptation et de l'analyse d'impact : **STOP** et demander validation du mainteneur avant implémentation.
