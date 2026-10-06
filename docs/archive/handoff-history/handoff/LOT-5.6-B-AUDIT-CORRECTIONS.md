# Lot 5.6-B — Corrections après audit mainteneur

Date : 2026-08-15
Statut : **CANDIDAT VALIDABLE PAR LE MAINTENEUR**

## P1 — OCBlackTop / WRC

La référence historique du dépôt et la documentation OCBlackTop établissent
`/wrc/seasons/{year}`. Le catalogue sélectionne désormais
`season-rallies-v1` avec `/{series}/seasons/{year}`. Le dispatch dépend
uniquement de la stratégie source validée ; WRC n’est ni un adaptateur ni une
branche du cœur générique.

## P1 — Complétude

La hiérarchie est : `has_next_page`, `next_page`, puis `total_pages`. Une page
vide ne constitue aucune preuve autonome. Une prochaine page explicite est
suivie même si la collection courante est vide ; les contradictions arrêtent
le flux avec `pagination_inconsistent` et `complete=false`.

## P1 — TheSportsDB / AC-5.6-161

Le mainteneur décide de conserver v1 et accepte explicitement l’apparition de
la clé gratuite dans le segment de chemin imposé. ADR-0020 borne cette exception
à TheSportsDB v1. La clé et l’URL complète restent interdites dans toute surface
observable hors appel réseau.

## P2 — Cursor invalid

Les statuts HTTP génériques ne sont plus interprétés comme une invalidation.
Le résultat `cursor_invalid` et son restart saison nécessitent une preuve
fournisseur explicite et non vide. Aucun endpoint actuel n’invente une telle
preuve lorsqu’elle n’est pas documentée.

## P2 — Stratégie TheSportsDB v2 fantôme

`league-season-v1` est désormais la seule stratégie acceptée. La valeur
`league-season-v2` n’est ni normalisée ni anticipée : elle est refusée comme
toute stratégie inconnue. Les modèles endpoint et identifiants non numériques
restent également refusés.

## Gate

STOP avant 5.6-C. Le Lot 5.6 global reste non validé et non fusionnable,
`authorized_sub_lot` reste `5.6`, et les Lots 5.7+ restent interdits.
