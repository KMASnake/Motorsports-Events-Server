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

> **Directive pour Codex :** jusqu'à la validation complète du jalon 4, aucune refonte graphique ou UX/UI ne doit être entreprise. Les modifications des pages web doivent uniquement servir les besoins techniques des fonctionnalités en cours. Le design sera traité dans une phase dédiée après la sortie de la version 2.7.0.

### Priorité 1 — Infrastructure
- [x] Intégrer Alembic pour les migrations.
- [x] Versionner toutes les migrations.
- [x] Vérifier automatiquement la version de schéma.

### Priorité 2 — Qualité
- [x] Ajouter des tests unitaires des providers.
- [x] Utiliser des mocks des API externes.
- [x] Mesurer la couverture de code.

### Priorité 3 — Base de données
- [x] Ajouter des tests d’intégration PostgreSQL via Docker.
- [x] Vérifier les migrations sur une base vierge et une base existante.
- [x] Ajouter des jeux de données de test.

### Priorité 4 — Administration
- [x] Modulariser l’administration sans refonte visuelle.
- [x] Ajouter un journal d’administration.

### Priorité 5 — Exploitation
- [x] Ajouter des logs structurés JSON.
- [x] Mettre en place la rotation des logs.
- [x] Automatiser et tester les sauvegardes/restaurations.
- [x] Vérifier automatiquement les prérequis avant les mises à niveau.

### Priorité 6 — Observabilité
- [x] Ajouter les endpoints /ready, /live et /metrics.
- [x] Préparer l’intégration Prometheus/Grafana.

### Priorité 7 — Releases
- [x] Renforcer le pipeline GitHub Actions.
- [x] Générer automatiquement les archives et SHA256.
- [x] Exécuter les tests avant toute release.

## Maintenance 2.7.x

La branche stable 2.7.x reste limitée aux correctifs de sécurité, de
fiabilité et d'exploitation. Elle ne reçoit aucune refonte visuelle ni
évolution incompatible de `/api/v1`.

- [ ] Contrôler la première sauvegarde quotidienne postérieure à la release.
- [ ] Revalider OCBlackTop après le renouvellement de son quota mensuel.
- [ ] Corriger uniquement les régressions confirmées en production.
- [ ] Publier toute correction par une release 2.7.x testée sur le VPS.

## Jalon 5 — Refonte de l'administration (3.0.0)

Objectif : rendre l'administration plus claire, cohérente, accessible et
utilisable sur mobile, sans exposer le fichier `.env`, sans affaiblir
l'authentification et sans modifier le contrat `/api/v1`.

### Phase 1 — Inventaire et conception

- [ ] Inventorier les pages, routes, formulaires, actions et états d'erreur.
- [ ] Décrire les parcours administrateur : exploitation, configuration,
  correction temporelle et audit.
- [ ] Définir l'identité visuelle, la navigation et les composants communs.
- [ ] Produire les maquettes desktop et mobile des écrans prioritaires.
- [ ] Choisir et intégrer l'outillage de tests navigateur et d'accessibilité.

### Phase 2 — Fondations de l'interface

- [ ] Créer un gabarit et une navigation partagés.
- [ ] Définir les styles, composants, états de chargement et messages communs.
- [ ] Ajouter les thèmes clair et sombre avec respect du choix système.
- [ ] Garantir navigation clavier, focus visible, contrastes et libellés.
- [ ] Préserver les URLs administratives et les protections existantes.

### Phase 3 — Refonte des écrans

- [ ] Refaire le tableau de bord et la synthèse de santé.
- [ ] Refaire les paramètres et le contrôle des providers.
- [ ] Refaire le traitement des incohérences temporelles.
- [ ] Refaire le journal d'administration.
- [ ] Intégrer sauvegardes, état des services et supervision dans les parcours
  d'exploitation, sans rendre Grafana ou Prometheus publics.

### Phase 4 — Qualification de la 3.0.0

- [ ] Tester les parcours critiques dans un navigateur réel.
- [ ] Tester les vues desktop, tablette et mobile.
- [ ] Vérifier accessibilité, authentification, cookies, CSRF et absence de
  secrets dans les réponses, pages, journaux et captures.
- [ ] Exécuter la non-régression complète du contrat `/api/v1`.
- [ ] Qualifier une release candidate sur le VPS avant la release stable.

Critère d'acceptation : tous les parcours administratifs sont cohérents,
responsifs et accessibles ; les actions sensibles restent authentifiées et
auditées ; aucun secret serveur ni contenu brut de `.env` n'est exposé ; le
contrat `/api/v1` reste compatible.

### Méthode de développement
- Développer par branches fonctionnelles (`feature/...`).
- Ouvrir une Pull Request par fonctionnalité.
- Tester chaque PR sur le VPS avant fusion.
- Ne jamais développer directement sur `main`.
- Utiliser ce dépôt GitHub comme source de vérité unique.
