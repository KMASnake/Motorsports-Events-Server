# ADR 0002 — Le serveur est la source centrale

Le serveur récupère et conserve toutes les données disponibles.

Les préférences d’affichage et d’import restent côté client :

- sports ;
- saisons ;
- course uniquement ou toutes les séances ;
- séances annulées ;
- notifications ;
- calendrier cible.

Les corrections manuelles sont appliquées côté serveur afin que tous les
clients reçoivent la même donnée normalisée.
