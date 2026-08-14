# Lot 5.6 — Acquisition fournisseur durable — Concept

## Statut

- Conception fonctionnelle revue avec le mainteneur le 2026-08-14.
- Ce document formalise le Lot 5.6 mais **n'autorise pas son implémentation**.
- Le Lot 5.6 reste à 0 % tant que son Acceptance, ses maquettes et l'audit croisé avec 5.4/5.5/5.7/sécurité n'ont pas été validés explicitement par le mainteneur.

## Objectif

Le Lot 5.6 transforme l'infrastructure Providers/Scheduler/Quotas des lots 5.1 à 5.5 en une véritable chaîne d'acquisition fournisseur durable.

Sa responsabilité est de :

- appeler réellement les fournisseurs via les adaptateurs autorisés ;
- récupérer les données futures et historiques disponibles ;
- paginer et reprendre les parcours ;
- conserver des checkpoints persistants ;
- stocker une représentation source structurée et rejouable ;
- tracer les changements et anomalies ;
- alimenter les futurs traitements 5.7 sans effectuer la transformation métier définitive.

## Frontière 5.6 / 5.7

### Lot 5.6

Le Lot 5.6 possède :

- acquisition HTTP réelle ;
- bootstrap ;
- current ;
- recent_catchup ;
- deep_history ;
- finalization ;
- pagination/curseurs ;
- reprise sur checkpoint ;
- stockage source durable ;
- journaux de changements ;
- observations de présence/absence ;
- anomalies d'acquisition ;
- actions administratives de resynchronisation source.

### Lot 5.7

Le Lot 5.7 conserve :

- normalisation métier définitive ;
- mappings inter-fournisseurs ;
- idempotence métier finale ;
- rapprochement/fusion définitive d'identités ;
- politique métier de présence/absence fournisseur ;
- réconciliation définitive avec les corrections locales ;
- transformation de la source vers les objets métier publiables.

Invariant : **5.6 acquiert et conserve fidèlement la source ; 5.7 décide comment cette source devient la donnée métier définitive.**

## Relation avec 5.4 et 5.5

5.6 ne crée aucun scheduler parallèle et aucune politique de quota indépendante.

5.4 reste responsable de :

- sélection des unités de travail ;
- priorités et fairness ;
- leases ;
- heartbeat ;
- fencing ;
- crash recovery ;
- concurrence globale/provider ;
- Sync now comme boost sans bypass.

5.5 reste responsable de :

- quotas ;
- cadence ;
- réserve current ;
- backoffs ;
- Retry-After ;
- next_eligible_at ;
- comptage des appels réels.

5.6 fournit des unités de travail et leurs priorités métier ; la cadence réelle reste déterminée par 5.4 + 5.5.

## Modèle temporel

### Current

`current` comprend **tous les événements futurs disponibles chez le fournisseur à partir de la date du jour, jusqu'à épuisement des données futures disponibles**.

La récupération future ne s'arrête jamais à J+30.

### Fenêtre chaude

Une sous-zone `current-hot` couvre par défaut :

- J → J+30 ;
- valeur configurable.

Cette fenêtre sert uniquement à augmenter la priorité de rafraîchissement des événements proches. Elle ne fixe pas une fréquence d'appel et ne limite pas l'acquisition du futur.

Les événements au-delà de J+30 restent dans `current-future`.

### Recent catchup

`recent_catchup` couvre la partie passée de la saison courante lors du bootstrap initial.

Il ne constitue pas un cycle périodique permanent et n'est pas relancé automatiquement après une simple désactivation/réactivation d'un championnat.

### Deep history

`deep_history` couvre les saisons précédentes.

Par défaut :

- remonter tout l'historique fournisseur disponible ;
- possibilité par championnat de configurer :
  - tout l'historique ;
  - depuis une saison donnée ;
  - aucun historique.

L'exploration s'arrête automatiquement après **5 saisons consécutives complètement et valablement parcourues sans aucune donnée**, valeur configurable.

Une erreur, un 429, un timeout, une authentification refusée, une pagination incomplète, une erreur de parsing ou un arrêt quota ne comptent jamais comme saison vide.

Si une saison vide est suivie d'une saison contenant des données, le compteur de saisons vides consécutives est remis à zéro.

### Finalization

Après la fin d'un événement, il reste éligible à l'acquisition pendant **30 jours par défaut, configurable** afin de récupérer des modifications tardives.

Au-delà des 30 jours :

- l'événement sort du cycle automatique normal ;
- si le fournisseur ne l'identifie toujours pas comme terminé, créer/maintenir une anomalie persistante `event_not_finalized_after_grace_period` ;
- ne jamais forcer artificiellement le statut métier ;
- ne jamais prolonger silencieusement la finalisation à l'infini.

## Priorités métier

Ordre validé :

1. `finalization` ≈ `current-hot` ;
2. `current-future` ;
3. `recent_catchup` ;
4. `deep_history`.

Ces priorités ne remplacent pas le modèle 3/2/1 du scheduler 5.4.

- `finalization`, `current-hot` et `current-future` restent des sous-priorités du domaine `current` ;
- `recent_catchup` reste la classe intermédiaire ;
- `deep_history` reste la classe basse ;
- la fairness doit empêcher l'affamement des classes inférieures.

## Bootstrap initial

À l'activation initiale d'un championnat :

1. acquérir tout le futur `current` disponible ;
2. compléter la partie passée de la saison courante via `recent_catchup` ;
3. poursuivre les saisons précédentes via `deep_history`.

Les travaux restent soumis au scheduler, aux quotas, aux leases et au fencing.

## Réactivation

Lorsqu'un championnat déjà acquis est réactivé :

- ne pas resynchroniser automatiquement les événements passés déjà acquis ;
- relancer `current` ;
- reprendre `deep_history` exactement au dernier checkpoint s'il était incomplet ;
- si `deep_history` était terminé, il reste terminé ;
- ensuite se contenter de `current` + `finalization`.

Une reconstruction historique n'est déclenchée que par une action administrative explicite.

La durée de désactivation ne supprime ni les données source ni les checkpoints.

## Stockage source durable

5.6 ne stocke pas systématiquement le payload HTTP brut complet.

Il conserve une représentation source :

- structurée ;
- durable ;
- rejouable ;
- suffisamment riche pour que 5.7 puisse retravailler les données sans rappeler le fournisseur.

Champs conceptuels minimaux :

- provider_instance_id ;
- championship_source_id ;
- entity_kind ;
- external_id ou source_key synthétique explicitement marquée ;
- parent source lorsque pertinent ;
- saison ;
- champs source nécessaires ;
- provenance ;
- timestamps d'acquisition/mise à jour ;
- run/checkpoint associé ;
- métadonnées techniques non sensibles nécessaires au replay.

Interdits :

- Authorization ;
- cookies ;
- API keys/tokens ;
- headers bruts ;
- bodies complets conservés « au cas où » ;
- URLs credentialisées ;
- secrets adaptateur.

## Identité source

Unicité conceptuelle :

`provider_instance_id + championship_source_id + entity_kind + external_id`

`entity_kind` distingue au minimum les niveaux source tels que `event/meeting` et `session`.

Si le provider ne fournit aucun identifiant stable :

- l'adaptateur peut produire une clé source déterministe ;
- elle doit être explicitement marquée comme synthétique ;
- elle ne doit jamais être présentée comme une identité fournisseur native ;
- la situation doit rester visible pour 5.7.

## Structure épreuve / sessions

Lorsque le fournisseur expose :

- une épreuve/week-end ;
- et des sessions rattachées ;

5.6 conserve les deux niveaux et leurs identités source.

Lorsqu'un provider n'expose qu'un seul niveau, 5.6 n'en invente pas un.

L'harmonisation entre structures F1/MotoGP/WRC/WSBK/etc. reste 5.7.

## Changements d'identité fournisseur

Si un provider change l'ID d'un élément :

- 5.6 ne fusionne pas automatiquement les deux identités ;
- il peut signaler un candidat de rapprochement si plusieurs indices concordent ;
- la décision de fusion définitive appartient à 5.7.

Une mauvaise fusion automatique est considérée plus dangereuse qu'un doublon source temporaire signalé.

## Pas de doublons de versions source

Pour une même identité source :

- conserver une seule représentation source courante ;
- appliquer les nouvelles valeurs source par upsert ;
- ne pas créer une copie complète par synchronisation ;
- journaliser les vrais changements de valeur.

Exemple : si un horaire fournisseur passe de 14:00 à 15:00 puis 15:30, le journal fonctionnel conserve les deux changements successifs sans dupliquer l'objet source complet.

## Corrections manuelles

Une acquisition fournisseur peut mettre à jour la valeur source mais ne doit jamais supprimer ou écraser une correction manuelle existante.

Le journal doit pouvoir signaler :

- changement source avec correction locale active ;
- convergence éventuelle source/correction ;
- origine provider/admin.

La décision de réconciliation métier finale reste 5.7.

## Checkpoints et reprise

Chaque parcours durable conserve un checkpoint persistant suffisamment précis :

- provider ;
- championnat/source ;
- flux ;
- saison ;
- page/curseur ou unité adaptateur ;
- état confirmé.

Invariant : **le checkpoint n'avance qu'après persistance complète et réussie de l'unité acquise.**

Après crash, restart, quota, perte de lease ou interruption :

- reprendre depuis le dernier checkpoint sûr ;
- ne pas recommencer tout le bootstrap.

Si une page a été appelée mais n'a pas été commitée durablement, elle est rejouée.

## Pagination / curseur invalidé

Un curseur fournisseur n'est jamais considéré comme éternel.

Si, à la reprise :

- le curseur est refusé ;
- il a expiré ;
- la stratégie de pagination a changé ;

alors redémarrer uniquement **la plus petite unité sûre**, généralement la saison en cours.

Les upserts empêchent la création de doublons.

Pendant ce replay, aucune preuve d'absence ne peut être produite avant nouveau parcours complet réussi.

## Transaction d'une unité d'acquisition

Une unité/page fournisseur est traitée transactionnellement.

- les éléments valides sont upsertés ;
- les anomalies événement isolables sont journalisées ;
- le checkpoint avance seulement après persistance complète de tout ce qui était exploitable dans l'unité.

Un événement individuel invalide ne doit pas nécessairement faire rollback toute la page.

En revanche, provoquent rollback et absence d'avancement checkpoint :

- erreur structurelle de flux ;
- pagination incohérente ;
- réponse globalement inexploitable ;
- erreur PostgreSQL ;
- lease/fencing perdu ;
- violation d'intégrité.

## Périmètre complet

Seul l'adaptateur peut déclarer qu'un périmètre a été complètement parcouru.

Il doit fournir une notion explicite de `complete=true` lorsqu'il a atteint de manière certaine la fin du périmètre attendu :

- fin de pagination ;
- curseur terminal ;
- saison explicitement vide ;
- fin de collection prouvée.

Tout arrêt quota, timeout, erreur, curseur invalide, parsing incomplet ou interruption implique `complete=false`.

**Seul `complete=true` permet :**

- `empty_confirmed` ;
- une preuve de non-observation/absence.

## Absence fournisseur

5.6 ne transforme jamais directement l'absence en :

- suppression ;
- annulation ;
- dépublication.

Il enregistre uniquement un fait source de non-observation lors d'un parcours complet et réussi.

La politique métier de présence/absence appartient à 5.7.

## Saison inexistante

Une saison explicitement parcourue complètement et sans donnée devient `empty_confirmed`.

Elle compte dans les 5 saisons vides consécutives de deep_history.

Une saison `empty_confirmed` peut toujours être réinterrogée par action administrative explicite, car un provider peut enrichir ultérieurement son historique.

## Support des dates antérieures à 1970

Invariant obligatoire : **aucune logique de synchronisation, stockage, tri, pagination ou curseur ne doit dépendre d'un Unix timestamp positif.**

Supporter les dates pré-1970 lorsque le fournisseur les fournit.

Interdictions :

- `timestamp > 0` comme test de validité ;
- `0` comme sentinelle implicite de date inconnue ;
- clés métier dépendantes d'un Unix timestamp positif.

Tests attendus au minimum autour de :

- 1969 ;
- 1950 ;
- 1900 lorsque PostgreSQL/adaptateurs le permettent.

## Détermination de la fin théorique

Lorsque `end_at` manque, utiliser la hiérarchie suivante :

1. `end_at` fournisseur si présent ;
2. fin de la dernière session connue de l'épreuve ;
3. estimation basée sur les durées d'éléments comparables du même championnat et du même fournisseur ;
4. règle explicite de l'adaptateur ;
5. dernier recours : fin conservatrice de la date civile concernée.

Pour l'estimation par éléments comparables :

- privilégier le même `entity_kind` / type de session ;
- même championnat + même fournisseur ;
- saisons récentes en priorité ;
- au moins 3 observations comparables ;
- utiliser la médiane des durées plutôt que la moyenne afin de limiter l'influence des valeurs aberrantes.

Toute fin calculée doit être marquée `estimated`, avec sa provenance, par exemple `provider_peer_duration`.

Cette estimation sert au cycle acquisition/finalization 5.6 et ne devient pas silencieusement une donnée métier définitive.

## Anomalie de finalisation

Si 30 jours après la fin théorique un événement n'est toujours pas identifié comme terminé par le provider :

- ouvrir/maintenir `event_not_finalized_after_grace_period` ;
- conserver provider, championnat/source, external ID, fin théorique, provenance de la fin, date d'échéance et dernier statut source connu ;
- ne pas modifier artificiellement le statut ;
- résoudre automatiquement l'anomalie si une acquisition ultérieure fournit enfin un état final cohérent.

## Anomalies d'acquisition

Deux catégories :

### Anomalie événement isolable

Exemples :

- identifiant inexploitable ;
- date invalide ;
- fin antérieure au début ;
- saison incohérente ;
- donnée locale à un élément mal formée.

Comportement :

- journaliser ;
- isoler l'élément ;
- poursuivre les autres éléments valides lorsque l'intégrité du flux global reste fiable.

### Anomalie flux/provider bloquante

Exemples :

- pagination en boucle ;
- réponse globalement incompatible ;
- structure contractuelle cassée ;
- incohérence rendant la complétude impossible à déterminer.

Comportement :

- arrêter proprement le run ;
- ne pas avancer le checkpoint ;
- `complete=false` ;
- déléguer backoff/suspension à 5.5 si applicable.

## Déduplication des anomalies

Une anomalie identique persistante sur le même objet ne crée pas une ligne à chaque run.

Conserver au minimum :

- first_seen_at ;
- last_seen_at ;
- occurrence_count ;
- état ;
- type/cause.

Une nouvelle entrée fonctionnelle peut être créée si :

- la nature de l'anomalie change ;
- elle a été résolue puis réapparaît.

Les vrais changements successifs de valeurs source restent, eux, journalisés individuellement.

## Logs

### Logs techniques

- rétention par défaut : 90 jours ;
- configurable ;
- purge automatique possible ;
- contenu : runs, pagination, durée, compteurs, erreurs, attente quota, checkpoints, etc.

### Journal fonctionnel

- conservation permanente par défaut ;
- pas de payload complet ;
- pas de secret ;
- changements significatifs, anomalies, actions admin, présence de correction locale.

Entrée conceptuelle :

- événement/source ;
- date ;
- provider ;
- run ;
- type de changement ;
- champ ;
- ancienne valeur ;
- nouvelle valeur ;
- origine ;
- correction manuelle active oui/non.

## Actions administratives

Prévoir au minimum :

### Resynchroniser un événement

- utiliser l'endpoint le plus ciblé disponible ;
- sinon le plus petit périmètre fournisseur permettant de le retrouver ;
- upsert sans doublon ;
- quota/lease/fencing obligatoires.

### Resynchroniser une saison

- réouvrir le parcours de la saison ;
- conserver les données existantes ;
- upsert et logs des changements ;
- préserver corrections manuelles.

### Reprendre l'historique

- reprendre au dernier checkpoint deep_history.

### Reconstruire l'historique depuis…

- réouvrir deep_history à partir d'une saison explicitement choisie ;
- possible même lorsque l'historique était déclaré terminé.

Aucune action administrative ne bypass :

- quotas 5.5 ;
- backoffs ;
- leases ;
- fencing ;
- concurrence 5.4.

## Prévisualisation administrative

Une prévisualisation sans appel provider peut être proposée uniquement si les données source nécessaires sont déjà persistées.

Une vraie resynchronisation implique des appels provider et consomme le budget correspondant.

## Supervision ACP

5.6 doit fournir les données backend nécessaires à une supervision claire dans la fiche championnat/provider.

Afficher conceptuellement :

- état général ;
- current : dernier run, prochaine éligibilité, couverture future, dernier événement futur connu ;
- fenêtre chaude J→J+30 ;
- finalization : nombre d'éléments encore suivis ;
- anomalies de finalisation ;
- historique : saison courante, dernière saison terminée, saisons vides consécutives / limite ;
- état `Historique terminé` ;
- checkpoint actuel ;
- dernier run : durée, appels, créés/mis à jour/inchangés/anormaux ;
- anomalies événement/flux ;
- raison de blocage quota/backoff ;
- actions administratives autorisées.

Ne pas afficher un faux pourcentage d'historique lorsqu'aucune borne de départ n'est connue.

Préférer par exemple :

`Exploration : saison 1987 — 2 saisons vides consécutives / 5`

puis :

`Historique complet`

lorsque l'épuisement est confirmé.

## Distinction synchronisation terminée / moteur actif

Un championnat dont `deep_history` est terminé mais dont `current` continue doit être affiché comme actif et synchronisé normalement.

`Historique terminé` ne signifie pas `Synchronisation arrêtée`.

## Maquettes

Les maquettes 5.6 doivent couvrir au minimum :

- état bootstrap ;
- current-hot/current-future ;
- finalization ;
- deep_history en cours ;
- historique terminé ;
- attente quota ;
- anomalie événement ;
- anomalie provider ;
- resynchronisation événement/saison/historique ;
- responsive desktop/mobile.

Elles doivent respecter `docs/handoff/UI_CONTRACT.md` et les maquettes Providers déjà validées. Aucun redesign global libre n'est autorisé.

## Sécurité

Réutiliser intégralement les garanties existantes 5.2 + pré-5.5 :

- secrets chiffrés ;
- HTTPS ;
- SSRF protection ;
- allowlists ;
- timeout ;
- bounded streaming ;
- redaction ;
- admin auth/CSRF ;
- SQL paramétré ;
- audit sans secret.

La représentation source et les logs ne doivent jamais devenir un moyen détourné de persister des réponses sensibles.

## Hors périmètre

5.6 n'implémente pas :

- normalisation métier finale ;
- fusion définitive de doublons/IDs changés ;
- mappings métier complets ;
- décision métier définitive d'absence/suppression ;
- écrasement ou résolution définitive des corrections manuelles ;
- UI pixel-perfect finale Providers (reste 5.9) ;
- notifications externes complètes ;
- Lot 5.7 ou suivants.

## Gate

La présence de ce Concept ne vaut pas autorisation d'implémentation.

Avant tout code 5.6, il faut encore :

1. produire les maquettes/contrats UI 5.6 ;
2. produire `LOT-5.6-ACQUISITION-ACCEPTANCE.md` ;
3. effectuer un audit croisé Concept ↔ Acceptance ↔ 5.4 ↔ 5.5 ↔ frontière 5.7 ↔ sécurité ;
4. corriger tout finding ;
5. obtenir une validation explicite du mainteneur ;
6. seulement ensuite mettre à jour `authorized_sub_lot` pour autoriser 5.6.

Tant que ce gate n'est pas passé : **Lot 5.6 NOT AUTHORIZED**.
