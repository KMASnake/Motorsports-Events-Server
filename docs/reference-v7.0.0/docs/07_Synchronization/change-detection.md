# Détection des changements

## Niveau brut
Comparer `payload_hash`.

## Niveau normalisé
Comparer les champs normalisés.

## Niveau canonique
Comparer la valeur candidate à la valeur publiée, en tenant compte :
- des overrides ;
- de la précision de la source ;
- du statut de l'objet ;
- des décisions précédentes.

## Règle
Un changement purement technique du payload ne doit pas forcément déclencher
une publication.
