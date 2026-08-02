# ADR-0004-TIMEZONES

Statut : Accepté

## Décision

Le fuseau n'est pas saisi. Le serveur le déduit dans l'ordre depuis la donnée
fournisseur, le circuit, la ville puis le pays. En l'absence de toute donnée de
localisation, le repli déterministe est `UTC`.

Une création ou un changement de circuit recalcule le fuseau. Une ingestion
fournisseur peut fournir explicitement le fuseau source, qui reste prioritaire.

## Conséquences

Le formulaire peut afficher le fuseau en lecture seule mais ne le transmet pas
comme choix administrateur. Les dates continuent d'être stockées sous forme
normalisée et l'API publique conserve son champ `timezone` existant.
