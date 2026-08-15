# Lot 5.6-B — Corrections après audit mainteneur

Date : 2026-08-15
Statut : **CORRIGÉ — RÉ-AUDIT MAINTENEUR REQUIS**

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

La documentation officielle confirme que v1 authentifie par une clé dans le
chemin et que v2 utilise `X-API-KEY`. Tous les appels du nouvel adaptateur sont
donc forcés vers les endpoints v2 officiels, sans secret dans l’URL. La v2 est
réservée aux abonnements compatibles ; une installation limitée à la clé v1
gratuite devra obtenir un accès v2 plutôt que contourner ADR-0016.

## P2 — Cursor invalid

Les statuts HTTP génériques ne sont plus interprétés comme une invalidation.
Le résultat `cursor_invalid` et son restart saison nécessitent une preuve
fournisseur explicite et non vide. Aucun endpoint actuel n’invente une telle
preuve lorsqu’elle n’est pas documentée.

## Gate

STOP avant 5.6-C. Le Lot 5.6 global reste non validé et non fusionnable,
`authorized_sub_lot` reste `5.6`, et les Lots 5.7+ restent interdits.
