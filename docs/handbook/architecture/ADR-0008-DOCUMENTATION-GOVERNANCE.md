# ADR-0008 — Gouvernance documentaire

Statut : Accepté

Date : 2026-08-02

## Contexte

Le dépôt contient des décisions historiques, des documents de passation et des
spécifications de lots. Sans hiérarchie explicite, leur coexistence peut créer
des instructions concurrentes ou faire passer un état technique pour une
validation utilisateur.

## Décision

`PROJECT-HANDBOOK.md` est la source de vérité des règles permanentes.
`docs/handbook/` contient leurs décisions et ADR. `docs/handoff/` conserve les
règles et l'avancement propres au lot courant. `docs/handover/` et les autres
documents historiques sont conservés comme contexte et preuves, mais ne
peuvent pas remplacer une règle permanente plus récente.

`PROJECT-STATUS.json` sépare la dernière version validée de la version en
développement. `docs/handoff/PROGRESS.json` est le suivi canonique du lot
courant. Lorsqu'un miroir historique de ce fichier subsiste, il indique le
chemin canonique et ne devient pas une seconde source de vérité.

Une fusion dans `main`, une CI verte, un build ou un déploiement technique ne
constitue pas une validation utilisateur. Celle-ci doit être explicite et
consignée avec son périmètre.

## Conséquences

Toute nouvelle décision permanente met à jour le Handbook, le journal des
décisions, le changelog du Handbook et un ADR. Les documents spécifiques aux
lots restent dans `docs/handoff/` et la documentation existante n'est pas
supprimée lors de l'intégration du Handbook.
