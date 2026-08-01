# Verrouillage et concurrence

## Verrou recommandé
Verrou distribué par `(providerId, scope)`.

## Règles
- durée limitée avec renouvellement ;
- propriétaire identifiable ;
- libération en fin normale ;
- expiration après crash ;
- aucune dépendance à un verrou local en mémoire en production multi-instance.

## Concurrence
Deux fournisseurs différents peuvent être traités en parallèle. Deux runs du
même fournisseur peuvent l'être uniquement si leurs périmètres sont disjoints
et que l'adaptateur le déclare sûr.
