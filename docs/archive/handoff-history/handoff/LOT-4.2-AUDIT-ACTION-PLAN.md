# Plan d'action Codex — audit du lot 4.2

## Statut

- audit de référence : `LOT-4.2-CODE-AUDIT-2026-08-03.md` ;
- décision : `CHANGES REQUESTED` ;
- fusion dans `main` : interdite ;
- nouvelle fonctionnalité : interdite tant que les P1 restent ouverts ;
- validation utilisateur globale du lot 4.2 : non acquise.

## Ordre de travail obligatoire

### Étape 1 — migration et sécurité du démarrage

- [x] retirer de `ensureApplicationSchema()` toute suppression ou réécriture de
  données métier ;
- [x] créer une migration versionnée pour `event_corrections` et l'UTC ;
- [x] définir une stratégie non destructive pour les anciennes corrections de
  fuseau horaire ;
- [x] fournir et tester le rollback ;
- [x] tester localement base vierge, base existante et redémarrages successifs.

Statut : étape validée techniquement sur WSL et confirmée par l'utilisateur sur
un VPS Docker isolé le 2026-08-09. Voir
`LOT-4.2-AUDIT-STEP-1-ACCEPTANCE.md`.

Preuves attendues : migration, tests PostgreSQL, commandes exécutées et résultat
montrant qu'un second démarrage ne modifie aucune donnée.

### Étape 2 — typage des corrections

- [x] remplacer `z.unknown()` par une validation dépendant de `field_name` ;
- [x] couvrir chaînes, booléens, dates UTC, statuts, références et valeurs
  nulles autorisées ;
- [x] vérifier les références championnat et circuit ;
- [x] retourner `400` avant tout accès SQL pour une valeur incompatible ;
- [x] ajouter les tests de chaque type et de chaque rejet.

Statut : implémentation, 23 tests de valeurs et recettes Docker PostgreSQL
réussis localement et sur VPS isolé le 2026-08-09. Voir
`LOT-4.2-AUDIT-STEP-2-ACCEPTANCE.md`.

### Étape 3 — sécurité des routes administratives

- [x] vérifier l'ordre d'enregistrement du hook d'authentification ;
- [x] tester `401` sans authentification ;
- [x] tester `403` sans rôle administrateur ;
- [x] tester le succès avec un administrateur ;
- [x] tester les jetons invalides et expirés ;
- [x] couvrir événements, ingestion fournisseur et corrections.

Statut : 8 tests Fastify et recettes Docker PostgreSQL réussis localement et
sur VPS isolé le 2026-08-09. Voir
`LOT-4.2-AUDIT-STEP-3-ACCEPTANCE.md`.

### Étape 4 — API, pagination et audit

- [x] ajouter une pagination serveur aux événements et corrections ;
- [x] appliquer tri et filtres avant pagination ;
- [x] valider tous les paramètres de requête avec Zod ;
- [x] raccorder toutes les mutations au journal d'administration ;
- [x] préserver acteur, ancienne valeur, nouvelle valeur et identifiant de
  requête sans enregistrer de secret ;
- [x] vérifier ou ajouter l'unicité `(provider_key, external_id)` ;
- [x] séparer clairement ingestion technique et création administrative.

Statut : 3 tests de requêtes, migration/rollback et recettes Docker PostgreSQL
réussis localement et sur VPS isolé le 2026-08-09. Voir
`LOT-4.2-AUDIT-STEP-4-ACCEPTANCE.md`.

### Étape 5 — concurrence et interactions calendrier

- [x] tester deux résolutions simultanées ;
- [x] tester synchronisation fournisseur et modification administrateur
  simultanées ;
- [x] vérifier le rollback transactionnel après erreur ;
- [x] compléter création par plage et redimensionnement visuel ;
- [x] tester le rollback visuel des déplacements et redimensionnements ;
- [x] couvrir événements traversant minuit et changements heure d'été/hiver.

Statut : implémentation et recette Docker PostgreSQL réussies localement puis
confirmées par l'utilisateur sur VPS isolé le 2026-08-09. Voir
`LOT-4.2-AUDIT-STEP-5-ACCEPTANCE.md`.

### Étape 6 — dépendances

- [x] identifier les avis npm de sévérité élevée reproductibles ;
- [x] consigner paquet, GHSA/CVE, dépendance directe ou transitive, exposition,
  version corrigée et impact de mise à niveau ;
- [x] corriger ou documenter une exception temporaire datée et justifiée.

Statut : l'audit courant reproduit un seul avis, `nanoid`
`GHSA-2v37-7h3g-55p8`. Le verrou passe de `3.3.16` à `3.3.18` et `npm audit`
retourne zéro vulnérabilité. Tests, builds et Docker réussis localement puis
confirmés par l'utilisateur sous Node 22/npm 10 sur VPS isolé le 2026-08-09. Voir
`LOT-4.2-AUDIT-STEP-6-ACCEPTANCE.md`.

### Étape 7 — validation finale du SHA

Exécuter avec Node >= 22 et npm >= 10 :

```text
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run validate:lot4
npm run validate:step2
npm run validate:step3
```

Compléter avec PostgreSQL isolé, Docker et Playwright. Reporter le SHA exact,
les résultats, les artefacts et tout contrôle non exécuté.

Statut : tous les contrôles ont réussi localement le 2026-08-10, dont ESLint 9,
75 tests, les trois validateurs API/PostgreSQL, les builds Docker, sept scénarios
Chromium dans l'image officielle et l'archive historique réextraite avec son
SHA-256. Les workflows GitHub CI, Docker et validation historique sont verts
sur `a5f716cc0b216e49fde9a58eb7515f8489fee2a7`. La recette VPS complète,
incluant les sept scénarios Chromium, a été confirmée par l'utilisateur le
2026-08-10 : étape fermée techniquement.
Voir `LOT-4.2-AUDIT-STEP-7-ACCEPTANCE.md`.

### Étape 8 — validation humaine

- [x] recette Windows complète préparée et reproductible ;
- [x] recette VPS Docker isolée réussie le 2026-08-10 ;
- [x] procédure garantissant qu'aucune production n'est ciblée ;
- [x] mise à jour de `PROJECT-STATUS.json`, `PROGRESS.json` et `CHANGELOG.md` ;
- [x] revalidation explicite des logos du Tableau de bord le 2026-08-10 ;
- [x] fusion après validation via la PR #25 le 2026-08-10.

La checklist humaine, les commandes et le nettoyage sont décrits dans
`LOT-4.2-AUDIT-STEP-8-ACCEPTANCE.md`.

## Règles de compte rendu

Après chaque étape, Codex doit indiquer :

- fichiers modifiés ;
- comportement avant/après ;
- tests ajoutés ;
- commandes réellement exécutées ;
- résultats exacts ;
- risques résiduels ;
- procédure de rollback ;
- pourcentage d'avancement de la remédiation.

Un build, une CI ou un déploiement technique ne suffit jamais à fermer une
exigence sans les preuves prévues par le présent plan.
