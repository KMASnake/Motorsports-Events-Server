# Tests d'acceptation — données

## DB-001
Créer deux saisons portant le même libellé dans un même championnat doit échouer.

## DB-002
Créer une séance dont la fin précède le début doit échouer.

## DB-003
Deux observations identiques d'un même fournisseur ne doivent pas créer deux
versions logiquement distinctes.

## DB-004
Une correction active sur un champ empêche la valeur fournisseur de remplacer
la valeur canonique de ce champ.

## DB-005
Archiver un fournisseur ne supprime ni ses observations ni ses synchronisations.

## DB-006
Un snapshot publié reste identique après une correction ultérieure.

## DB-007
Une entrée d'audit ne peut être modifiée via les services applicatifs standards.
