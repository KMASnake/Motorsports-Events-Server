# Lot 5.3 — Critères d'acceptation Découverte et source config

Date : 2026-08-12

Statut : concept validé, implémentation autorisée après validation 5.2

## Critères fonctionnels

- vrais adaptateurs OCBlackTop et TheSportsDB ;
- WRC reste OCBlackTop avec stratégie/source config distincte si nécessaire ;
- aucune logique générique codée en dur sur `WRC` ;
- aucune découverte ne crée automatiquement un championnat métier ;
- résultats non associés persistés séparément des `provider_championships` ;
- association manuelle vers un championnat existant ou création explicite d'un nouveau championnat ;
- plusieurs fournisseurs peuvent être associés au même championnat local ;
- un seul fournisseur principal actif en V1 ;
- `source_config` proposée conservée séparément de la configuration validée ;
- redécouverte n'écrase jamais automatiquement la configuration active ;
- action explicite `Adopter la configuration découverte`, auditée ;
- adoption de config ne déclenche aucune synchronisation ;
- état final d'un lien validé : `Configuré — non synchronisé` ou équivalent sûr.

## Découverte réseau

- test de connexion réel lorsque supporté ;
- découverte réelle OCBlackTop ;
- découverte réelle TheSportsDB ;
- aucune récupération d'événements/calendriers pour remplir la base Events ;
- nombre de requêtes mesuré ;
- aucune boucle de synchronisation ;
- fixture/faux serveur pour tests reproductibles sans consommer les APIs réelles en CI.

## Découverte périodique

- activation/désactivation par fournisseur ;
- intervalle par défaut 30 jours ;
- minimum 7 jours ;
- `last_discovery_at` persistant ;
- prochaine échéance calculable ;
- 5.3 n'introduit aucun daemon/scheduler parallèle ;
- le branchement automatique périodique est explicitement reporté au scheduler 5.4.

## Quotas

- découverte manuelle et logique périodique respectent les limites sûres configurées ;
- découverte reportée/refusée si elle n'est pas sûre ;
- aucune commande manuelle ne contourne le quota ;
- aucune consommation volontaire de la réserve 30 % année courante ;
- pas de moteur complet de cadence/quota avant 5.5.

## Redécouverte et disparition

- redécouverte idempotente ;
- mêmes identifiants externes mettent à jour la découverte existante ;
- changement de source config crée une divergence proposée ;
- 3 découvertes complètes consécutives sans résultat => `Non retrouvé chez le fournisseur` ;
- échec, interruption, quota ou résultat partiel ne comptent pas ;
- réapparition remet le compteur à zéro ;
- aucune suppression automatique.

## Historique DISCOVERY

Chaque opération conserve au minimum : origine, timestamps, durée, statut, requêtes, trouvés, nouveaux, non retrouvés, divergences, erreur expurgée ou motif de report.

L'historique ne doit contenir aucun secret et ne doit pas anticiper inutilement toute l'infrastructure de 5.8.

## Sécurité

- credentials uniquement via le service secret 5.2 ;
- secrets jamais dans source config, logs, historique, audit ou erreur ;
- endpoints/URLs configurables validés avant appel réseau ;
- protection SSRF adaptée aux besoins réels des adaptateurs ;
- timeouts et tailles de réponse bornés ;
- erreurs 401/403 traitées sans fuite de secret.

## Non-régression

- tests 5.1 et 5.2 restent verts ;
- lint, typecheck, tests, build ;
- recettes PostgreSQL nécessaires ;
- aucune modification UI `apps/web/**` sauf autorisation explicite ;
- aucune synchronisation d'événements.

## Stop rule

À la fin de 5.3 : statut `sub-lot-5.3-implemented-awaiting-maintainer-audit`, `authorized_sub_lot = null`, puis STOP avant 5.4.