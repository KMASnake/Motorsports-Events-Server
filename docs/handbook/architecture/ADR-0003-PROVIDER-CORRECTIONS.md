# ADR-0003 — Corrections fournisseur transactionnelles

Statut : Accepté

Date de précision : 2026-08-03

## Contexte

Une donnée fournisseur modifiée localement doit conserver simultanément la
source reçue, la valeur locale et la valeur effective. Une synchronisation
concurrente ne doit ni écraser l'override ni confondre l'ancienne valeur locale
avec la source fournisseur.

## Décision

Une correction existe uniquement pour un champ fournisseur modifié localement.
La correction stocke séparément `provider_value` et `override_value`. Toute
édition, synchronisation ou résolution verrouille l'événement et ses
corrections dans une transaction PostgreSQL.

Lors d'une synchronisation :

- sans override, la nouvelle source devient la valeur effective ;
- avec override, la source est actualisée et l'override reste effectif ;
- si la source change sous l'override, la correction passe en conflit ;
- si la source rejoint l'override, la correction devenue inutile est supprimée.

Un événement manuel ne crée pas de correction et refuse une synchronisation
fournisseur. L'API publique ne reçoit que la valeur effective.

## Conséquences

Toutes les mutations de corrections passent par le même service transactionnel.
L'ordre de verrouillage événement puis correction est constant pour limiter les
interblocages. Les anciennes lignes résolues peuvent être réactivées proprement
sans migration destructive.

La page d'exploitation combine les filtres événement, championnat,
fournisseur, champ, statut, conflit, auteur, période et nombre de champs. Une
modification locale passe par la même résolution transactionnelle. L'ouverture
de l'événement transmet son identifiant à la page Événements, qui sélectionne
le panneau de détail correspondant sans exposer de métadonnée dans l'API
publique.
