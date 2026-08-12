# Lot 5 — Critères d'acceptation Fournisseurs et synchronisation

Date : 2026-08-12

Statut : `phase-0-specification-complete-awaiting-maintainer-validation`

## 1. Critères de sortie de Phase 0

- [x] modèle instance → lien championnat → source config explicite ;
- [x] configuration de source opaque au moteur et validée par l'adaptateur ;
- [x] WRC défini comme flux OCBlackTop, sans fournisseur/adaptateur autonome ;
- [x] modèle PostgreSQL proposé avec contraintes et relations ;
- [x] contrats TypeScript des adaptateurs proposés ;
- [x] scheduler, leases, curseurs, reprise et round-robin spécifiés ;
- [x] quotas configurés/observés, réserve 30 % et cadence spécifiés ;
- [x] bootstrap current-first, historique et boucle courante spécifiés ;
- [x] idempotence, mappings, corrections et absences spécifiés ;
- [x] secrets, logs, alertes et logos cadrés ;
- [x] routes administratives et impact public proposés ;
- [x] ordre UP/DOWN et compatibilité des migrations proposés ;
- [x] sous-lots indépendants et matrice de tests définis ;
- [x] aucun code applicatif ou SQL de migration créé ;
- [ ] audit et validation explicite du mainteneur.

## 2. Matrice transversale obligatoire

Chaque scénario automatisé produit une donnée synthétique, un résultat stable
et un nettoyage. Les tests de mutation vérifient aussi audit atomique,
authentification, CSRF, absence de secret et rollback.

| Domaine | Scénarios d'acceptation |
|---|---|
| Contrat adaptateur | schémas versionnés ; config valide/invalide ; curseur aller-retour ; unité page/offset/token/fenêtre ; résultat de fin explicite |
| Source par championnat | deux championnats d'une instance utilisent deux endpoints ; stratégies différentes ; moteur aveugle au JSON ; troisième stratégie future sans modification du scheduler |
| OCBlackTop | stratégie standard ; WRC par stratégie saisonnière ; secrets/quotas communs ; curseurs/leases séparés ; aucun adaptateur WRC |
| TheSportsDB | formulaire `league_id` ; découverte/config manuelle ; pagination/saisons propres |
| Découverte | découvert inactif ; source préremplie ; aucun flux éligible avant activation ; redécouverte idempotente |
| Activation | validation complète ; source principale unique ; flux courant prioritaire ; historique en attente ; audit atomique |
| Scheduler | round-robin équitable ; concurrence 1 par défaut ; limites configurables ; `SKIP LOCKED` ; aucun double traitement |
| Curseurs | JSON composé ; version ; commit atomique avec données ; reprise exacte après arrêt/crash ; reset confirmé et audité |
| Bootstrap | année courante sur tous les liens avant historique ; historique non bloquant ; réactivation current-first |
| Saisons | découverte native ; repli N-1 ; `start_year` ; saison vide confirmée ; page vide intermédiaire non terminale ; erreur non vide |
| Boucle courante | 1er janvier → fin confirmée → reset ; cycle complet numéroté ; changements captés au cycle suivant |
| Quotas | court terme et mensuel ; limites configurées distinctes des observations ; headers fiables prioritaires ; compteur interne de repli |
| Réserve | 30 % par défaut ; valeur configurable ; historique arrêté sans erreur quand son budget est épuisé ; current continue |
| Quota inconnu | aucune synchro automatique ; observation fiable peut débloquer ; commande manuelle ne contourne pas l'interdit |
| Cadence | recalcul après appel/header/reset/config/activation ; maximum des fenêtres ; partage entre flux ; jitter borné |
| Retry | 429 avec `Retry-After` ; 5xx ; timeout ; DNS/réseau ; backoff exponentiel + jitter ; aucun progrès de curseur en échec |
| Erreur durable | 401/403/secret/config invalide suspend ; alerte dédupliquée ; reprise uniquement après intervention validée |
| Secrets | AES-256-GCM ; nonce unique ; tag vérifié ; `key_version` ; rotation lisant ancien/écrivant nouveau ; API masque toujours la valeur |
| Redaction | clé API, Authorization, cookie, session, mot de passe et master key absents logs/audit/erreurs/CI |
| Normalisation | UTC ; références connues ; objet canonique stable ; fournisseur brut non exposé au public |
| Mapping | `external_id` prioritaire ; clé métier sûre en repli ; ambiguïté `pending` ; décision réutilisée ; collision refusée |
| Idempotence | hash identique = aucune écriture/audit ; changement réel = mise à jour unique ; double ingestion convergente |
| Corrections | source actualisée ; override conservé et effectif ; conflit visible ; convergence supprime correction inutile |
| Présence | absence comptée seulement après cycle complet ; alerte au 3e cycle par défaut ; réapparition résout ; jamais de suppression |
| Annulation | statut explicite appliqué immédiatement et non confondu avec une absence |
| Désactivation | stoppe flux ; conserve données/runs/corrections ; admin visible ; API publique exclut sans UPDATE massif |
| Pause fournisseur | stoppe nouveaux leases sans masquer les données publiques ; reprise respecte quotas |
| Historique runs | une ligne par unité ; curseurs, compteurs et statut exacts ; run interrompu conservé |
| Logs | JSON stdout ; volume optionnel ; rotation quotidienne ou 100 Mio ; compression ; rétention 30 jours ; lecture bornée |
| Alertes | types minimaux ; déduplication ; acquittement/résolution audités ; aucun secret |
| Logo | propriétaire championnat ; MIME réel ; limite taille/dimensions ; aperçu/remplacement/suppression/fallback ; sync ne l'écrase pas |
| API admin | 401 sans auth ; 403 rôle insuffisant ; session/HMAC admin ; CSRF cookie ; schémas stricts ; pagination SQL |
| API publique | contrat inchangé ; aucune métadonnée technique ; championnat désactivé absent ; réactivé visible selon règles métier |
| Concurrence | deux workers ; même flux sérialisé ; flux distincts limités par instance ; correction admin concurrente conservée |
| Plateformes | Node 22 ; PostgreSQL ; Docker ; Windows ; VPS ; Chromium ; CI sur SHA final |
| Non-régression | Lots 4.1 à 4.4, authentification humaine/HMAC, Événements, calendrier, corrections, migrations |

## 3. Acceptation par sous-lot

### 5.1 — DB et contrats

- migrations M1/M2 sur base vierge et base Lot 4.4 ;
- deuxième UP sans effet ; DOWN protégé puis réapplication ;
- héritage `provider_key` converti en liens inactifs sans appel fournisseur ;
- deux source configs différentes pour une même instance ;
- tests de contrat exécutés sur faux adaptateur page, token et stratégie tierce ;
- API, Web, types et Docker construisent avant passage à 5.2.

### 5.2 — Secrets et configuration

- bootstrap de clé maître documenté sans secret commité ;
- chiffrement authentifié, altération détectée et nonces uniques ;
- API ne retourne jamais la valeur ;
- test connexion utilise le secret déchiffré uniquement en mémoire ;
- 401/403 suspendent et alertent ;
- fixture de recette avec faux provider local.

### 5.3 — Découverte et source config

- adaptateurs OCBlackTop et TheSportsDB respectent le même contrat ;
- WRC reste OCBlackTop avec stratégie distincte ;
- découverte crée uniquement des liens inactifs ;
- ajout manuel et validation par formulaire spécifique ;
- activation impossible sans config valide et quota sûr.

### 5.4 — Scheduler, curseurs et leases

- M3 validée UP/DOWN ;
- reprise après arrêt forcé au curseur exact ;
- lease expiré récupéré et run interrompu conservé ;
- round-robin et concurrence prouvés avec plusieurs workers ;
- pause/reprise/reset/sync-now audités et sans bypass quota.

### 5.5 — Quotas et cadence

- compteurs locaux et headers simulés ;
- réserve 30 % et limites de fenêtre simultanées ;
- quota inconnu bloque ; quota épuisé attend sans boucle active ;
- 429/backoff/jitter déterministes sous horloge et aléa injectés ;
- métriques et UI expliquent la prochaine éligibilité.

### 5.6 — Bootstrap et historique

- plusieurs championnats current-first en round-robin ;
- historique seulement après premier passage courant global ;
- découverte saisons et descente N-1 ;
- vide confirmé, vide intermédiaire, timeout et `start_year` ;
- boucle current complète et redémarrage au 1er janvier.

### 5.7 — Normalisation, idempotence et corrections

- M4 validée et collisions historiques diagnostiquées ;
- external ID, clé métier, ambiguïté et mapping confirmé ;
- hash inchangé évite écriture ;
- correction locale reste effective sous mise à jour fournisseur ;
- seuil d'absence, réapparition et annulation explicite.

### 5.8 — Runs, logs et alertes

- chaque issue de run remplit les compteurs cohérents ;
- logs structurés et redigés ; rotation/compression/rétention testées ;
- alertes dédupliquées et cycles de résolution ;
- aucune réponse n'accepte de chemin arbitraire de log.

### 5.9 — Interface Fournisseurs

- fidélité mesurée >= 98 % aux maquettes validées ;
- pages overview/détail et cinq onglets ;
- formulaires rendus depuis le schéma adaptateur, sans formulaire universel ;
- états chargement/vide/erreur/suspendu/quota/découvert ;
- clavier, focus, 1440x900, 1280x720 et mobile ;
- logo sécurisé et fallback ;
- aucune valeur décorative transformée en réglage métier.

### 5.10 — Acceptation finale

- fixtures synthétiques couvrant nominal, quotas, mapping, conflit et panne ;
- commandes Windows et VPS d'injection, contrôle et nettoyage ;
- audit npm, lint, typecheck, tests, builds et Docker verts ;
- migrations sur copie synthétique Lot 4.4 et rollback ;
- tests de crash et concurrence ;
- Chromium et captures ;
- CI et Docker build verts sur SHA final ;
- validation utilisateur explicite consignée avant toute fusion.

## 4. Conditions bloquantes

Le Lot 5 ne peut pas être déclaré accepté si l'un des points suivants subsiste :

- secret lisible, journalisé ou renvoyé ;
- découverte déclenchant une synchronisation ;
- moteur interprétant une source config ou codant WRC en dur ;
- synchronisation automatique avec quota inconnu ;
- historique consommant la réserve année courante ;
- curseur progressant sans commit métier ;
- double worker sur un flux ;
- écrasement d'une correction ;
- suppression automatique d'un Événement absent ;
- désactivation nécessitant la réécriture de tous les Événements ;
- modification incompatible de l'API publique ;
- migration sans DOWN sûr ;
- absence de fixture ou de recette pour une fonction nouvelle.

## 5. Validation attendue maintenant

La présente Phase 0 demande uniquement la validation du modèle, des contrats,
du plan de migrations, de l'impact et du découpage. Cocher cette validation
n'autorise que le démarrage du sous-lot 5.1 ; elle ne valide aucune
implémentation future.
