# Guide Codex — Implémentation base de données

## Autorisé
- Choisir PostgreSQL, MariaDB/MySQL ou une autre solution compatible avec les
  contraintes du projet.
- Créer les migrations initiales.
- Mapper les entités documentées.
- Implémenter les contraintes et index obligatoires.
- Ajouter les tests d'intégrité.

## À ne pas inventer
- Nouvelles entités métier.
- Nouveaux statuts publics.
- Politique de fusion.
- Règles de sécurité non documentées.

## Livrables attendus
- Diagramme généré depuis le schéma réel.
- Migrations réversibles lorsque possible.
- Jeu minimal de données de test.
- Tests d'intégration.
- Documentation des écarts entre modèle logique et implémentation.
