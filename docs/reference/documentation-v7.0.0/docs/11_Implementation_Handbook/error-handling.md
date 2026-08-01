# Gestion des erreurs

## Catégories
- validation ;
- authentification ;
- autorisation ;
- conflit ;
- ressource absente ;
- dépendance externe ;
- infrastructure ;
- erreur inattendue.

## Règles
- code stable ;
- message utilisateur compréhensible ;
- détail interne dans les logs uniquement ;
- correlationId ;
- aucune fuite de secret ;
- retry uniquement pour les erreurs rejouables.
