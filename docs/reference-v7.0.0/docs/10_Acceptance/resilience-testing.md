# Tests de résilience

Injecter :
- timeout fournisseur ;
- réponse 429 ;
- réponse partielle ;
- schéma invalide ;
- crash worker ;
- perte temporaire de base ;
- file indisponible ;
- espace disque faible ;
- expiration de verrou ;
- redémarrage de service ;
- certificat invalide.

Vérifier :
- absence de corruption ;
- reprise au checkpoint ;
- aucun doublon ;
- alertes ;
- statut cohérent ;
- audit ;
- restauration du service.
