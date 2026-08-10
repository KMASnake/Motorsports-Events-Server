# Passation de démarrage — Lot 4.3 Sessions

## État de référence

Le Lot 4.2 est validé et fusionné dans `main` via la PR #25. Sa passation finale
est `docs/handoff/LOT-4.2-FINAL-HANDOFF.md`.

Branche de travail du nouveau lot : `codex/lot-4.3-sessions`.

## Ordre de lecture obligatoire

1. `PROJECT-HANDBOOK.md` ;
2. `CODEX-HANDBOOK.md` ;
3. `CODEX.md` ;
4. `PROJECT-STATUS.json` ;
5. `docs/handoff/PROGRESS.json` ;
6. `docs/handoff/LOT-4.2-FINAL-HANDOFF.md` ;
7. `docs/handoff/LOT-4.3-SESSIONS-SPEC.md` ;
8. `docs/handoff/LOT-4.3-SESSIONS-ACCEPTANCE.md`.

## Décision de démarrage

Le Lot 4.3 est spécifié et sa migration est validée sur VPS isolé. Codex ne
doit pas commencer par modifier l'interface. L'ordre recommandé est :

1. modèle de données et ADR/migration ;
2. API et contrats de types ;
3. tests PostgreSQL et sécurité ;
4. API publique ;
5. interface d'administration ;
6. scénarios Chromium et non-régression Lot 4.2 ;
7. recette VPS isolée ;
8. recette Windows et validation utilisateur.

## Contraintes héritées du Lot 4.2

- stockage des dates en UTC ;
- migrations versionnées et rollback obligatoire ;
- authentification/autorisation admin obligatoire ;
- aucune métadonnée fournisseur dans l'API publique ;
- formulaires métier sans champs techniques inutiles ;
- journal d'audit sans secrets ;
- données de recette synthétiques et reproductibles ;
- CI sur le SHA exact avant validation finale ;
- aucune opération de recette sur la production.

## Dette technique à intégrer à la conception

Deux réserves de l'audit pré-fusion Lot 4.2 doivent être traitées comme décisions
d'architecture du Lot 4.3, sans bloquer la spécification fonctionnelle :

1. atomicité ou stratégie de reprise si le journal d'audit échoue après une
   mutation métier ;
2. séparation entre les actions administratives humaines et une ingestion
   fournisseur automatisée future.

## Première tâche Codex — terminée

Avant tout code : produire l'ADR du modèle Sessions et le plan de migration,
puis vérifier qu'ils satisfont `LOT-4.3-SESSIONS-SPEC.md` et
`LOT-4.3-SESSIONS-ACCEPTANCE.md`.

Aucune fusion dans `main` ni déclaration de validation du Lot 4.3 complet n'est
autorisée avant exécution complète de la recette du lot.

## Avancement

L'ADR `docs/handbook/architecture/ADR-0012-SESSIONS-MODEL.md`, le plan détaillé
et la migration `0004_sessions` sont validés explicitement. La recette VPS a
conservé l'empreinte Lot 4.2 `cb816e2a25fc9cb3d11f0604b3506c03`.

Avancement réel : 20 %. La prochaine étape est l'API Sessions et les contrats
de types partagés. Aucun code API Sessions ni changement d'interface n'a encore
été produit.
