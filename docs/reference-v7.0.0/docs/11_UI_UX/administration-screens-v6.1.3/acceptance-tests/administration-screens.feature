# language: fr
Fonctionnalité: Écrans d’administration v6.1.3
  Scénario: Restaurer une sauvegarde avec autorisation
    Étant donné un administrateur disposant de backup.restore
    Quand il confirme la restauration
    Alors une opération suivie est créée et auditée

  Scénario: Empêcher la suppression du dernier super-administrateur
    Étant donné un unique super-administrateur actif
    Quand son rôle critique est retiré
    Alors la demande est refusée

  Scénario: Enregistrer un paramètre sensible
    Quand un administrateur valide la modification
    Alors une confirmation forte est demandée et la modification est auditée

  Scénario: Exécuter un diagnostic
    Quand l’administrateur lance le diagnostic
    Alors chaque dépendance affiche un statut et un horodatage
