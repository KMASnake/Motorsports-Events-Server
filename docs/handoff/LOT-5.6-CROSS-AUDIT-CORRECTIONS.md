# Lot 5.6 — Corrections de l'audit croisé

Date : 2026-08-14
Statut : **CORRECTIONS NORMATIVES APPLIQUÉES — RÉ-AUDIT PASS — AUTORISATION ACCORDÉE POSTÉRIEUREMENT**

Ce document conserve la preuve historique des quatre constats issus de l'audit croisé :

`Concept 5.6 ↔ UI Contract 5.6 ↔ Acceptance 5.6 ↔ 5.4 ↔ 5.5 ↔ sécurité ↔ frontière 5.7`.

Les corrections ont depuis été consolidées directement dans le Concept et l'Acceptance 5.6. Le ré-audit documentaire/post-corrections est PASS. Le mainteneur a ensuite explicitement autorisé l'implémentation du Lot 5.6 le 2026-08-14 ; voir ADR-0019.

## C1 — Graphe source épreuve/session ≠ modèle métier Event→Sessions

Le stockage 5.6 d'une structure fournisseur `meeting/event + session` est **strictement un graphe source technique**. Il ne réintroduit jamais un modèle métier où un Événement possède une collection de Sessions.

Le modèle métier permanent reste celui du Handbook/ADR-0013 : **un Événement représente directement une Session métier** et `session_title` est un attribut de cet Événement.

Conséquences obligatoires :
- `entity_kind=meeting/event/session` décrit uniquement la taxonomie native du fournisseur ;
- les relations parent/enfant source restent confinées au stockage d'acquisition/replay ;
- aucune API métier/publique ni mutation administrative métier ne doit exposer cette structure comme modèle Event→Sessions ;
- 5.6 ne crée aucune collection métier de Sessions ;
- 5.7 reste responsable de projeter ce graphe source vers le modèle métier Event-as-Session.

**Constat P1 : FERMÉ.**

## C2 — Protection technique des overrides dès 5.6

Dès 5.6, une synchronisation fournisseur peut mettre à jour la valeur source mais ne peut ni supprimer, ni écraser, ni rendre inactive une correction manuelle existante. Source + override + audit conservent les garanties transactionnelles et de sérialisation du Handbook. 5.7 décide uniquement de la réconciliation métier définitive.

**Constat P2 overrides : FERMÉ.**

## C3 — J, J+30 et finalization : instants UTC stables

Les classifications temporelles 5.6 sont déterministes entre workers, normalisées en UTC, explicites quant au contexte civil/fuseau, et testées à minuit, aux transitions DST, à J+30, à fin théorique +30 jours et pour les dates pré-1970.

**Constat P2 temporalité : FERMÉ.**

## C4 — Baseline HTTP fournisseur obligatoire

5.6 hérite sans exception de l'ADR-0016 : HTTPS uniquement, allowlist, refus des redirections/destinations interdites, timeout et streaming/taille bornés, parsing défensif, redaction, absence de secrets et impossibilité pour un adaptateur de contourner la frontière HTTP sécurisée.

**Constat P3 sécurité HTTP : FERMÉ.**

## Matrice Acceptance

Les exigences issues de ce document sont désormais consolidées dans `LOT-5.6-ACCEPTANCE.md`, dont la matrice normative compte **47 scénarios minimum**. Ce document n'est plus nécessaire pour découvrir les critères ; il reste une preuve historique de leur origine.

## Résultat post-corrections

- P1 modèle Event/Session : **FERMÉ** ;
- P2 protection des overrides : **FERMÉ** ;
- P2 déterminisme temporel/DST : **FERMÉ** ;
- P3 héritage baseline HTTP : **FERMÉ** ;
- ré-audit documentaire : **PASS** ;
- revue post-corrections : **PASS**.

## Gate courant

Au moment de la première rédaction de ce document, l'implémentation n'était pas encore autorisée. Cette mention est désormais historique.

Après la consolidation et le ré-audit, le mainteneur a explicitement déclaré le 2026-08-14 : **« Je valide et j'autorise l'implémentation du lot 5.6 »**.

État actuel :

- `authorized_sub_lot = 5.6` ;
- Lot 5.6 : **AUTORISÉ À L'IMPLÉMENTATION** ;
- validation finale de l'implémentation : **NON ENCORE ACQUISE** ;
- fusion dans `main` : non autorisée par ce gate ;
- Lots 5.7+ : **NON AUTORISÉS À L'IMPLÉMENTATION**.

Voir `docs/handbook/architecture/ADR-0019-LOT-5.6-ACQUISITION-AUTHORIZATION.md`.