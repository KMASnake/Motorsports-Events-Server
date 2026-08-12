# ADR-0015 — Scheduler de synchronisation persistant

Date : 2026-08-12  
Statut : accepté pour le Lot 5.4, validation mainteneur de l'implémentation requise

## Décision

Le scheduler partage son état par PostgreSQL. Chaque lien fournisseur possède
deux flux physiques, `current` et `historical`; le second porte les classes
logiques `recent_catchup` et `deep_history`. L'ordonnancement global pondéré
utilise par défaut le ratio 3/2/1 et redistribue la capacité inutilisée.

Le travail est protégé par un lease persistant de 120 secondes, renouvelé par
heartbeat toutes les 30 secondes environ, et par une génération monotone de
fencing. Une génération expirée ou remplacée ne peut jamais valider de résultat.
Résultat durable, curseur, état du flux et résultat d'exécution sont atomiques.

Le pool global vaut quatre workers par défaut et respecte également la limite
de concurrence de chaque fournisseur. La fenêtre courante est glissante sur
sept jours par défaut. Un changement d'année alimente le rattrapage récent sans
perdre le curseur d'historique profond.

## Limites

Le Lot 5.4 ne réalise aucune ingestion complète d'événements fournisseur et
n'implémente pas le moteur de quotas/cadences réservé au Lot 5.5.

## Conséquences

Les commandes activation, pause, reprise, reset ciblé et sync-now sont auditées.
La désactivation conserve données et curseurs. La reprise après crash repart du
dernier curseur validé et marque l'exécution abandonnée comme interrompue.
