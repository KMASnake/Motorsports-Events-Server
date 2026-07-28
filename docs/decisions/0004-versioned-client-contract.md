# ADR 0004 — Contrat client versionné

## Statut

Accepté pour le jalon 3.

## Décision

`/api/v1` est le contrat officiel des clients MyBB et Android. Les réponses
publiques sont décrites par des schémas explicites et testées par
non-régression.

La synchronisation différentielle accepte l'ancien paramètre `since` et
recommande un curseur opaque. Le curseur contient une position déterministe et
la limite de l'instantané, afin qu'une pagination ne perde pas deux mises à
jour portant le même horodatage.

## Compatibilité

- un champ existant n'est ni retiré ni renommé dans `/api/v1` ;
- un nouveau champ facultatif peut être ajouté ;
- une rupture nécessite `/api/v2` ;
- les clients ignorent les champs inconnus ;
- `deleted=true` représente une suppression logique.
