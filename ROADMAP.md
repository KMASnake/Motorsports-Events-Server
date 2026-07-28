# Feuille de route du serveur

## Jalon 1 — Dépôt serveur autonome

- [x] Créer un dépôt serveur autonome.
- [x] Importer la base 2.4.0 validée sur VPS.
- [x] Retirer le plugin MyBB et Android du dépôt.
- [x] Ajouter la validation reproductible du dépôt.
- [x] Ajouter les décisions d’architecture.

## Jalon 2 — Séparation interne

- [x] Séparer domaine, application, persistance et API.
- [x] Conserver les façades de compatibilité.
- [x] Ajouter les tests métier et les tests de filtres.

## Jalon 3 — Contrats clients

- [x] Stabiliser les schémas OpenAPI v1.
- [x] Documenter MyBB.
- [x] Documenter Android.
- [x] Fiabiliser la synchronisation différentielle.
- [x] Formaliser la politique de compatibilité API.
- [x] Tester les champs JSON publics et les curseurs.

## Jalon 4 — Stabilisation opérationnelle

- [ ] Ajouter Alembic.
- [ ] Ajouter des tests unitaires providers.
- [ ] Ajouter des tests d’intégration PostgreSQL.
- [ ] Modulariser l’administration.
- [ ] Ajouter des logs structurés.
- [ ] Automatiser et tester les sauvegardes.
- [ ] Ajouter l’observabilité.
- [ ] Fiabiliser davantage les releases et mises à niveau.
