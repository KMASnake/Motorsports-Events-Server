# ADR 0019 — Cadrage de la refonte administrative 3.0

## Statut

Accepté.

## Contexte

Le jalon 4 a stabilisé l'exploitation du serveur et la version 2.7.0 est
publiée. L'administration couvre désormais la configuration contrôlée, les
providers, les incohérences temporelles, l'audit et plusieurs fonctions
d'exploitation, mais son interface n'a pas encore fait l'objet d'une
conception globale.

Une refonte purement visuelle sans inventaire préalable risquerait de masquer
des actions, de modifier involontairement les contrats ou d'affaiblir les
protections déjà validées.

## Décision

La version 3.0.0 est dédiée à une refonte progressive de l'administration.
Elle commence par l'inventaire des pages, routes, actions, formulaires, états
et parcours, puis par des maquettes desktop et mobile avant l'implémentation.

La refonte doit :

- fournir une navigation et des composants cohérents ;
- prendre en charge les thèmes clair et sombre ;
- être responsive et accessible au clavier ;
- couvrir le tableau de bord, les paramètres, les providers, les
  incohérences temporelles, l'audit et les fonctions d'exploitation ;
- conserver les URLs administratives lorsqu'aucune migration explicite n'est
  décidée ;
- conserver le contrat `/api/v1` et traiter toute incompatibilité éventuelle
  dans une future `/api/v2` ;
- conserver l'authentification, l'audit et les protections des actions
  sensibles ;
- ne jamais exposer le fichier `.env` brut ou un secret serveur ;
- conserver `/api/v1/admin/client-config` sous authentification conformément
  à l'ADR 0018 ;
- séparer les changements visuels des changements fonctionnels dans les pull
  requests.

Les parcours critiques seront couverts par des tests navigateur. La
qualification inclura les vues desktop et mobile, l'accessibilité, les
protections CSRF, la non-exposition des secrets et la non-régression de
`/api/v1`.

## Conséquences

La première livraison du jalon 5 est documentaire : inventaire, parcours,
outillage de test et maquettes. Aucun framework d'interface n'est retenu avant
cet inventaire.

La 2.7.x reste une ligne de maintenance et ne reçoit pas la refonte. La 3.0.0
peut modifier l'apparence et l'organisation de l'administration, mais pas les
contrats publics sans décision distincte.
