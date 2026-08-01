# Migration vers v6.1

Cette procédure transforme un déploiement v5.8/v6.0 vers le modèle consolidé.

## Principes
- sauvegarde et test de restauration avant migration ;
- migration additive avant suppression ;
- aucune création automatique de catégorie ;
- compatibilité API temporaire si des clients utilisent encore `/rounds` ;
- validation des comptages et clés étrangères avant bascule.
