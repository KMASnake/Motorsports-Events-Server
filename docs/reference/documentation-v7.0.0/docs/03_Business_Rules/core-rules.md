# Règles métier v6.1

## Structure
- BR-001 : une discipline possède une identité stable et un code unique.
- BR-002 : un championnat appartient à une seule discipline.
- BR-003 : une catégorie appartient à un seul championnat et reste facultative.
- BR-004 : une saison appartient toujours à un championnat.
- BR-005 : une saison peut appartenir à zéro ou une catégorie.
- BR-006 : si `category_id` est renseigné, la catégorie doit appartenir au même championnat.
- BR-007 : une épreuve appartient à une seule saison.
- BR-008 : une session appartient à une seule épreuve.
- BR-009 : une entité référencée est archivée ou désactivée, jamais supprimée physiquement.

## Disciplines
- BR-010 : le référentiel initial contient exactement Automobile, Moto, Karting, Camion, Drift,
  Rallye Raid, Motocross et Speedway.
- BR-011 : les disciplines peuvent être désactivées mais leur code ne peut pas être recyclé.

## Catégories et saisons
- BR-020 : « Aucune catégorie » est la valeur par défaut lors de la création d'une saison.
- BR-021 : un championnat sans catégorie peut recevoir directement autant de saisons que nécessaire.
- BR-022 : aucune catégorie artificielle « principale » ou « générale » ne doit être créée.
- BR-023 : l'unicité d'une saison porte sur championnat + catégorie nullable + libellé.

## Fournisseurs et données manuelles
- BR-030 : chaque donnée importée conserve sa provenance technique.
- BR-031 : la provenance ou le nom du fournisseur n'apparaît jamais dans le texte public d'un événement.
- BR-032 : un objet canonique peut exister sans fournisseur avec une origine manuelle.
- BR-033 : un mapping fournisseur ajouté ultérieurement conserve l'identifiant canonique.
- BR-034 : une synchronisation est idempotente à données source identiques.
- BR-035 : une réponse partielle ne déclenche pas de suppression globale.

## Corrections
- BR-040 : une correction validée prime sur les observations fournisseurs.
- BR-041 : une correction cible un champ et conserve auteur, motif, date et statut.
- BR-042 : les corrections peuvent cibler discipline, championnat, catégorie, saison, épreuve ou session.
- BR-043 : une réversion crée une nouvelle décision auditée et ne détruit jamais l'historique.

## Sessions
- BR-050 : le mode « course uniquement » conserve courses principales et courses sprint.
- BR-051 : il exclut essais, warm-up et qualifications.
- BR-052 : une qualification sprint n'est pas une course sprint.
- BR-053 : les séances annulées suivent la politique de publication configurée.

## Audit
- BR-060 : toute modification canonique est auditée.
- BR-061 : un audit est immuable.
