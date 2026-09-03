# Lot 5.6 — Corrections issues de l'audit croisé

Date : 2026-08-14
Statut : **CORRECTIONS NORMATIVES APPLIQUÉES — PREUVE HISTORIQUE D'AUDIT**

Ce document ferme les constats de l'audit croisé :

`Concept 5.6 ↔ UI Contract 5.6 ↔ Acceptance 5.6 ↔ scheduler 5.4 ↔ quotas/cadence 5.5 ↔ sécurité ↔ frontière 5.7 ↔ Project Handbook`.

Les corrections ci-dessous restent normatives. Leur ancien gate « implémentation non autorisée » décrivait l'état **au moment de l'audit**. Le mainteneur a ensuite explicitement autorisé l'implémentation du Lot 5.6 le 2026-08-14 ; voir `docs/handbook/architecture/ADR-0019-LOT-5.6-ACQUISITION-AUTHORIZATION.md`.

## C1 — Graphe source épreuve/session ≠ modèle métier

Le stockage 5.6 peut représenter fidèlement une structure fournisseur `meeting/event → sessions` lorsque le fournisseur l'expose.

Cette structure est **strictement un graphe source technique d'acquisition**. Elle ne réintroduit pas un modèle métier `Event → Sessions`.

Le modèle métier permanent reste celui du Handbook/ADR-0013 : **un Événement métier représente directement une Session métier**, avec `session_title` facultatif. Les anciennes tables/routes Sessions restent uniquement des éléments de compatibilité et ne deviennent pas le modèle cible par effet du Lot 5.6.

Conséquences obligatoires :

- aucune projection source 5.6 ne doit être utilisée comme justification pour modifier le modèle métier permanent ;
- aucune UI 5.6 ne doit présenter le graphe source comme la structure métier officielle ;
- la transformation d'un graphe fournisseur vers les Événements métier reste au Lot 5.7 ;
- l'implémentation 5.6 doit contenir un test de non-régression démontrant qu'elle ne réintroduit pas un workflow métier Event→Sessions.

**Constat P1 : FERMÉ.**

## C2 — Overrides : protection technique immédiate, réconciliation métier en 5.7

La phrase « réconciliation définitive avec les corrections locales reste 5.7 » ne retarde jamais la garantie permanente de protection des overrides.

Dès 5.6 :

- une synchronisation peut mettre à jour la valeur source ;
- elle ne peut jamais supprimer, écraser ou rendre inopérant un override actif ;
- les écritures source, la protection de l'override et l'audit requis doivent respecter les garanties transactionnelles permanentes du Handbook ;
- un changement de source sous override actif est traçable.

5.7 reste responsable de la **décision métier définitive de réconciliation**, pas de la protection technique de l'override.

Critère d'acceptation : un test concurrent source + override doit démontrer qu'aucune acquisition 5.6 ne détruit ou n'écrase l'override et que la valeur effective reste conforme au modèle permanent.

**Constat P2 overrides : FERMÉ.**

## C3 — J, J+30 et finalization : temps déterministe, UTC et fuseaux

Les calculs de classification temporelle 5.6 doivent être déterministes entre workers et compatibles avec les invariants temporels permanents.

Règles :

- les instants persistés et comparés sont normalisés en UTC ;
- lorsqu'une notion de « date du jour » ou de « fin de date civile » dépend d'un fuseau, le fuseau pertinent doit être déterminé explicitement par la donnée/adaptateur et la conversion produit ensuite un instant UTC ;
- J→J+30 est une classification de fenêtre, pas une durée approximative de `30 × 24 h` lorsque la règle est civile ;
- le délai de finalisation de 30 jours est calculé selon une règle unique documentée et testée, sans divergence entre workers ;
- aucun comportement ne doit varier de façon incohérente à minuit ou lors des passages heure d'été/heure d'hiver ;
- une date pré-1970 reste valide après conversion et comparaison.

Tests d'acceptation ajoutés : événement autour de minuit, DST été/hiver, workers avec TZ système différentes, `civil_day_fallback` vers UTC et pré-1970 + fuseau.

**Constat P2 temporalité : FERMÉ.**

## C4 — Sécurité HTTP fournisseur explicitement héritée

5.6 hérite sans exception de la baseline HTTP permanente du Handbook/ADR-0016.

Tout appel fournisseur réel 5.6 doit respecter au minimum : HTTPS uniquement, allowlist fournisseur, aucune redirection hors frontière, timeout borné, streaming/réponse/taille bornés, parsing défensif et validation de schéma, redaction des secrets, aucun credential dans URL/logs/erreurs/journal/ACP/source persistée, protection contre pagination infinie et épuisement des ressources.

**Constat P3 sécurité HTTP : FERMÉ.**

## Compléments à la matrice Acceptance 5.6

Les scénarios 35 à 47 sont intégrés directement dans `LOT-5.6-ACCEPTANCE.md` et restent obligatoires.

## Résultat de l'audit corrigé

- Frontière 5.6/5.7 : **CONFORME après C1/C2** ;
- Scheduler 5.4 / leases / fencing / fairness : **CONFORME** ;
- Quotas/cadence 5.5 : **CONFORME** ;
- Temporalité / pré-1970 : **CONFORME après C3** ;
- Sécurité fournisseur : **CONFORME après C4** ;
- Contrat UI : **CONFORME** ;
- Gate documentaire d'audit : **PASS**.

## Gate courant

La fermeture de l'audit n'était pas, à elle seule, une autorisation d'implémenter. **Cette autorisation a ensuite été accordée explicitement par le mainteneur le 2026-08-14.**

État courant :

- audit croisé : effectué et PASS après corrections ;
- constats : fermés ;
- revue post-corrections : PASS ;
- `authorized_sub_lot = 5.6` ;
- Lot 5.6 : **AUTORISÉ À L'IMPLÉMENTATION** ;
- validation finale 5.6 : **À VENIR** ;
- Lots 5.7+ : **NON AUTORISÉS**.

Voir ADR-0019. Toute mention historique contraire à ce gate doit être comprise comme décrivant un état antérieur à l'autorisation.