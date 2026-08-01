# Seuils de performance proposés

Ces seuils doivent être confirmés avant production :

- API publique p95 < 500 ms hors dépendance externe ;
- API administration p95 < 800 ms ;
- taux d'erreur serveur < 1 % en charge nominale ;
- aucune fuite mémoire significative sur test d'endurance ;
- synchronisation incrémentale terminée dans la fenêtre planifiée ;
- absence de saturation durable des files.

Les seuils finaux doivent être paramétrables par environnement.
