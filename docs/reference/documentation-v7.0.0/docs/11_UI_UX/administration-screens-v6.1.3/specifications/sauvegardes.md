# Écran Sauvegardes

## Objectif
Administrer les politiques, exécutions, restaurations et tests de sauvegarde.

## Actions
- lancer une sauvegarde manuelle ;
- consulter l’historique ;
- restaurer après confirmation forte ;
- tester périodiquement les restaurations ;
- gérer rétention et destinations.

## États
Chargement, vide, sauvegarde en cours, réussite, partielle, échec, restauration en cours, permission refusée.

## Sécurité
La restauration exige le rôle `backup.restore`, une confirmation textuelle et une entrée d’audit.
