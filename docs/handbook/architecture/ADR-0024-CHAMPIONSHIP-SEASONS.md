# ADR-0024 — Identité canonique ChampionshipSeason

Statut : candidat F5-2, en attente de validation mainteneur

## Décision

`Championship` représente une série permanente. `ChampionshipSeason` représente
une édition de cette série et possède un UUID stable persisté, scoped au
`Championship`. Sa `key` est un handle machine stable, immuable après création,
et n'est unique qu'à l'intérieur de ce scope.

L'année, le label et les dates sont des métadonnées modifiables, jamais des
composants d'identité. Le modèle accepte notamment les saisons transannuelles,
les labels commerciaux et plusieurs éditions d'un même championnat partageant
une année.

`meetings.championship_season_id` est un lien nullable et additif. Une clé
étrangère composite garantit qu'un Meeting ne peut référencer qu'une édition de
son propre Championship. Les colonnes entières legacy `championships.season` et
`meetings.season` restent inchangées.

## Bornes F5-2

- aucun backfill automatique ;
- aucune double écriture ;
- aucun changement du matching Meeting/Event, de la normalisation, des
  checksums, des révisions ou de la publication ;
- aucune identité ou découverte de saison provider ;
- aucune API publique ;
- l'association provider-season est différée à une phase autorisée ultérieure.

Les futurs standings et résultats référenceront l'UUID ChampionshipSeason,
sans modifier l'identité canonique stable des Meetings et Events.
