# ADR-0001-ADMINISTRATION-PHILOSOPHY

Statut : Accepté

## Décision

L'administration ordinaire accepte uniquement des données métier. Le slug,
l'origine, le fuseau, la clé fournisseur et l'identifiant externe ne sont ni
présentés dans le formulaire Événement ni acceptés dans ses mutations.

À la création, le serveur génère un slug unique et impose l'origine `manual`.
Une ingestion fournisseur distincte reçoit l'identité de source nécessaire,
génère l'origine `provider` et conserve le contrat public inchangé.

## Conséquences

Les clients d'administration ne peuvent pas convertir implicitement un
événement manuel en événement fournisseur. La duplication passe par une
nouvelle création métier et obtient automatiquement sa propre identité
technique.
