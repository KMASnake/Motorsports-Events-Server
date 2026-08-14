# Lot 5.6 — Corrections de l'audit croisé

Date : 2026-08-14
Statut : **CORRECTIONS NORMATIVES APPLIQUÉES — IMPLÉMENTATION NON AUTORISÉE**

Ce document ferme les quatre constats issus de l'audit croisé :

`Concept 5.6 ↔ UI Contract 5.6 ↔ Acceptance 5.6 ↔ 5.4 ↔ 5.5 ↔ sécurité ↔ frontière 5.7`.

Il complète et clarifie `LOT-5.6-ACQUISITION-CONCEPT.md`, `LOT-5.6-UI-CONTRACT.md` et `LOT-5.6-ACCEPTANCE.md`. En cas d'ambiguïté sur les quatre points ci-dessous, les règles du `PROJECT-HANDBOOK.md` restent supérieures et les présentes clarifications sont obligatoires pour 5.6.

## C1 — Graphe source épreuve/session ≠ modèle métier Event→Sessions

Le stockage 5.6 d'une structure fournisseur `meeting/event + session` est **strictement un graphe source technique**.

Il ne réintroduit jamais un modèle métier où un Événement possède une collection de Sessions.

Le modèle métier permanent reste celui du Handbook/ADR-0013 : **un Événement représente directement une Session métier** et `session_title` est un attribut de cet Événement.

Conséquences obligatoires :

- `entity_kind=meeting/event/session` décrit uniquement la taxonomie native du fournisseur ;
- les relations parent/enfant source restent confinées au stockage d'acquisition/replay ;
- aucune API métier/publique ni mutation administrative métier ne doit exposer cette structure comme modèle Event→Sessions ;
- 5.6 ne crée aucune collection métier de Sessions ;
- 5.7 reste responsable de projeter ce graphe source vers le modèle métier Event-as-Session.

### Critère d'acceptation ajouté — AC-5.6-003

**Accepté si :** une fixture fournisseur contenant un meeting avec plusieurs sessions est persistée fidèlement côté source, mais aucune collection métier `Event.sessions` ni relation métier Event→Sessions n'est créée/exposée.

**Refus si :** l'implémentation 5.6 réintroduit, directement ou indirectement, le modèle métier abandonné Event→Sessions.

## C2 — Protection technique des overrides dès 5.6

La phrase « réconciliation métier définitive reste 5.7 » ne reporte **jamais** la protection technique des corrections locales.

Dès 5.6 :

- une synchronisation fournisseur peut mettre à jour la valeur source ;
- elle ne peut ni supprimer, ni écraser, ni rendre inactive une correction manuelle existante ;
- source + override + audit doivent conserver les garanties transactionnelles et de sérialisation déjà imposées par le Handbook ;
- un conflit/convergence source-vers-override est traçable ;
- la valeur effective existante reste protégée conformément au modèle permanent.

5.7 décide uniquement de la **réconciliation métier définitive** et des règles de projection/rapprochement ; il n'est pas nécessaire d'attendre 5.7 pour garantir l'intégrité d'un override.

### Critère d'acceptation ajouté — AC-5.6-112

**Accepté si :** un changement fournisseur concurrent à une correction locale met à jour la source et son journal sans perdre/modifier l'override, avec transaction/sérialisation cohérente.

**Refus si :** une synchronisation 5.6 peut écraser, supprimer ou désactiver un override, même temporairement.

## C3 — J, J+30 et finalization : instants UTC stables

Les classifications temporelles 5.6 doivent être déterministes entre workers et stables autour de minuit et des changements d'heure.

Règles :

- les instants persistés et comparés sont en UTC conformément au Handbook ;
- aucune durée n'est calculée en ajoutant naïvement un nombre fixe de secondes à une date civile lorsque cela changerait la sémantique attendue ;
- la détermination de `J` utilise explicitement le contexte temporel défini par l'adaptateur/provider lorsque la notion fournisseur est locale, puis convertit les bornes en instants UTC ;
- à défaut de contexte local fournisseur fiable, la règle de référence est UTC et doit être déterministe ;
- `J→J+30` désigne 30 jours calendaires selon ce contexte, pas une hypothèse implicite de 720 heures locales ;
- la grâce de finalisation de 30 jours est calculée à partir de la fin théorique sous forme d'instant et doit produire le même résultat quel que soit le worker ;
- le fallback `civil_day_fallback` utilise explicitement la fin du jour civil dans le fuseau pertinent puis la convertit en UTC ;
- DST, minuit et changement d'année ne doivent ni dupliquer ni perdre un événement.

### Critère d'acceptation ajouté — AC-5.6-043

Les tests couvrent au minimum :

- événement autour de minuit ;
- passage heure d'été → heure d'hiver ;
- passage heure d'hiver → heure d'été ;
- deux workers évaluant le même instant ;
- frontière exacte J+30 ;
- frontière exacte fin théorique + 30 jours ;
- `civil_day_fallback` dans un fuseau avec DST.

**Accepté si :** la classification et les échéances sont identiques et déterministes après conversion UTC.

## C4 — Baseline HTTP fournisseur obligatoire

5.6 hérite sans exception de la baseline sécurité permanente de l'ADR-0016/Handbook.

Tout appel fournisseur 5.6 doit utiliser la frontière HTTP fournisseur existante et respecter au minimum :

- HTTPS uniquement ;
- destination autorisée par allowlist ;
- refus des redirections/destinations qui sortent de la politique autorisée ;
- timeout borné ;
- streaming/réponse bornés ;
- limites de taille avant parsing/persistance ;
- validation défensive des données ;
- redaction des secrets ;
- aucun credential dans logs, erreurs, journal fonctionnel, UI ou stockage source ;
- pagination hostile/bouclante arrêtée ;
- aucune nouvelle primitive HTTP parallèle contournant cette frontière.

### Critère d'acceptation ajouté — AC-5.6-156

**Accepté si :** les tests prouvent que l'acquisition 5.6 passe par la frontière HTTP sécurisée existante et qu'une destination hors allowlist, HTTP non TLS, réponse hors limite, timeout et redirection interdite échouent de manière contrôlée sans fuite de secret ni avancement indu du checkpoint.

**Refus si :** un adaptateur 5.6 peut ouvrir directement une sortie réseau contournant la baseline.

## Mise à jour de la matrice de tests minimum

Aux 34 scénarios déjà exigés par `LOT-5.6-ACCEPTANCE.md` s'ajoutent obligatoirement :

35. meeting + plusieurs sessions source sans création d'un modèle métier Event→Sessions ;
36. synchronisation concurrente à un override avec conservation transactionnelle de l'override ;
37. classifications J/J+30/finalization autour de minuit et DST ;
38. déterminisme temporel entre workers ;
39. frontière HTTP : HTTPS/allowlist/redirection ;
40. timeout et réponse/stream hors limite sans checkpoint avancé ;
41. preuve qu'aucun adaptateur 5.6 ne contourne la primitive HTTP sécurisée existante.

## Résultat de correction

Les quatre constats de l'audit sont fermés **au niveau conception/acceptance** :

- P1 modèle Event/Session : **FERMÉ** ;
- P2 protection des overrides : **FERMÉ** ;
- P2 déterminisme temporel/DST : **FERMÉ** ;
- P3 héritage baseline HTTP : **FERMÉ**.

Ces fermetures signifient que la documentation est corrigée ; elles ne constituent aucune preuve d'implémentation.

## Gate

Après ces corrections :

- Concept 5.6 : formalisé + clarifié par audit ;
- UI Contract 5.6 : formalisé + clarifié par audit ;
- Acceptance 5.6 : formalisée + critères AC-5.6-003/043/112/156 ajoutés par le présent addendum normatif ;
- constats de l'audit croisé : **CORRIGÉS** ;
- ré-audit documentaire : **À FAIRE** ;
- validation mainteneur autorisant l'implémentation : **NON ACCORDÉE**.

**Le Lot 5.6 reste NON AUTORISÉ pour l'implémentation.**
