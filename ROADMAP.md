# Feuille de route du serveur

## Jalon 1 — Refonte du socle

- [x] Créer un dépôt serveur autonome.
- [x] Importer la base 2.4.0 validée sur VPS.
- [x] Retirer le plugin MyBB et Android du dépôt.
- [x] Ajouter la validation reproductible du dépôt.
- [x] Ajouter les décisions d’architecture.
- [ ] Séparer domaine, providers, persistance et API.
- [ ] Ajouter Alembic.
- [ ] Ajouter des tests unitaires providers.
- [ ] Ajouter des tests d’intégration PostgreSQL.
- [ ] Stabiliser OpenAPI v1.
- [ ] Fiabiliser les releases et mises à niveau.

## Jalon 2 — Stabilisation

- Administration modulaire.
- Logs structurés.
- Sauvegardes automatisées.
- Migrations testées.
- Observabilité.

## Jalon 3 — Contrats clients

- Documentation MyBB.
- Documentation Android.
- Synchronisation différentielle.
- Politique de compatibilité API.
