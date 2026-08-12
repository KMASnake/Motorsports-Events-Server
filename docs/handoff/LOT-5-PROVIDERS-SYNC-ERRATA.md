# Lot 5 — Errata Fournisseurs et synchronisation

Date : 2026-08-12

Statut : correction validée par le mainteneur

## Règle générale — configuration de source par championnat

Un fournisseur n'implique pas nécessairement un endpoint unique pour tous les championnats qu'il expose.

Chaque championnat rattaché à une instance fournisseur peut posséder une **configuration de source spécifique à l'adaptateur**, notamment :

- endpoint ou chemin d'endpoint ;
- identifiant, slug ou league ID ;
- endpoint de saisons s'il diffère ;
- stratégie de découverte ;
- stratégie de récupération/pagination ;
- autres paramètres strictement nécessaires à cet adaptateur.

Cette configuration appartient au lien/flux `fournisseur + championnat`. Elle ne crée pas un nouveau fournisseur et ne doit pas être interprétée par le cœur générique de synchronisation.

L'adaptateur du fournisseur est responsable de lire cette configuration et de sélectionner la bonne stratégie d'accès à l'API.

Le modèle doit donc permettre :

```text
Provider instance
  └── Championship stream
        └── adapter-specific source configuration
```

et non supposer :

```text
Provider instance
  └── one endpoint shared identically by every championship
```

Le formulaire d'ajout/configuration manuel d'un championnat reste spécifique à l'adaptateur et doit exposer uniquement les paramètres utiles au championnat concerné.

La découverte automatique, lorsqu'elle est possible, peut préremplir cette configuration de source. Le championnat reste ensuite `Découvert — non synchronisé` jusqu'à activation explicite.

Le schéma de configuration doit rester suffisamment générique pour permettre à un même fournisseur d'avoir plusieurs stratégies d'endpoint sans ajouter des conditions codées en dur par nom de championnat dans le moteur générique.

## Cas connu — WRC chez OCBlackTop

Le WRC n'est **pas** un fournisseur distinct.

Le WRC est fourni par **OCBlackTop**, avec un endpoint/une stratégie de source différente de celle de plusieurs autres championnats OCBlackTop.

Le WRC est donc un exemple connu de la règle générale ci-dessus, et non une exception structurelle à coder en dur.

Conséquences obligatoires :

- ne pas créer d'adaptateur fournisseur `WRC` indépendant ;
- ne pas créer d'instance fournisseur WRC séparée uniquement pour cette particularité ;
- le WRC utilise l'adaptateur `OCBlackTop` ;
- la configuration du flux `OCBlackTop + WRC` sélectionne l'endpoint/la stratégie adaptée ;
- la logique de découverte, saisons et récupération WRC peut être spécialisée dans l'adaptateur OCBlackTop ;
- éviter autant que possible une logique du type `if championship === WRC` lorsque le comportement peut être représenté par une stratégie/configuration d'adaptateur ;
- cette spécialisation ne doit pas contaminer le cœur générique du scheduler/synchroniseur ;
- le flux WRC possède son propre curseur, sa saison, sa phase, ses leases et son état ;
- quotas, secrets, cadence et compteurs restent ceux de l'instance OCBlackTop et sont partagés avec les autres flux OCBlackTop selon le round-robin et les règles de réserve.

La logique spéciale déjà utilisée dans le plugin MyBB reste une référence fonctionnelle pour comprendre l'accès WRC, mais le Lot 5 doit généraliser le mécanisme afin que d'autres championnats puissent eux aussi utiliser un endpoint ou une stratégie différente.

## Priorité documentaire

Cette correction **supplante** toute formulation antérieure de `docs/handoff/LOT-5-PROVIDERS-SYNC-CONCEPT.md` ou de prompts Codex qui :

- présenterait le WRC comme fournisseur/adaptateur indépendant ;
- supposerait un endpoint unique par fournisseur ;
- limiterait la configuration d'endpoint spécifique au seul WRC.

La Phase 0 doit intégrer cette règle générale dans la spécification, le modèle DB, les contrats d'adaptateurs, les formulaires spécifiques et la matrice de tests avant toute implémentation.