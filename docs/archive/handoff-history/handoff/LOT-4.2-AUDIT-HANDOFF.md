# Passation complète — audit du lot 4.2

## Reprise immédiate

La branche de travail est `codex/lot-4.2-complete`.

Avant toute modification, lire :

1. `PROJECT-HANDBOOK.md` ;
2. `CODEX-HANDBOOK.md` ;
3. `CODEX.md` ;
4. `PROJECT-STATUS.json` ;
5. `docs/handoff/PROGRESS.json` ;
6. `docs/handoff/LOT-4.2-CODE-AUDIT-2026-08-03.md` ;
7. `docs/handoff/LOT-4.2-AUDIT-ACTION-PLAN.md`.

## Décision active

- décision de revue : `CHANGES REQUESTED` ;
- fusion dans `main` : non autorisée ;
- nouvelles fonctionnalités : suspendues jusqu'à fermeture des P1 ;
- validation utilisateur globale du lot 4.2 : non acquise ;
- production : ne pas modifier.

## Travail attribué à Codex

Codex doit traiter dans cet ordre :

1. migration non destructive et rollback ;
2. validation typée des corrections ;
3. sécurité et tests des routes administratives ;
4. pagination serveur, filtres et audit des mutations ;
5. concurrence, rollback et interactions calendrier ;
6. avis npm de sévérité élevée ;
7. CI complète sur le SHA final ;
8. recette Windows et VPS isolé ;
9. validation explicite de l'utilisateur.

## Suivi obligatoire

Après chaque étape, mettre à jour :

- `PROJECT-STATUS.json` ;
- `docs/handoff/PROGRESS.json` ;
- `CHANGELOG.md` lorsque du code ou un comportement change ;
- les tests et documents d'acceptation concernés.

Le compte rendu doit fournir les fichiers modifiés, les commandes exécutées, les
résultats exacts, les risques résiduels, le rollback et le pourcentage de
remédiation.

## Critère de sortie

Le lot ne redevient candidat à la fusion que lorsque :

- les quatre P1 sont fermés avec preuves ;
- les P2 obligatoires sont traités ou explicitement décidés ;
- la CI du SHA final est verte avec les versions Node/npm supportées ;
- les recettes Windows et VPS isolé sont réussies ;
- l'utilisateur valide explicitement le résultat.
