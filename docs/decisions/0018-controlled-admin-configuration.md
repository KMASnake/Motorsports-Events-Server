# ADR 0018 — Configuration administrative contrôlée

## Statut

Accepté.

## Décision

Le contenu brut du fichier `.env` n’est jamais renvoyé par une route HTTP.
Les paramètres du serveur sont consultés et modifiés uniquement depuis la page
HTML authentifiée `/admin/settings` et son formulaire
`POST /admin/settings/config`.

Le formulaire utilise une liste explicite de paramètres autorisés. Les valeurs
secrètes ne sont jamais préremplies : une valeur vide conserve le secret
existant. Les paramètres PostgreSQL restent non modifiables depuis le Web.

La route protégée `/api/v1/admin/client-config` est conservée. Elle construit
un document destiné aux clients et peut contenir la clé API publique. Elle ne
lit ni ne renvoie le fichier `.env`, la clé administrateur, les clés des
providers, les identifiants PostgreSQL ou l’URL de la base.

## Conséquences

- aucune route de téléchargement ou de lecture brute du `.env` n’est ajoutée ;
- l’édition de la configuration reste accessible depuis l’administration Web ;
- l’API de configuration client reste compatible avec les clients existants ;
- toute extension de sa réponse doit être évaluée explicitement pour éviter
  l’exposition d’un secret serveur ;
- un redémarrage explicite reste nécessaire après une modification.
