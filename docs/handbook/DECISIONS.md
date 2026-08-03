# Journal des décisions

## 2026-08-02
- administration orientée métier ;
- slug masqué ;
- origine automatique ;
- fuseau automatique ;
- événements manuels sans correction ;
- corrections fournisseur champ par champ.
- le Project Handbook est la source de vérité des règles permanentes ;
- `docs/handoff/` reste la source canonique des règles et de l'avancement du
  lot courant, tandis que `docs/handover/` conserve l'historique ;
- une fusion dans `main` ne constitue jamais une validation utilisateur.

Voir `architecture/ADR-0008-DOCUMENTATION-GOVERNANCE.md`.

## 2026-08-03

- la valeur fournisseur, l'override local et la valeur effective sont
  réconciliés transactionnellement champ par champ ;
- une synchronisation fournisseur ne remplace jamais un override actif ;
- le retour à la valeur fournisseur supprime l'override actif ;
- les événements manuels refusent toute synchronisation fournisseur.

Voir `architecture/ADR-0003-PROVIDER-CORRECTIONS.md`.

## 2026-08-03 — Édition typée des corrections

- une valeur référencée ou énumérée ne peut pas être modifiée par texte libre ;
- championnat, circuit, statut et publication utilisent une liste contrôlée ;
- début et fin utilisent un sélecteur date et heure ;
- les dates choisies sont converties et persistées en UTC.

Voir `architecture/ADR-0003-PROVIDER-CORRECTIONS.md`.

## 2026-08-03 — Jeux de données de recette

- chaque nouvelle version candidate fournit les données nécessaires pour
  exercer ses nouvelles fonctions sans dépendre de la production ;
- le générateur est reproductible, idempotent, synthétique et sans secret ;
- les commandes d'injection, résultats attendus et tests manuels sont fournis
  avec chaque demande de validation ;
- les états nominaux, erreurs et conflits pertinents doivent être représentés.

Voir `architecture/ADR-0006-HYBRID-TEST-DATA.md`.

## 2026-08-03 — Administration orientée métier

- une création administrative ordinaire génère un slug unique et impose
  l'origine `manual` côté serveur ;
- le fuseau est déduit du circuit et utilise UTC lorsque aucune localisation
  n'est disponible ;
- les mutations administratives ordinaires refusent les métadonnées techniques ;
- l'ingestion fournisseur possède une entrée dédiée et génère l'origine
  `provider` sans réintroduire ces champs dans le formulaire.

Voir `architecture/ADR-0001-ADMINISTRATION-PHILOSOPHY.md` et
`architecture/ADR-0004-TIMEZONES.md`.

## 2026-08-03 — UTC unique et pagination Événements

- la gestion de fuseaux est supprimée du domaine administrable ; tous les
  événements et leur champ de compatibilité `timezone` sont normalisés en UTC ;
- les corrections historiques portant sur le fuseau sont supprimées ;
- la vue Liste affiche 25 événements par page ;
- son ordre par défaut utilise la proximité absolue entre le début de
  l'événement et l'instant courant.

Voir `architecture/ADR-0004-TIMEZONES.md` et
`architecture/ADR-0007-CALENDAR.md`.

## 2026-08-03 — Tri des listes

- le tri s'applique à l'ensemble des événements filtrés avant pagination ;
- le premier affichage conserve l'événement le plus proche de maintenant ;
- un clic sur Date bascule entre ordre chronologique croissant et décroissant ;
- un clic sur une colonne métier bascule entre ordre alphabétique croissant et
  décroissant ;
- tout changement de tri revient à la première page.

Voir `architecture/ADR-0007-CALENDAR.md`.

## 2026-08-03 — Exploitation des corrections

- les filtres de Corrections sont combinables et portent sur l'ensemble des
  dimensions métier prévues par le contrat ;
- un override peut être modifié sans altérer sa valeur fournisseur ;
- l'événement concerné est ouvert directement avec son panneau de détail
  sélectionné ;
- les actions accepter fournisseur, conserver local et supprimer l'override
  continuent d'utiliser le service transactionnel unique.

Voir `architecture/ADR-0003-PROVIDER-CORRECTIONS.md`.
