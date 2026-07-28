# Architecture serveur

## Responsabilité

Le serveur central :

- interroge les providers ;
- importe toutes les épreuves et toutes les séances ;
- normalise les données ;
- conserve les données brutes et corrigées ;
- expose une API versionnée ;
- planifie les synchronisations.

Le serveur n’applique pas les préférences propres à MyBB ou Android.

## Clients externes

Le plugin MyBB et l’application Android sont des projets indépendants.

Ils utilisent les filtres de l’API :

- saison ;
- sports ;
- types de séances ;
- courses uniquement ;
- séances annulées ;
- périodes.

Les sprints sont classés comme courses. Sprint Qualifying reste une
qualification.
