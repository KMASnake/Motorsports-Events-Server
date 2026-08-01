# Contrat d'adaptateur fournisseur v6.1

Un adaptateur fournit : identifiant externe, type d'entité, données brutes, pagination, horodatage et
statut de complétude. Les types pris en charge sont discipline, championship, category, season,
event et session.

L'adaptateur peut omettre `category`; le normaliseur conserve alors `categoryId = null`.
