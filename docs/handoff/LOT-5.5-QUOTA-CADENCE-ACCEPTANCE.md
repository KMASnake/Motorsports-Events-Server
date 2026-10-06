# Lot 5.5 — Quotas et cadence — Acceptance

Statut : proposé après revue de conception. Validation mainteneur requise avant implémentation.

Ce document complète les règles générales antérieures : réserve 20 %, quota inconnu en mode prudent et plusieurs fenêtres simultanées.

## Architecture
- 5.5 ne réimplémente pas le scheduler 5.4, son round-robin, ses leases ou son fencing.
- Le quota gate retourne autorisation, prochaine éligibilité, raison et diagnostic.
- Un refus quota ne monopolise pas un worker.

## Fenêtres
- Support minute, heure, jour, mois et intervalle minimal simultanés.
- Toutes les contraintes applicables doivent autoriser l'appel.
- Fenêtres/fuseau fournisseur si connus, UTC sinon.
- La contrainte la plus restrictive détermine `next_eligible_at`.
- Les resets fonctionnent sans cron obligatoire.

## Modèle hybride
- Seul l'adaptateur interprète les metadata quota qu'il déclare fiables.
- Le compteur local persiste comme garde de sécurité.
- Source diagnostique : provider_headers, local_counter ou mixed.
- En divergence, la décision la plus restrictive gagne sauf reset fiable explicite.
- Les observations ne réécrivent pas silencieusement la policy.
- Les observations persistées sont strictement normalisées aux métadonnées nécessaires, par exemple `limit`, `remaining`, `reset_at`, `window`, `source`.
- Test de sécurité obligatoire : aucun `Authorization`, `Cookie`, `Set-Cookie`, `x-api-key`, API key/token, URL credentialisée, dump de headers bruts ou body fournisseur dans quota state, observations, diagnostics, logs ou audits.

## Quota inconnu
- L'absence de limite chiffrée ne bloque pas automatiquement la synchronisation.
- Compteur local et intervalle minimal restent actifs.
- L'ACP indique Quota inconnu.
- Pas de réserve en pourcentage sans limite chiffrée.
- Une limite manuelle active marge, réserve et pacing sans effacer l'usage.

## Comptage
- Sync, discovery périodique/manuelle et test de connexion partagent le même budget provider.
- Toute tentative HTTP réellement envoyée compte, y compris erreurs distantes et timeout après émission.
- Un refus local avant émission compte zéro.
- Test bloquant `charge puis non-émission prouvée` : remaining=1, charge atomique réussie, échec local du transport avant toute émission => compensation sûre, remaining reste 1.
- Test bloquant opposé : requête effectivement émise puis timeout/erreur distante => charge conservée, aucun remboursement automatique.

## Marge
- Défaut 5 %, configurable 0 à 20 %.
- Elle réduit le plafond opérationnel avant réserve.
- Test : 10 000 avec marge 5 % donne 9 500.

## Réserve current
- Défaut 20 %.
- Mode pourcentage configurable 0 à 50 %, ou valeur absolue ; modes exclusifs.
- Calcul après marge.
- Seuls current et Sync now portant réellement sur current peuvent consommer la réserve.
- Recent, deep history, discoveries et test de connexion ne le peuvent pas.
- À la limite dure, aucun travail ne passe.
- Test : 10 000, marge 5 %, réserve 20 % donne plafond 9 500, réserve 1 900 et budget normal 7 600.

## Sync now
- Boost de priorité uniquement.
- Aucun contournement de quota dur, marge, Retry-After, backoff, intervalle minimal, lease, fencing ou concurrence.

## Cadence dynamique
- Le pacing tient compte du budget distribuable et du temps avant reset.
- Il ne crée jamais artificiellement des appels.
- Il régule surtout recent_catchup et deep_history.
- Current reste piloté par le besoin réel.
- Burst contrôlé autorisé si toutes les limites le permettent.

## Backoffs
- provider_backoff bloque tous les streams du provider.
- stream_backoff bloque uniquement le stream concerné.
- L'adaptateur peut classifier le scope ; ambiguïté => provider par défaut.
- Test obligatoire d'indépendance entre stream en erreur, autre stream sain et autre provider.

## Erreurs HTTP
- 401/403 sur un endpoint déclaré authentifié par l'adaptateur => suspension/authentication_error immédiate de l'instance provider, sans attendre N répétitions et sans retry automatique agressif.
- Test obligatoire : après le premier 401/403 authentifié, aucun nouvel appel automatique de cette instance n'est émis tant que l'administrateur n'a pas résolu/réactivé la configuration selon le mécanisme prévu.
- 429 avec Retry-After valide => échéance prioritaire ; secondes et date HTTP supportées.
- Retry-After invalide => fallback propre.
- 429 sans Retry-After => backoff progressif environ 1 min, 5 min, 15 min, 1 h avec jitter.
- 5xx/réseau/timeout => backoff progressif avec jitter, sans déclarer le quota épuisé.
- Succès ultérieur => reset des échecs transitoires concernés.
- Erreur durable de parsing/contrat distinguée d'une panne transitoire.

## Testabilité temporelle
- Horloge injectable pour fenêtres, reset, Retry-After, pacing et backoff.
- Source de jitter injectable pour tests déterministes.

## Atomicité et multi-instance
- Décision d'éligibilité et charge conservatrice d'une unité atomiques en PostgreSQL avant appel HTTP.
- Test réel : remaining=1 et deux workers concurrents => exactement une autorisation outbound.
- Plusieurs processus partagent le même état quota.
- Providers distincts gardent des budgets distincts.
- Les garanties lease/fencing 5.4 restent intactes.
- Test croisé 5.4/5.5 bloquant : worker A possède le lease, charge un crédit et émet la requête ; son lease expire, worker B reprend ; la réponse tardive de A est rejetée par fencing côté commit métier mais le crédit consommé par A reste chargé. `stale fencing rejection != quota refund`.

## Configuration
- Defaults adaptateur séparés de la policy persistée.
- L'administrateur peut surcharger les paramètres prévus.
- Restaurer les recommandations ne remet jamais compteurs/observations à zéro.
- Réduire une limite sous la consommation actuelle produit immédiatement l'état restrictif approprié.

## Diagnostic admin
- Exposer limites, plafond, usage, restant estimé, réserve, distance avant réserve, reset, source, état, next_eligible_at, raison et observations normalisées.
- Aucun secret fournisseur exposé.
- quota_unknown est un diagnostic, pas un blocage systématique.
- Seuils recommandés : normal <80 %, warning >=80 %, critical >=95 %, puis protected et exhausted.

## Périmètre UI
- Pas de refonte graphique Providers en 5.5.
- Fournir API et diagnostics nécessaires.
- Toute UI minimale réutilise l'existant ; finition complète en 5.9.

## Sécurité et non-régression
- Conserver trust proxy, redaction, SSRF, HTTPS provider, streaming borné, chiffrement et headers Web.
- Aucun secret dans quota state, observations, logs, diagnostics ou audits ; les nouvelles surfaces de persistance quota sont couvertes explicitement par des tests sentinelles.
- Mutations admin conformes auth/CSRF/audit existants.
- Round-robin 3/2/1, current prioritaire, leases/fencing et rejet stale restent inchangés.
- Discovery passe par le quota gate sans bypass.

## Tests obligatoires
La recette dédiée 5.5 couvre au minimum : fenêtres multiples, quota inconnu, marge, réserve, Sync now, pacing, Retry-After, 429, suspension immédiate 401/403 authentifié, provider/stream backoff, reset, changement de policy, concurrence PostgreSQL, divergence headers/local, compensation uniquement avant émission prouvée, absence de remboursement après émission, stale fencing sans remboursement quota, sécurité des observations persistées et non-régression 5.4.

Exécuter également lint, typecheck, tests complets, build, sécurité, recette 5.4, validation repository, git diff --check, audit dépendances et builds Docker concernés.

Tous les tests utilisent fixtures/mocks/fake transports : `REAL PROVIDER REQUESTS = 0` et `PROVIDER CREDITS CONSUMED = 0`.

## Hors périmètre
Pas de vraie ingestion Events, bootstrap historique métier, normalisation/mapping Events, politique d'absence/suppression, notifications externes, refonte UI Providers ou ouverture automatique de 5.6.

## Gate
L'implémentation ne commence qu'après audit croisé Concept / Acceptance / 5.4 / sécurité, validation explicite du mainteneur et mise à jour des statuts avec `authorized_sub_lot = 5.5`.

La création de ce document seule n'autorise pas l'implémentation.
