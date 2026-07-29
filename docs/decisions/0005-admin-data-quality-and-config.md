# ADR 0005 — Qualité temporelle et configuration administrable

## Statut

Accepté pour la version 2.6.0.

## Décision

L'administration signale les séances dont `end_at < start_at`. Une correction
validée :

- met immédiatement à jour la séance normalisée ;
- incrémente sa version ;
- crée ou complète un override ;
- reste donc appliquée lors des synchronisations suivantes.

Le serveur ne corrige jamais automatiquement une date incohérente sans action
administrateur.

Le fichier `.env` peut être édité depuis la page Paramètres. Seul ce fichier
est monté en écriture dans le conteneur API. Les secrets sont masqués et une
valeur secrète vide conserve la valeur actuelle.

## Restrictions

- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` et `DATABASE_URL` ne sont
  pas modifiables depuis le Web ;
- toutes les valeurs éditables sont validées avant écriture ;
- le fichier conserve le mode `0600` ;
- un redémarrage explicite est nécessaire pour appliquer les changements ;
- le conteneur n'accède pas au socket Docker et ne se redémarre pas lui-même.

## Raisons

Modifier les identifiants PostgreSQL sans migration coordonnée pourrait rendre
la base inaccessible. Donner au conteneur API l'accès au socket Docker
équivaudrait pratiquement à lui donner les privilèges root de l'hôte.
