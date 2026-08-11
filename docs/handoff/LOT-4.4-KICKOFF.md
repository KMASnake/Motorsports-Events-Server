# Lot 4.4 — Préparation

Date : 2026-08-11
Statut : `prepared-not-started`

## Prérequis

Le Lot 4.3 est clos, validé utilisateur et fusionné dans `main` via la PR #27 (`d16e2bbe5698913e2046c1f645819057ed9196b8`).

Le Lot 4.4 doit démarrer depuis le `main` post-fusion. Aucun développement ne doit commencer avant validation explicite du cadrage fonctionnel et technique ci-dessous.

## Décision mainteneur — périmètre définitif du Lot 4.4

Le Lot 4.4 est exclusivement consacré à la **duplication d'Événements**.

Sont explicitement hors périmètre :

- récurrence ;
- création récurrente ou en série ;
- moteur de règles de récurrence ;
- gestion des conflits ;
- détection de chevauchements ;
- avertissements ou blocages fondés sur des chevauchements temporels.

Ces fonctions ne doivent pas être analysées, spécifiées ni implémentées dans le Lot 4.4.

## Objectif

Permettre à un administrateur de créer rapidement un nouvel Événement à partir d'un Événement existant tout en conservant le modèle validé « un Événement = une Session ».

Le parcours cible à privilégier est :

1. sélectionner un Événement existant ;
2. choisir `Dupliquer` ;
3. ouvrir le formulaire Événement existant prérempli avec les données métier copiables ;
4. permettre à l'utilisateur de modifier les champs souhaités, notamment date, heure, championnat, circuit, intitulé et `session_title` ;
5. ne créer le nouvel Événement qu'après validation explicite du formulaire ;
6. rendre la copie totalement indépendante de l'Événement source.

Une duplication immédiate en base sans étape de vérification utilisateur n'est pas la cible privilégiée.

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

## Règles de duplication à cadrer

La Phase 0 doit décider précisément quels champs sont préremplis et lesquels sont régénérés ou supprimés.

À étudier obligatoirement :

- nom de l'Événement ;
- championnat ;
- circuit ;
- sport si applicable ;
- `session_title` ;
- date et heure ;
- statut ;
- publication ;
- description ;
- durée / date de fin si applicable ;
- slug ;
- identifiant interne ;
- origine ;
- `provider_key` ;
- `external_id` ;
- corrections et overrides ;
- journal d'audit.

Principe attendu : une copie issue d'un Événement fournisseur devient un nouvel Événement manuel indépendant. Les identifiants fournisseur, identifiants externes et corrections de l'Événement source ne doivent pas être copiés vers le nouvel Événement.

Le slug et les identifiants internes doivent être générés par le serveur selon les règles existantes.

## Phase 0 obligatoire

Avant toute modification applicative, Codex doit produire :

1. `docs/handoff/LOT-4.4-SPEC.md` ;
2. `docs/handoff/LOT-4.4-ACCEPTANCE.md` ;
3. `docs/handoff/LOT-4.4-IMPACT-ANALYSIS.md` ;
4. un ADR uniquement si une nouvelle décision architecturale permanente est réellement nécessaire ;
5. un plan de migration uniquement si le schéma doit réellement évoluer ;
6. une stratégie de données synthétiques et de non-régression ;
7. un découpage en étapes auditables avec point d'arrêt après chaque étape importante.

Aucune migration ne doit être créée pendant la Phase 0.

## UX à privilégier

Réutiliser le formulaire Événement existant.

Le bouton ou l'action `Dupliquer` peut être disponible depuis les endroits pertinents déjà existants, notamment :

- détail d'un Événement ;
- liste des Événements ;
- calendrier si cela reste cohérent avec l'UX actuelle.

Ne pas créer une nouvelle page uniquement pour la duplication si le formulaire Événement suffit.

Le formulaire prérempli doit clairement représenter un **nouvel Événement non encore enregistré**.

## API à étudier

La Phase 0 doit comparer au minimum :

- duplication purement côté Web par préremplissage du formulaire puis utilisation du POST Event existant ;
- éventuel endpoint spécialisé de duplication si une logique serveur supplémentaire le justifie réellement.

Privilégier la solution la plus simple qui respecte les règles métier, de sécurité, d'audit et d'indépendance de la copie.

Aucune nouvelle route ne doit être créée pendant la Phase 0.

## Base de données

Ne pas ajouter de table ou colonne si la duplication peut fonctionner proprement avec le modèle Event existant.

Toute proposition de migration doit démontrer qu'elle est indispensable et fournir avant implémentation :

- justification ;
- stratégie UP ;
- idempotence ;
- stratégie DOWN ;
- risques ;
- compatibilité Lot 4.3.

## Tests minimum à prévoir

- duplication d'un Événement manuel ;
- duplication d'un Événement fournisseur ;
- copie indépendante de la source ;
- conservation de `session_title` dans le formulaire prérempli ;
- possibilité de modifier `session_title` avant création ;
- absence de `provider_key` et `external_id` sur la copie manuelle ;
- absence de copie des corrections/overrides de la source ;
- nouvel ID ;
- nouveau slug généré ;
- date avec offset explicite et stockage UTC ;
- cas minuit et DST pour la date choisie ;
- annulation du formulaire sans création ;
- échec de création sans événement partiellement persisté ;
- sécurité 401/403/admin côté mutation existante ou éventuelle route dédiée ;
- audit sans secret ;
- non-régression Events/Corrections/Calendrier du Lot 4.2 ;
- non-régression du modèle Event-as-Session du Lot 4.3 ;
- Chromium sur les parcours réellement ajoutés.

Aucun test de récurrence, de conflit ou de chevauchement ne fait partie du Lot 4.4.

## Point d'arrêt

La première tâche du Lot 4.4 est **le cadrage de la duplication**, pas le code.

Après production de la SPEC, des critères d'acceptation et de l'analyse d'impact : **STOP** et demander validation du mainteneur avant implémentation.
