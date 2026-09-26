# Lot 5.5 — Quotas et cadence — Concept

Statut : **conception revue par le mainteneur — implémentation non autorisée tant que l'Acceptance 5.5 n'est pas validée**.

## 1. Frontière architecturale

Le Lot 5.4 reste propriétaire de l'ordonnancement : priorités `current > recent_catchup > deep_history`, round-robin 3/2/1, concurrence, leases et fencing.

Le Lot 5.5 répond uniquement à la question : **un appel HTTP fournisseur est-il autorisé maintenant, quel budget peut-il consommer, quand sera-t-il à nouveau éligible et pourquoi attend-il ?**

Le moteur expose conceptuellement : `allowed`, `next_eligible_at`, `blocking_reason` et un `quota_snapshot`. Il ne réimplémente pas le scheduler 5.4.

## 2. Modèle de limites

Une instance fournisseur peut cumuler plusieurs limites : minute, heure, jour, mois et intervalle minimal entre appels. Toutes les limites applicables doivent autoriser l'appel.

Les fenêtres suivent les fenêtres calendaires documentées par le fournisseur. Son fuseau est utilisé lorsqu'il est connu ; UTC est le défaut. Un reset fournisseur explicitement observé peut recaler l'état local.

La contrainte la plus restrictive gagne : `next_eligible_at` est le maximum des contraintes applicables (fenêtres, intervalle minimal, cadence dynamique, réserve, Retry-After, provider_backoff, stream_backoff).

## 3. Source de vérité hybride

Le quota utilise un modèle hybride :

- metadata/headers fournisseur fiables, interprétés uniquement par l'adaptateur ;
- compteur local persistant comme fallback et garde de sécurité ;
- source diagnostique : `provider_headers`, `local_counter` ou `mixed`.

En cas de contradiction, la valeur la plus restrictive est utilisée sauf reset fournisseur explicite ou observation suffisamment fiable permettant un recalage. Une observation ne modifie jamais silencieusement la configuration administrateur.

Aucun header brut sensible, credential ou body fournisseur ne doit être stocké ou journalisé. Seules les métadonnées quota normalisées explicitement nécessaires peuvent être persistées, par exemple `limit`, `remaining`, `reset_at`, `window` et `source`. Sont notamment interdits dans quota state, observations, diagnostics, logs et audits : `Authorization`, `Cookie`, `Set-Cookie`, `x-api-key`, API keys/tokens, URL contenant des credentials, dumps de headers bruts et bodies fournisseur.

## 4. Quota inconnu

Un quota fournisseur inconnu **ne bloque pas** automatiquement la synchronisation.

Sans limite chiffrée connue : compteur local + intervalle minimal recommandé par l'adaptateur, état ACP `Quota inconnu`, pas de réserve en pourcentage. Une limite configurée manuellement réactive les mécanismes normaux de marge, réserve et pacing.

## 5. Comptage commun

Tous les appels réels d'une instance fournisseur partagent le même budget : synchronisation, discovery périodique, discovery manuelle et test de connexion.

Toute requête HTTP réellement envoyée est considérée comme potentiellement consommée, quelle que soit sa réponse (`2xx`, `4xx`, `429`, `5xx`, timeout après émission). Une requête refusée localement avant émission ne consomme rien.

Le comptage/charge doit être persistant et multi-instance safe.

## 6. Marge de sécurité

Marge par défaut : **5 %**, configurable de **0 à 20 %** par fournisseur.

Elle réduit le plafond opérationnel avant calcul de la réserve. Elle protège contre les imprécisions de comptage et appels externes. Elle est distincte de la réserve `current`.

## 7. Réserve globale current

Réserve par défaut : **20 %**, configurable de **0 à 50 %**, ou en valeur absolue. Les modes `percent` et `absolute` sont exclusifs.

La réserve est calculée sur le plafond opérationnel après marge.

Droit d'utilisation de la réserve :

- `current` : oui ;
- `current` déclenché par `Sync now` : oui ;
- `recent_catchup` : non ;
- `deep_history` : non ;
- discovery périodique : non ;
- discovery manuelle : non ;
- test de connexion : non.

Quand le budget normal atteint la réserve, seul `current` continue. À la limite dure, tout s'arrête.

`Sync now` reste un boost de priorité et ne contourne jamais quota dur, marge, Retry-After, backoff, intervalle minimal, lease, fencing ou concurrence.

## 8. Cadence dynamique

Le moteur protège le budget restant jusqu'au reset. Conceptuellement :

`budget_distribuable = plafond_opérationnel - réserve - consommation`

La cadence soutenable découle du budget distribuable et du temps restant avant reset. Il s'agit d'un plafond de consommation, pas d'une obligation d'appeler périodiquement.

Le pacing dynamique cible principalement `recent_catchup` et `deep_history`. `current` répond au besoin réel et peut utiliser la réserve.

Un burst contrôlé reste autorisé quand le budget et les limites court terme le permettent.

## 9. Backoffs

Deux scopes sont distincts :

- `provider_backoff` : bloque tous les streams de l'instance fournisseur ;
- `stream_backoff` : bloque uniquement le stream concerné.

L'adaptateur peut classifier le scope. En cas d'ambiguïté, le moteur choisit par défaut le scope fournisseur, plus conservateur.

Règles :

- `401/403` provenant d'un endpoint que l'adaptateur qualifie comme authentifié : suspension/authentication_error immédiate de l'instance fournisseur, sans attendre plusieurs répétitions et sans retries automatiques répétés ;
- `429 + Retry-After` : blocage jusqu'à l'échéance annoncée ; support délai en secondes et date HTTP ;
- `429` sans Retry-After : backoff progressif par défaut ~1 min, ~5 min, ~15 min, ~1 h avec jitter ;
- `5xx`, réseau, timeout : backoff progressif avec jitter, sans déclarer le quota épuisé ;
- parsing/contrat durable : erreur durable généralement au scope stream, sauf classification fournisseur ;
- succès ultérieur : remise à zéro du compteur d'échecs transitoires et du niveau de backoff.

Jitter recommandé : environ ±10 %, avec aléa injectable pour tests déterministes.

## 10. Réservation/charge atomique

Avant un appel HTTP, l'autorisation et la charge conservatrice d'une unité doivent être réalisées atomiquement dans PostgreSQL.

Invariant de concurrence : si une seule unité reste, deux workers concurrents ne peuvent pas tous deux être autorisés.

Le mécanisme est distinct des leases 5.4 : le lease protège un stream contre le double travail ; la charge quota protège le budget fournisseur entre plusieurs streams et plusieurs instances.

Une erreur purement locale avant toute émission HTTP peut annuler la charge si cela peut être prouvé sans ambiguïté. Une tentative réellement envoyée n'est pas recréditée automatiquement.

La perte du lease ou le rejet ultérieur du commit par fencing ne rembourse jamais une tentative déjà envoyée : `stale fencing rejection != quota refund`. Le quota décrit la consommation fournisseur réelle/potentielle ; le fencing décrit uniquement le droit à committer le résultat métier.

## 11. Horloge et reset

Toutes les décisions temporelles utilisent une horloge injectable : fenêtres, resets, Retry-After, pacing et backoffs. Pas de dépendance dispersée à l'heure système dans le moteur.

Le passage dans une nouvelle fenêtre remet le compteur de cette fenêtre à zéro à l'évaluation suivante ; aucun cron de reset n'est requis.

Changer la configuration ne remet jamais la consommation à zéro.

## 12. Configuration vs observations

Les recommandations de l'adaptateur fournissent des valeurs initiales : limites, intervalle minimal, marge/réserve recommandées, interprétation des metadata quota et fuseau/reset.

L'administrateur peut les surcharger. L'action `Restaurer les valeurs recommandées` restaure uniquement la policy ; compteurs et observations restent conservés.

Les observations fournisseur sont séparées de la policy. Une divergence est visible mais ne réécrit pas silencieusement la configuration.

## 13. Diagnostic ACP

5.5 doit exposer les données backend nécessaires : quota théorique, plafond opérationnel, consommé local, restant estimé, réserve current, appels avant réserve, prochain reset, source de quota, état quota/scheduler, `next_eligible_at` et raison dominante.

Raisons typiques : `minute_limit`, `hour_limit`, `daily_limit`, `monthly_limit`, `monthly_reserve`, `minimum_interval`, `dynamic_pacing`, `provider_retry_after`, `provider_backoff`, `stream_backoff`.

`quota_unknown` est un diagnostic, pas nécessairement un blocage.

Seuils d'affichage recommandés : normal <80 %, warning >=80 %, critique >=95 %, puis réserve/protected et exhausted.

La finition graphique complète reste du ressort du Lot 5.9. 5.5 fournit l'API et les diagnostics, et ne refond pas l'ACP.

## 14. Modèle de données cible

Conserver la séparation conceptuelle entre policy et state. Le schéma peut notamment comporter :

- `provider_quota_policies` : paramètres généraux, marge, réserve, intervalle, timezone ;
- `provider_quota_limits` : plusieurs fenêtres/limites par policy ;
- `provider_quota_state` : dernier appel, backoff provider, compteurs d'échecs, source/observation ;
- `provider_quota_windows` : fenêtres actives, usage local, observations normalisées limite/restant/reset ;
- état de backoff stream dans une structure liée au stream existant ou dédiée selon l'architecture finale.

Le choix exact des migrations doit respecter les conventions du dépôt et éviter les duplications avec les tables 5.4.

## 15. Hors périmètre 5.5

Pas de vraie ingestion Events, bootstrap historique métier, normalisation, mapping Events, politique d'absence/suppression, refonte graphique Providers, notifications externes ni contournement des protections 5.4.

Les tests Provider utilisent fixtures/mocks : **0 appel fournisseur réel et 0 crédit consommé**.

## 16. Invariants

1. Plusieurs fenêtres peuvent être simultanément actives.
2. La contrainte la plus restrictive gagne.
3. Les headers fiables enrichissent le compteur local, ils ne le suppriment pas.
4. Toute tentative HTTP réellement envoyée compte.
5. Tous les usages partagent le budget fournisseur.
6. Marge par défaut 5 %.
7. Réserve current par défaut 20 %.
8. Seul `current` peut utiliser la réserve.
9. `Sync now` ne bypass aucune protection.
10. Quota inconnu fonctionne prudemment au lieu de bloquer globalement.
11. Provider et stream backoff sont distincts.
12. Retry-After est prioritaire quand valide.
13. 401/403 authentifiés suspendent immédiatement le fournisseur.
14. La charge quota est atomique PostgreSQL et sûre multi-instance.
15. Une tentative envoyée reste chargée même si son commit est ensuite rejeté par fencing.
16. Policy et observations sont séparées.
17. Les observations quota persistées sont normalisées et exemptes de secrets/headers bruts.
18. Le scheduler 5.4 reste propriétaire de l'ordonnancement.
