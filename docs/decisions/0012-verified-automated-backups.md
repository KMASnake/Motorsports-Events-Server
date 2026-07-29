# ADR 0012 — Sauvegardes automatisées et vérifiées

## Statut

Accepté.

## Décision

Une sauvegarde quotidienne est déclenchée par un timer systemd persistant.
Chaque export PostgreSQL est écrit dans un fichier temporaire, compressé,
validé, puis renommé atomiquement. Avant d’être accepté, il est restauré dans
une base jetable et doit contenir au moins une table publique.

Les sauvegardes sont privées (`0600`) et conservées 30 jours par défaut. La
durée peut être ajustée avec `BACKUP_RETENTION_DAYS`.

Une restauration de production vérifie d’abord l’archive dans une base
temporaire. L’API et le scheduler sont redémarrés même si la restauration
échoue.

## Conséquences

- une archive corrompue n’est jamais annoncée comme sauvegarde réussie ;
- une sauvegarde syntaxiquement valide mais non restaurable est refusée ;
- un VPS éteint à l’heure prévue rattrape le timer au redémarrage ;
- PostgreSQL doit disposer temporairement de l’espace nécessaire à une seconde
  copie de la base ;
- le contrat API et le schéma de production restent inchangés.
