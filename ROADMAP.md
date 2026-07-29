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

### Acquis de la version 2.6.0

- [x] Signaler les incohérences temporelles dans l’administration.
- [x] Permettre leur correction avec un override persistant après synchronisation.
- [x] Ajouter l’édition contrôlée du fichier `.env` depuis l’administration.
- [x] Protéger les paramètres PostgreSQL et conserver les secrets laissés vides.

Objectif : préparer une release 2.7.0 robuste, entièrement testée et facilement maintenable.

### Priorité 1 — Infrastructure

- [ ] Intégrer Alembic pour les migrations.
- [ ] Versionner toutes les migrations.
- [ ] Vérifier automatiquement la version de schéma.

### Priorité 2 — Qualité

- [ ] Ajouter des tests unitaires des providers (OCBlackTop, TheSportsDB et suivants).
- [ ] Utiliser des mocks des API externes.
- [ ] Mesurer la couverture de code.

### Priorité 3 — Base de données

- [ ] Ajouter des tests d’intégration PostgreSQL via Docker.
- [ ] Vérifier les migrations sur une base vierge et une base existante.
- [ ] Ajouter des jeux de données de test.

### Priorité 4 — Administration

- [ ] Modulariser l’administration (Configuration, Providers, Synchronisations, Diagnostics, Système).
- [ ] Ajouter un journal d’administration.

### Priorité 5 — Exploitation

- [ ] Ajouter des logs structurés JSON.
- [ ] Mettre en place la rotation des logs.
- [ ] Automatiser et tester les sauvegardes/restaurations.
- [ ] Vérifier automatiquement les prérequis avant les mises à niveau.

### Priorité 6 — Observabilité

- [ ] Ajouter les endpoints /ready, /live et /metrics.
- [ ] Préparer l’intégration Prometheus/Grafana.

### Priorité 7 — Releases

- [ ] Renforcer le pipeline GitHub Actions.
- [ ] Générer automatiquement les archives et SHA256.
- [ ] Exécuter les tests avant toute release.

### Méthode de développement

- Développer par branches fonctionnelles (`feature/...`).
- Ouvrir une Pull Request par fonctionnalité.
- Tester chaque PR sur le VPS avant fusion.
- Ne jamais développer directement sur `main`.
- Utiliser ce dépôt GitHub comme source de vérité unique.
