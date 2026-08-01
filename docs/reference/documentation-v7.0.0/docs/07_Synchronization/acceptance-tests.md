# Acceptation synchronisation v6.1

- une saison F1 importée sans catégorie possède `category_id = null` ;
- une saison Moto2 est liée à la catégorie Moto2 du championnat MotoGP ;
- une catégorie d'un autre championnat est rejetée ;
- un objet créé manuellement peut recevoir un mapping fournisseur sans changer d'identifiant ;
- une réponse partielle ne supprime aucune branche complète ;
- une seconde synchronisation identique ne crée aucun doublon ;
- aucun nom de fournisseur n'apparaît dans la description publique.
