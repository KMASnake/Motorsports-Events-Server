# Checklist de migration

- [ ] huit disciplines présentes et codes uniques ;
- [ ] tous les championnats ont une discipline ;
- [ ] toutes les saisons ont un championnat ;
- [ ] les saisons historiques sans catégorie ont `category_id = null` ;
- [ ] aucune catégorie n'est rattachée au mauvais championnat ;
- [ ] nombres d'épreuves et sessions identiques avant/après ;
- [ ] OpenAPI v6.1 validée ;
- [ ] tests F1 sans catégorie et Moto2 avec catégorie réussis ;
- [ ] création manuelle et mapping ultérieur réussis ;
- [ ] sauvegarde et procédure de restauration validées.
