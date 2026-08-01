# Guide Codex — API

Codex peut :
- générer les DTO depuis OpenAPI ;
- créer les contrôleurs ;
- implémenter pagination, filtres et tri ;
- normaliser les erreurs ;
- écrire les tests de contrat ;
- générer un client API.

Contraintes :
- aucun payload fournisseur dans l'API publique ;
- aucun champ public sans mise à jour OpenAPI ;
- aucun filtre invalide ignoré ;
- codes d'erreur stables ;
- identifiant de corrélation obligatoire ;
- respect de l'idempotence.
