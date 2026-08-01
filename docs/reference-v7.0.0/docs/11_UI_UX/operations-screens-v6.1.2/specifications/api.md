# Écran API

## Objectif
Superviser l’API publique et administrer les clés d’accès sans exposer de secret complet après création.

## Structure
- KPI : disponibilité, requêtes 24 h, taux d’erreur, latence p95.
- Graphe de trafic par statut HTTP.
- Tableau des clés : libellé, préfixe, propriétaire, scopes, dernière utilisation, expiration, statut.
- Zone documentation : version active, URL de base, lien OpenAPI, changelog.

## Règles de sécurité
- Le secret d’une clé n’est affiché qu’une seule fois à la création.
- Révocation immédiate et irréversible après confirmation.
- Rotation : création d’une nouvelle clé avec période de chevauchement configurable.
- Scopes explicites, principe du moindre privilège.
- Les journaux n’enregistrent jamais les secrets ou en-têtes d’autorisation.

## États
API opérationnelle, dégradée ou indisponible ; clé active, expirant bientôt, expirée, révoquée ; quota proche ou dépassé.
