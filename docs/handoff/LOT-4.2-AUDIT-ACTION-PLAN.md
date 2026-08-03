# Plan d'action Codex — audit du lot 4.2

## Statut

- audit de référence : `LOT-4.2-CODE-AUDIT-2026-08-03.md` ;
- décision : `CHANGES REQUESTED` ;
- fusion dans `main` : interdite ;
- nouvelle fonctionnalité : interdite tant que les P1 restent ouverts ;
- validation utilisateur globale du lot 4.2 : non acquise.

## Ordre de travail obligatoire

### Étape 1 — migration et sécurité du démarrage

- [ ] retirer de `ensureApplicationSchema()` toute suppression ou réécriture de
  données métier ;
- [ ] créer une migration versionnée pour `event_corrections` et l'UTC ;
- [ ] définir une stratégie non destructive pour les anciennes corrections de
  fuseau horaire ;
- [ ] fournir et tester le rollback ;
- [ ] tester base vierge, base existante et redémarrages successifs.

Preuves attendues : migration, tests PostgreSQL, commandes exécutées et résultat
montrant qu'un second démarrage ne modifie aucune donnée.

### Étape 2 — typage des corrections

- [ ] remplacer `z.unknown()` par une validation dépendant de `field_name` ;
- [ ] couvrir chaînes, booléens, dates UTC, statuts, références et valeurs
  nulles autorisées ;
- [ ] vérifier les références championnat et circuit ;
- [ ] retourner `400` avant tout accès SQL pour une valeur incompatible ;
- [ ] ajouter les tests de chaque type et de chaque rejet.

### Étape 3 — sécurité des routes administratives

- [ ] vérifier l'ordre d'enregistrement du hook d'authentification ;
- [ ] tester `401` sans authentification ;
- [ ] tester `403` sans rôle administrateur ;
- [ ] tester le succès avec un administrateur ;
- [ ] tester les jetons invalides et expirés ;
- [ ] couvrir événements, ingestion fournisseur et corrections.

### Étape 4 — API, pagination et audit

- [ ] ajouter une pagination serveur aux événements et corrections ;
- [ ] appliquer tri et filtres avant pagination ;
- [ ] valider tous les paramètres de requête avec Zod ;
- [ ] raccorder toutes les mutations au journal d'administration ;
- [ ] préserver acteur, ancienne valeur, nouvelle valeur et identifiant de
  requête sans enregistrer de secret ;
- [ ] vérifier ou ajouter l'unicité `(provider_key, external_id)` ;
- [ ] séparer clairement ingestion technique et création administrative.

### Étape 5 — concurrence et interactions calendrier

- [ ] tester deux résolutions simultanées ;
- [ ] tester synchronisation fournisseur et modification administrateur
  simultanées ;
- [ ] vérifier le rollback transactionnel après erreur ;
- [ ] compléter création par plage et redimensionnement visuel ;
- [ ] tester le rollback visuel des déplacements et redimensionnements ;
- [ ] couvrir événements traversant minuit et changements heure d'été/hiver.

### Étape 6 — dépendances

- [ ] identifier les deux avis npm de sévérité élevée ;
- [ ] consigner paquet, GHSA/CVE, dépendance directe ou transitive, exposition,
  version corrigée et impact de mise à niveau ;
- [ ] corriger ou documenter une exception temporaire datée et justifiée.

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

### Étape 8 — validation humaine

- [ ] recette Windows complète ;
- [ ] recette VPS Docker isolée ;
- [ ] confirmation qu'aucune production n'a été modifiée ;
- [ ] mise à jour de `PROJECT-STATUS.json`, `PROGRESS.json` et `CHANGELOG.md` ;
- [ ] validation explicite de l'utilisateur ;
- [ ] fusion seulement après cette validation.

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
