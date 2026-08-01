# Tests d’acceptation sécurité

- SEC-001 : route admin sans authentification → 401.
- SEC-002 : permission absente → 403.
- SEC-003 : aucun secret dans les logs.
- SEC-004 : URL vers réseau privé bloquée.
- SEC-005 : injection SQL sans effet.
- SEC-006 : webhook invalide rejeté.
- SEC-007 : webhook rejoué rejeté.
- SEC-008 : requête trop grande → 413.
- SEC-009 : secrets distincts par environnement.
- SEC-010 : restauration conserve audit et corrections.
- SEC-011 : conteneur non root.
- SEC-012 : base non publique.
- SEC-013 : changement de rôle audité.
- SEC-014 : certificat expiré bloqué.
- SEC-015 : rotation webhook avec chevauchement.
- SEC-016 : purge RGPD conforme.
- SEC-017 : session révoquée inutilisable.
- SEC-018 : dépendance critique bloque la livraison selon politique CI.
