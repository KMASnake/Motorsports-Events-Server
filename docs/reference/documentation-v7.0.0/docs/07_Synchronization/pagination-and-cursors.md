# Pagination et curseurs

## Modes supportés
- page/limit ;
- offset/limit ;
- curseur opaque ;
- date de dernière modification ;
- liste complète sans pagination.

## Persistance de progression
Le run conserve :
- page ou curseur courant ;
- dernière page confirmée ;
- date du dernier enregistrement ;
- compteur traité ;
- empreinte de la dernière réponse.

## Reprise
Après incident, reprendre à partir du dernier point confirmé, sans retraiter
inutilement les pages déjà validées.
