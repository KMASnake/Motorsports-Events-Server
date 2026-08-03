# ADR-0004-TIMEZONES

Statut : Accepté

## Décision

Le fuseau n'est ni saisi ni déduit. Le serveur normalise tous les événements en
UTC et conserve `timezone="UTC"` uniquement pour la compatibilité du contrat
existant. Une valeur fournisseur de fuseau n'est pas persistée comme donnée
administrable.

## Conséquences

Le formulaire ne présente aucun contrôle de fuseau. Au démarrage, les lignes
historiques sont normalisées en UTC et les corrections de fuseau devenues sans
objet sont supprimées. L'API publique conserve son champ `timezone` existant,
toujours égal à `UTC`.
