# Lot 5.7-P-F1-UI — validation préproduction Events/Meeting

Date : 2026-08-27
SHA validé : `e21c9d6f85678236ea92712a8e758957790f7e60`
Build déployé : `2026-08-27T15:17:44Z`
Résultat : **PASS**

## Périmètre validé

Cette preuve consigne uniquement la correction de projection du Meeting parent
dans l'administration Events. Elle ne constitue ni une exécution ni une
validation de 5.7-P-F2-RPV.

Le modèle canonique vérifié sur les données préexistantes de préproduction est :

- `meetings.name` porte le nom de l'épreuve ;
- `events.name` et `events.session_title` portent l'identité et l'intitulé de la session ;
- `meeting_events` relie chaque Event enfant à zéro ou un Meeting parent ;
- l'API admin projette `meeting_id` et `meeting_name` sans modifier l'API publique ;
- un Event autonome conserve `meeting_id=null`, `meeting_name=null` et un Nom public éditable ;
- aucun Meeting artificiel n'est créé.

## Preuves préproduction

Après déploiement, l'API, le Web et PostgreSQL via `/health` étaient healthy.
Le worker est resté arrêté et `/health` exposait exactement le SHA validé.

La vérification directe du modèle canonique a confirmé :

- **Australian Grand Prix** : FP1, FP2, FP3, Qualifying et Race reliés au même Meeting, circuit `albert-park` ;
- **Qualifying australien** : `event_name=Qualifying`, `session_title=Qualifying`, `meeting_name=Australian Grand Prix`, début `2026-03-07 05:00:00+00`, fin `2026-03-07 06:00:00+00` ;
- **Chinese Grand Prix** : FP1, Sprint Q, Sprint, Qualifying et Race reliés au même Meeting ;
- **Japanese Grand Prix** : sessions observées correctement reliées au Meeting Japanese Grand Prix.

Ces preuves confirment que le nom d'épreuve OCBlackTop était déjà acquis et
persisté dans `meetings.name`. Le défaut corrigé concernait uniquement sa
projection dans l'API admin et sa présentation Web. Aucune migration et aucun
appel fournisseur n'ont été nécessaires.

## Validation UI mainteneur

La recette manuelle préproduction est **PASS** pour :

- ouverture d'un Event existant par le chemin d'édition ;
- double-clic calendrier ouvrant « Modifier l'événement », jamais « Nouvel événement » ;
- Épreuve affichant le Meeting parent, distincte de la session ;
- Intitulé de session, circuit et date/heure de fin correctement préremplis ;
- champ Catégorie absent de l'éditeur ;
- aucune régression fonctionnelle observée.

## Frontières maintenues

5.7-P-F2-RPV reste `authorized-not-started` : implémentation non démarrée,
incomplète et non validée. L'autorisation d'une exécution fournisseur réelle
bornée reste inchangée, mais aucune acquisition F2-RPV n'a été exécutée pour
cette validation.

Gate F reste incomplète. Production Preview, onboarding client externe, Lot
5.7 complet, Lot 5.8+ et merge vers `main` restent non autorisés.
