# Lot 5.3 — Critères d'acceptation Découverte et source config

Date : 2026-08-12

Statut : concept validé, implémentation autorisée après validation 5.2

## Critères fonctionnels

- vrais adaptateurs OCBlackTop et TheSportsDB ;
- WRC reste OCBlackTop avec stratégie/source config distincte si nécessaire ;
- aucune logique générique codée en dur sur `WRC` ;
- catalogue OCBlackTop déclaratif identifié comme `adapter-known-catalog`, sans endpoint `/sports` supposé ;
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
- formulaire manuel issu de `adapter.championshipForm()`, sans secret ni champ générique étranger à l'adaptateur ;
- configuration manuelle possible avec un adaptateur sans découverte et sans ligne `provider_discovered_championships` artificielle ;
- lien manuel vers un championnat existant ou création explicite et atomique d'un championnat local ;
- validation locale de la `source_config`, stockage versionné avec `validated_at`, état `manual`/`inactive` et `is_primary=false` ;
- zéro appel fournisseur, zéro Event et zéro `sync_stream` lors de la configuration manuelle ;
- un nouveau championnat OCBlackTop utilisant une stratégie existante sûre n'a pas à appartenir au catalogue intégré ;
- une ligue TheSportsDB connue peut être configurée sans exécuter `all_leagues.php` ;
- une redécouverte ultérieure rattache l'identifiant externe au lien existant, signale la divergence et n'adopte rien automatiquement.

**Manual championship source configuration remains available even when
provider discovery is unavailable, partial or does not contain the requested
championship.**

## Découverte réseau

- test de connexion réel lorsque supporté ;
- découverte réelle OCBlackTop ;
- découverte réelle TheSportsDB ;
- aucune récupération d'événements/calendriers pour remplir la base Events ;
- nombre de requêtes mesuré ;
- aucune boucle de synchronisation ;
- complétude explicite dans le contrat ; un résultat partiel ne compte aucune absence ;
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
- quota sûr inconnu : report avant réseau et zéro requête ;
- aucune commande manuelle ne contourne le quota ;
- aucune consommation volontaire de la réserve mensuelle de 30 % dédiée à l’année courante ;
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
