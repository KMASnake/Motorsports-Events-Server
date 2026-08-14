# Lot 5.6 — Corrections issues de l'audit croisé

Date : 2026-08-14
Statut : **CORRECTIONS NORMATIVES APPLIQUÉES — IMPLÉMENTATION NON AUTORISÉE**

Ce document ferme les constats de l'audit croisé :

`Concept 5.6 ↔ UI Contract 5.6 ↔ Acceptance 5.6 ↔ scheduler 5.4 ↔ quotas/cadence 5.5 ↔ sécurité ↔ frontière 5.7 ↔ Project Handbook`.

En cas d'ambiguïté dans les documents 5.6 antérieurs, les précisions ci-dessous s'appliquent conjointement au `PROJECT-HANDBOOK.md` et prévalent sur toute lecture incompatible du Concept, du contrat UI ou de l'Acceptance 5.6.

## C1 — Graphe source épreuve/session ≠ modèle métier

Le stockage 5.6 peut représenter fidèlement une structure fournisseur `meeting/event → sessions` lorsque le fournisseur l'expose.

Cette structure est **strictement un graphe source technique d'acquisition**. Elle ne réintroduit pas un modèle métier `Event → Sessions`.

Le modèle métier permanent reste celui du Handbook/ADR-0013 : **un Événement métier représente directement une Session métier**, avec `session_title` facultatif. Les anciennes tables/routes Sessions restent uniquement des éléments de compatibilité et ne deviennent pas le modèle cible par effet du Lot 5.6.

Conséquences obligatoires :

- aucune projection source 5.6 ne doit être utilisée comme justification pour modifier le modèle métier permanent ;
- aucune UI 5.6 ne doit présenter le graphe source comme la structure métier officielle ;
- la transformation d'un graphe fournisseur vers les Événements métier reste au Lot 5.7 ;
- l'implémentation 5.6 devra contenir un test de non-régression démontrant qu'elle ne réintroduit pas un workflow métier Event→Sessions.

**Constat P1 : FERMÉ.**

## C2 — Overrides : protection technique immédiate, réconciliation métier en 5.7

La phrase « réconciliation définitive avec les corrections locales reste 5.7 » ne retarde jamais la garantie permanente de protection des overrides.

Dès 5.6 :

- une synchronisation peut mettre à jour la valeur source ;
- elle ne peut jamais supprimer, écraser ou rendre inopérant un override actif ;
- les écritures source, la protection de l'override et l'audit requis doivent respecter les garanties transactionnelles permanentes du Handbook ;
- un changement de source sous override actif est traçable.

5.7 reste responsable de la **décision métier définitive de réconciliation**, pas de la protection technique de l'override.

Critère d'acceptation ajouté : un test concurrent source + override doit démontrer qu'aucune acquisition 5.6 ne détruit ou n'écrase l'override et que la valeur effective reste conforme au modèle permanent.

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

Tests d'acceptation ajoutés :

1. événement autour de minuit ;
2. passage heure d'été ;
3. passage heure d'hiver ;
4. workers exécutés avec environnements/fuseaux système différents produisant la même classification ;
5. `civil_day_fallback` correctement converti vers UTC ;
6. combinaison pré-1970 + fuseau.

**Constat P2 temporalité : FERMÉ.**

## C4 — Sécurité HTTP fournisseur explicitement héritée

5.6 hérite sans exception de la baseline HTTP permanente du Handbook/ADR-0016.

Tout appel fournisseur réel 5.6 doit donc respecter au minimum :

- HTTPS uniquement ;
- destination/host soumis à l'allowlist fournisseur autorisée ;
- aucune redirection permettant de sortir de la frontière autorisée ;
- timeout borné ;
- streaming/réponse borné ;
- limites de taille ;
- parsing défensif et validation de schéma ;
- redaction des secrets ;
- aucun credential dans URL, logs, erreurs, journal fonctionnel, ACP ou données source persistées ;
- protection contre pagination infinie/bouclante et épuisement incontrôlé des ressources.

Critères d'acceptation ajoutés :

- refus HTTP non TLS ;
- refus d'un host hors allowlist ;
- refus d'une redirection vers un host non autorisé ;
- timeout fournisseur ;
- réponse/stream dépassant les limites ;
- vérification de redaction sur erreurs et traces.

**Constat P3 sécurité HTTP : FERMÉ.**

## Compléments à la matrice Acceptance 5.6

Les scénarios suivants deviennent obligatoires en plus des scénarios déjà listés dans `LOT-5.6-ACCEPTANCE.md` :

35. graphe source meeting/session sans réintroduction du modèle métier Event→Sessions ;
36. acquisition concurrente à un override sans destruction de l'override ;
37. classification `current-hot/current-future` stable à minuit ;
38. classification stable aux transitions DST été/hiver ;
39. classification identique entre workers malgré des TZ système différentes ;
40. `civil_day_fallback` converti correctement en UTC ;
41. cas pré-1970 avec conversion de fuseau ;
42. appel HTTP fournisseur non TLS refusé ;
43. host fournisseur hors allowlist refusé ;
44. redirection hors allowlist refusée ;
45. timeout fournisseur borné ;
46. réponse/stream fournisseur surdimensionné arrêté proprement ;
47. absence de secret dans les erreurs/traces après échec HTTP.

## Résultat de l'audit corrigé

- Frontière 5.6/5.7 : **CONFORME après C1/C2** ;
- Scheduler 5.4 / leases / fencing / fairness : **CONFORME** ;
- Quotas/cadence 5.5 : **CONFORME** ;
- Temporalité / pré-1970 : **CONFORME après C3** ;
- Sécurité fournisseur : **CONFORME après C4** ;
- Contrat UI : **CONFORME**, sous réserve de respecter C1 dans les libellés du graphe source ;
- Gate documentaire : **CORRECTIONS D'AUDIT FERMÉES**.

## Gate

La fermeture documentaire de ces constats **n'autorise pas l'implémentation du Lot 5.6**.

État :

- Concept 5.6 : formalisé ;
- UI Contract 5.6 : formalisé ;
- Acceptance 5.6 : formalisée ;
- audit croisé : effectué ;
- constats audit : corrigés par le présent addendum normatif ;
- validation mainteneur autorisant l'implémentation : **NON ACCORDÉE** ;
- Lots 5.7+ : **NON AUTORISÉS**.

La prochaine étape est une **revue post-corrections** puis, uniquement si elle est concluante, une décision explicite du mainteneur sur l'autorisation du Lot 5.6.
