# Audit technique du lot 4.2 — 3 août 2026

## Décision

La branche `codex/lot-4.2-complete` ne doit pas être fusionnée dans `main` en
l'état. La base fonctionnelle est avancée, mais les points P1 ci-dessous sont
bloquants. Codex doit les corriger dans l'ordre indiqué, sans déclarer le lot
terminé avant validation technique reproductible puis validation utilisateur.

## P1 — corrections bloquantes

### P1.1 — retirer les écritures destructives du démarrage API

Constat dans `apps/api/src/lib/db.ts` : `ensureApplicationSchema()` crée la
table puis exécute systématiquement :

```sql
delete from event_corrections where field_name='timezone';
update events set timezone='UTC' where timezone is distinct from 'UTC';
```

Ces écritures ne doivent pas être effectuées au démarrage de l'application.

Travail attendu :

- créer une migration versionnée et idempotente pour `event_corrections` ;
- migrer les fuseaux horaires de façon explicite et traçable ;
- ne supprimer aucune correction existante sans stratégie de migration ;
- fournir une procédure de rollback ;
- ajouter des tests base vierge, base existante et redémarrage multiple ;
- faire de `ensureApplicationSchema()` une vérification non destructive, ou la
  supprimer au profit du mécanisme de migration officiel.

Critère d'acceptation : deux démarrages successifs de l'API ne modifient aucune
donnée métier et la migration est testée sur PostgreSQL isolé.

### P1.2 — obtenir une CI verte liée au SHA exact

Aucun statut GitHub exploitable n'est actuellement attaché à la tête auditée.
Les résultats inscrits dans `PROJECT-STATUS.json` ne remplacent pas une preuve
CI.

Travail attendu :

- exécuter avec Node >= 22 et npm >= 10 ;
- lancer `npm ci`, typecheck, lint, tests, builds et validations Lot 4 ;
- exécuter les tests PostgreSQL et Playwright dans des environnements isolés ;
- publier les rapports et artefacts en cas d'échec ;
- consigner le SHA, les commandes et les résultats dans les fichiers de suivi.

Critère d'acceptation : tous les contrôles requis sont verts sur le dernier SHA
de la branche, sans étape ignorée.

### P1.3 — prouver la protection des routes d'administration

Routes concernées notamment :

- `/api/v1/admin/events*` ;
- `/api/v1/admin/provider-events` ;
- `/api/v1/admin/corrections*`.

Travail attendu :

- vérifier que le hook d'authentification est enregistré avant toutes les
  routes administratives ;
- tester `401` sans authentification ;
- tester `403` pour un utilisateur non administrateur ;
- tester le succès pour un administrateur ;
- tester un jeton invalide ou expiré ;
- vérifier qu'aucune route sensible n'est publiquement accessible.

Critère d'acceptation : une suite d'intégration couvre explicitement chaque
famille de routes d'administration.

### P1.4 — typer les valeurs des corrections

Constat dans `apps/api/src/routes/corrections.ts` : `override_value` est validé
avec `z.unknown()` puis appliqué selon `field_name`.

Travail attendu :

- définir un schéma Zod par champ corrigible ;
- valider chaînes, booléens, dates, statuts, références et valeurs nulles ;
- répondre `400` avant toute requête SQL en cas de type invalide ;
- vérifier les références championnat et circuit ;
- tester chaque type de champ et les erreurs attendues.

Critère d'acceptation : aucune valeur JSON arbitraire ne peut atteindre une
colonne métier incompatible.

## P2 — durcissements obligatoires avant publication

### API et données

- ajouter une pagination serveur aux événements et aux corrections ;
- valider les paramètres de filtre avec Zod ;
- ajouter ou vérifier l'unicité `(provider_key, external_id)` ;
- séparer l'ingestion fournisseur des actions administratives ordinaires ;
- ne pas permettre au client de fabriquer librement son identité fournisseur ;
- raccorder créations, synchronisations et résolutions au journal d'audit ;
- documenter ou déprécier l'action redondante `delete-override` ;
- remplacer les comparaisons génériques par `JSON.stringify` par des
  normalisations typées ;
- préserver la distinction entre champ absent et valeur `null` dans les PATCH.

### Tests

Ajouter au minimum :

- création, mise à jour, conflit et convergence d'une correction ;
- événement manuel non corrigé comme événement fournisseur ;
- concurrence administrateur/fournisseur ;
- concurrence entre deux résolutions ;
- rollback transactionnel après erreur ;
- suppression en cascade ;
- rejet des valeurs et références invalides ;
- rollback visuel des déplacements et redimensionnements du calendrier ;
- création par plage ;
- passages heure d'été/hiver et stockage UTC ;
- pagination et tri avant pagination.

### Dépendances

`PROJECT-STATUS.json` signale deux avis npm de sévérité élevée. Pour chacun,
consigner : paquet, avis GHSA/CVE, dépendance directe ou transitive, exposition
en production, version corrigée, impact de la mise à niveau et décision.

## Éléments déjà satisfaisants à préserver

- transactions avec commit/rollback et libération du client ;
- verrouillage PostgreSQL `FOR UPDATE` pour les opérations concurrentes ;
- requêtes SQL paramétrées ;
- liste blanche des colonnes corrigibles ;
- séparation initiale entre politique de correction, accès aux données et
  routes ;
- principe non destructif des surcharges locales face aux changements du
  fournisseur ;
- suppression automatique d'une surcharge lorsque les valeurs convergent.

## Ordre d'exécution imposé à Codex

1. P1.1 migration et suppression des écritures destructives ;
2. P1.4 validation typée des corrections ;
3. P1.3 tests de sécurité des routes administratives ;
4. pagination, validation des filtres et audit des mutations ;
5. tests concurrence, rollback et calendrier ;
6. analyse des dépendances npm ;
7. CI complète sur le SHA final ;
8. mise à jour de `PROJECT-STATUS.json`, `docs/handoff/PROGRESS.json`,
   `NEXT_STEPS.md` et `CHANGELOG.md` ;
9. validation Windows puis VPS isolé ;
10. validation utilisateur avant toute fusion.

## Livrables attendus de Codex

- code corrigé ;
- migrations et rollback ;
- tests unitaires, intégration PostgreSQL et Playwright ;
- compte rendu des commandes réellement exécutées ;
- liste des fichiers modifiés ;
- résultats CI associés au SHA ;
- écarts résiduels clairement déclarés ;
- aucun changement direct sur la production ;
- aucune fusion dans `main` sans validation utilisateur.

## Statut de l'audit

- branche auditée : `codex/lot-4.2-complete` ;
- base comparée : `main` ;
- date : 2026-08-03 ;
- décision : `CHANGES REQUESTED` ;
- fusion autorisée : non.
