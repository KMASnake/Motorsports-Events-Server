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

5.7-P-F2-RPV est maintainer-validated par sa preuve séparée. La validation
Events/Meeting initiale n'avait elle-même déclenché aucun appel fournisseur.

Gate F reste incomplète. Production Preview, onboarding client externe, Lot
5.7 complet, Lot 5.8+ et merge vers `main` restent non autorisés.

## Extension validée — édition contrôlée de `Event.category`

Date : 2026-08-28

SHA applicatif validé : `4b22f5315cfc03a54bd56c03eec34b80eea99b33`

Résultat mainteneur préproduction : **PASS**

La recette graphique a confirmé sur la session Race du Dutch Grand Prix :

- Catégorie est un select sans texte libre ;
- les valeurs canoniques sont `practice`, `qualifying`, `sprint`, `race` et `other` ;
- les libellés visibles sont Non définie, Essais, Qualifications, Sprint, Course et Autre ;
- la valeur provider `race` est préremplie et présentée comme « Course » ;
- Épreuve reste en lecture seule et les autres champs restent correctement préremplis.

Le cycle provider-origin complet est validé :

1. modification exclusive `category: race -> qualifying` ;
2. création d'une seule correction locale Catégorie, avec valeur fournisseur `race` et valeur effective `qualifying` ;
3. `session_title=Race`, Meeting Dutch Grand Prix, circuit et horaires inchangés ;
4. restauration fournisseur ;
5. retour à `category=race`, affichée « Course », sans correction résiduelle.

L'API, le Web et PostgreSQL étaient healthy. Le worker est resté arrêté. Aucun
appel fournisseur supplémentaire n'a été effectué : le compteur réel reste à
quatre, sans cinquième charge. Le provider et la préproduction n'ont subi
aucune autre mutation.

Cette validation ne clôt pas Gate F et n'autorise ni Production Preview, ni
onboarding externe, ni Lot 5.7 complet, ni Lot 5.8+, ni merge vers `main`.
