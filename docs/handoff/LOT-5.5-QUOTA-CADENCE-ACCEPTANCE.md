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
- Aucun credential ou header sensible brut n'est stocké ou loggé.

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
- 401/403 => suspension/authentication_error provider, sans retry agressif.
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
- Aucun secret dans quota state, logs, diagnostics ou audits.
- Mutations admin conformes auth/CSRF/audit existants.
- Round-robin 3/2/1, current prioritaire, leases/fencing et rejet stale restent inchangés.
- Discovery passe par le quota gate sans bypass.

## Tests obligatoires
La recette dédiée 5.5 couvre au minimum : fenêtres multiples, quota inconnu, marge, réserve, Sync now, pacing, Retry-After, 429, 401/403, provider/stream backoff, reset, changement de policy, concurrence PostgreSQL, divergence headers/local, sécurité et non-régression 5.4.

Exécuter également lint, typecheck, tests complets, build, sécurité, recette 5.4, validation repository, git diff --check, audit dépendances et builds Docker concernés.

Tous les tests utilisent fixtures/mocks/fake transports : `REAL PROVIDER REQUESTS = 0` et `PROVIDER CREDITS CONSUMED = 0`.

## Hors périmètre
Pas de vraie ingestion Events, bootstrap historique métier, normalisation/mapping Events, politique d'absence/suppression, notifications externes, refonte UI Providers ou ouverture automatique de 5.6.

## Gate
L'implémentation ne commence qu'après audit croisé Concept / Acceptance / 5.4 / sécurité, validation explicite du mainteneur et mise à jour des statuts avec `authorized_sub_lot = 5.5`.

La création de ce document seule n'autorise pas l'implémentation.
