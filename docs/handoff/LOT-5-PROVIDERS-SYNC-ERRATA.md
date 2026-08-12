# Lot 5 — Errata Fournisseurs et synchronisation

Date : 2026-08-12

Statut : correction validée par le mainteneur

## Correction WRC

Le WRC n'est **pas** un fournisseur distinct.

Le WRC est fourni par **OCBlackTop**, mais via un endpoint différent de ceux utilisés pour les autres disciplines/championnats OCBlackTop.

Conséquences obligatoires pour le Lot 5 :

- ne pas créer d'adaptateur fournisseur `WRC` indépendant ;
- ne pas créer d'instance fournisseur WRC séparée uniquement pour cette particularité ;
- le WRC utilise l'adaptateur `OCBlackTop` ;
- l'adaptateur OCBlackTop doit savoir sélectionner/traiter l'endpoint WRC spécifique ;
- la logique de découverte, de saisons et de récupération WRC peut rester spécialisée à l'intérieur de l'adaptateur OCBlackTop ;
- cette spécialisation ne doit pas contaminer le cœur générique du scheduler/synchroniseur ;
- le flux WRC reste un flux `OCBlackTop + championnat WRC`, avec son propre curseur, sa saison, sa phase et son état de synchronisation ;
- quotas, secrets, cadence et compteurs sont ceux de l'instance OCBlackTop concernée, partagés avec les autres flux OCBlackTop selon les règles round-robin et de réserve validées.

Cette correction **supplante** toute formulation antérieure de `docs/handoff/LOT-5-PROVIDERS-SYNC-CONCEPT.md` ou de prompts Codex pouvant laisser entendre que le WRC constitue un fournisseur ou un adaptateur séparé.

La logique spéciale déjà utilisée dans le plugin MyBB reste une référence fonctionnelle : particularité d'endpoint/saisons WRC encapsulée dans OCBlackTop, puis normalisation dans le modèle commun Motorsports Events.
