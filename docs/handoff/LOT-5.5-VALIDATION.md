# Lot 5.5 — Validation quotas et cadence

Date : 2026-08-14  
Branche : `codex/lot-5-providers-sync`  
Statut : implémentation validée par le mainteneur le 2026-08-14.

## Livré

- quota gate PostgreSQL atomique avant émission HTTP ;
- fenêtres minute, heure, jour et mois, intervalle minimal et fuseau fournisseur avec repli UTC ;
- compteurs locaux persistants et observations fournisseur normalisées ;
- marge 5 %, réserve current 20 % ou absolue et plafond dur ;
- budgets communs aux synchronisations, découvertes et tests de connexion ;
- backoffs provider/stream, `Retry-After`, suspension immédiate 401/403 et jitter injectable ;
- compensation uniquement lorsque la non-émission est prouvée ;
- diagnostic backend sans refonte de l'interface Fournisseurs ;
- migration réversible `0013_provider_quota_cadence`.

## Recette dédiée

Commande : `npm run test:lot55`.

Résultat local : 61 cas réussis avec PostgreSQL réel, rollback/réapplication des migrations réussis.

Garanties explicites :

- `REAL PROVIDER REQUESTS = 0` ;
- `PROVIDER CREDITS CONSUMED = 0` ;
- deux workers pour un dernier crédit donnent exactement une autorisation ;
- un appel émis n'est jamais remboursé après timeout ou rejet par fencing ;
- les observations et diagnostics ne persistent ni header brut, ni body, ni secret.

## Corrections après audit mainteneur

- le `remaining` fiable annoncé par le fournisseur borne désormais toute
  disponibilité positive, après déduction des charges locales postérieures à
  l'observation ; la valeur la plus restrictive entre compteur local et
  fournisseur gagne, y compris pour `current` dans sa réserve protégée ;
- `QuotaObservation` porte son vrai `windowKind` et un adaptateur peut retourner
  une ou plusieurs observations `minute`, `hour`, `day` et `month` ; chacune
  est persistée et diagnostiquée séparément, sans header brut ;
- une observation arrivée à son `resetsAt` cesse de contraindre la nouvelle
  fenêtre ; la comptabilité locale reste inchangée ;
- `ProviderHttpError` conserve la raison et `nextEligibleAt` d'un refus avant
  émission ; une discovery différée enregistre ces deux valeurs, conserve
  `request_count=0`, libère son lease et n'est plus réacquise avant l'échéance ;
- un blocker sans date connue domine maintenant toute échéance finie et sa
  raison reste celle exposée par le diagnostic.

Les migrations additives et réversibles `0014_lot55_audit_fixes` et
`0015_lot55_final_audit_fixes` ajoutent respectivement l'échéance persistante
de discovery, puis l'échéance générique du quota gate et la séquence monotone
des charges. Le rollback refuse de perdre une échéance ou une association
d'observation encore active.

Tests ajoutés : remaining fournisseur positif plus restrictif, compteur local
plus restrictif, exhaustion avec et sans reset, réserve current bornée,
observations multi-fenêtres, expiration au reset, propagation HTTP, report
persistant d'une discovery et sélection d'un blocker indéfini. La recette
PostgreSQL contient désormais 61 cas.

## Corrections finales de ré-audit

- toute décision bloquée persiste désormais dans
  `provider_quota_runtime` la raison sélectionnée et son échéance générique ;
  le diagnostic restitue exactement cette paire pour les quotas, l'intervalle
  minimal, la cadence dynamique, les observations fournisseur et les
  backoffs ; une échéance indéterminée écrase correctement une ancienne date ;
- toute autorisation réussie efface la raison et l'échéance génériques ;
- chaque charge reçoit une séquence PostgreSQL monotone et l'observation issue
  de sa réponse mémorise cette séquence ; le remaining fournisseur est diminué
  par les charges de séquence postérieure, sans dépendre de l'ordre des
  timestamps ;
- la preuve dédiée maintient volontairement `Clock.now()` constant pendant
  plusieurs autorisations et bloque exactement après les deux crédits annoncés.

## Non-régression

- lint, typecheck, 29 tests Web, 161 tests API et builds Web/API : réussis ;
- sécurité : 52 tests réussis ;
- recette 5.4 scheduler/leases/fencing : réussie avec rollback puis réapplication des migrations 0011 à 0015 ;
- recettes Web Nginx/CSP et API publique : réussies ;
- test Chromium login/tableau de bord/championnats/fournisseurs sous CSP : 1 réussi, aucune erreur console critique ni violation CSP ;
- builds Docker API et Web : réussis ;
- `validate-repository.sh` et `git diff --check` : réussis ;
- `npm audit --audit-level=high` : 0 vulnérabilité (équivalent plus strict que le niveau low demandé).

## Limite de périmètre

Aucune ingestion réelle d'Events, aucun appel à OCBlackTop ou TheSportsDB, aucune refonte UI et aucun travail du Lot 5.6.

La validation mainteneur explicite est consignée dans
`LOT-5.5-MAINTAINER-VALIDATION.md` et dans
`../handbook/architecture/ADR-0018-LOT-5.5-MAINTAINER-VALIDATION.md`.
Elle n'autorise aucune implémentation du Lot 5.6.
