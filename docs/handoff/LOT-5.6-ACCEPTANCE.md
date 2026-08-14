# Lot 5.6 — Acceptance — Acquisition durable fournisseur

Date : 2026-08-14
Statut : **ACCEPTANCE FORMALISÉE — IMPLÉMENTATION NON AUTORISÉE**

Documents normatifs associés :

- `docs/handoff/LOT-5.6-ACQUISITION-CONCEPT.md`
- `docs/handoff/LOT-5.6-UI-CONTRACT.md`
- règles scheduler / leases / fencing du Lot 5.4
- règles quotas / cadence / backoff du Lot 5.5

## 1. Objet du gate

Le Lot 5.6 est accepté uniquement si l'implémentation future démontre une acquisition fournisseur durable, idempotente, reprenable et observable, sans empiéter sur la transformation métier définitive réservée au Lot 5.7.

Le présent document définit les critères d'acceptation. Il **n'autorise pas l'implémentation**.

## 2. Frontière normative 5.6 / 5.7

### AC-5.6-001 — Acquisition seulement

5.6 acquiert, structure et persiste fidèlement les données fournisseur nécessaires à un traitement ultérieur.

**Accepté si :** les données source sont rejouables sans nouvel appel fournisseur et les décisions de rapprochement métier définitif restent absentes.

### AC-5.6-002 — Pas de réconciliation métier anticipée

5.6 ne doit pas fusionner automatiquement deux identités fournisseur distinctes, supprimer un événement métier pour absence fournisseur ni écraser une correction manuelle.

**Accepté si :** ces situations sont observées/journalisées et laissées à 5.7 ou à une action administrative explicitement autorisée.

## 3. Identité et stockage source

### AC-5.6-010 — Unicité source

L'identité conceptuelle est :

`provider_instance_id + championship_source_id + entity_kind + external_id`

**Accepté si :** deux acquisitions du même objet mettent à jour le même enregistrement et ne créent aucun doublon.

### AC-5.6-011 — Identité synthétique

Si aucun ID fournisseur stable n'existe, une clé déterministe peut être fournie par l'adaptateur et doit être explicitement marquée synthétique.

**Accepté si :** cette identité est stable, traçable et n'est jamais présentée comme une identité fournisseur native.

### AC-5.6-012 — Structure source fidèle

Lorsque le provider expose une épreuve et des sessions, les deux niveaux et leurs relations source sont conservés. Si un niveau n'existe pas, 5.6 ne l'invente pas.

### AC-5.6-013 — Pas de versions source dupliquées

Un objet source possède une représentation courante unique. Les changements significatifs sont consignés dans le journal fonctionnel, pas sous forme de copies intégrales successives.

## 4. Current

### AC-5.6-020 — Étendue future complète

`current` couvre de J jusqu'au dernier événement futur disponible chez le fournisseur.

**Refus si :** J+30 est utilisé comme limite d'import.

### AC-5.6-021 — Fenêtre chaude

J→J+30 est la fenêtre chaude par défaut et est configurable.

**Accepté si :** elle augmente la priorité sans empêcher l'acquisition des événements au-delà de J+30.

### AC-5.6-022 — Aucune fréquence métier fixe

5.6 n'impose aucun `refresh_interval` fixe à `current`, `recent_catchup`, `deep_history` ou `finalization`.

**Accepté si :** la cadence réelle provient de 5.4/5.5.

## 5. Priorités

### AC-5.6-030 — Classes de priorité

L'ordre métier est :

`finalization ≈ current-hot > current-future > recent_catchup > deep_history`

`finalization`, `current-hot` et `current-future` restent dans le domaine prioritaire `current` de 5.4 ; 5.6 ne crée pas de second scheduler.

### AC-5.6-031 — Fairness

**Accepté si :** les sous-priorités supérieures ne peuvent pas affamer indéfiniment `current-future`, `recent_catchup` ou `deep_history` lorsqu'ils sont éligibles.

## 6. Finalisation

### AC-5.6-040 — Fenêtre de finalisation

Un événement terminé reste éligible à la synchronisation pendant 30 jours par défaut, valeur configurable.

### AC-5.6-041 — Fin théorique

Ordre de détermination de la fin :

1. `end_at` fournisseur ;
2. fin de la dernière session connue ;
3. durée médiane d'au moins 3 événements comparables du même fournisseur/championnat/type, en privilégiant les données récentes ;
4. règle fiable explicite de l'adaptateur ;
5. fin de la date civile dans le fuseau pertinent.

Toute fin non directement fournie doit être marquée `estimated` avec sa provenance.

### AC-5.6-042 — Non finalisé après délai

Si l'événement n'est toujours pas identifié comme terminé 30 jours après sa fin théorique, une anomalie persistante `event_not_finalized_after_grace_period` ou équivalente est ouverte.

**Refus si :** 5.6 force artificiellement le statut à terminé ou prolonge silencieusement la finalisation sans anomalie.

## 7. Bootstrap et historique

### AC-5.6-050 — Ordre bootstrap

Bootstrap initial :

1. futur `current` complet ;
2. partie passée de la saison courante (`recent_catchup`) ;
3. saisons précédentes (`deep_history`).

### AC-5.6-051 — Deep history complet par défaut

Par défaut, le moteur remonte jusqu'à épuisement des données fournisseur. Une configuration peut limiter le départ historique ou désactiver l'historique.

### AC-5.6-052 — Cinq saisons vides

Après 5 saisons consécutives complètement et validement parcourues sans donnée exploitable, valeur configurable, `deep_history` est déclaré épuisé.

**Accepté si :** une saison contenant des données remet le compteur de saisons vides à zéro.

### AC-5.6-053 — Erreur ≠ saison vide

Timeout, 429, erreur réseau, authentification, parsing incomplet, interruption, quota ou parcours partiel ne comptent jamais comme saison vide.

### AC-5.6-054 — Saison explicitement vide

Une saison complètement parcourue et réellement vide peut être marquée `empty_confirmed` et compte dans la série des saisons vides.

### AC-5.6-055 — Historique terminé

Une fois `deep_history` terminé, aucun rescan automatique périodique n'est effectué. Le fonctionnement normal se limite à `current` et `finalization`, sauf action administrative explicite.

## 8. Réactivation

### AC-5.6-060 — Pas de rattrapage passé automatique

Après réactivation d'un championnat, les événements passés déjà acquis ne sont pas automatiquement resynchronisés.

### AC-5.6-061 — Reprise ciblée

À la réactivation :

- `current` reprend en priorité ;
- `deep_history` reprend à son checkpoint seulement s'il était incomplet ;
- un historique déjà terminé reste terminé.

## 9. Checkpoints et reprise

### AC-5.6-070 — Checkpoint durable

Le checkpoint persiste au minimum le provider, championnat, flux, saison et mécanisme de pagination/curseur nécessaire à la reprise.

### AC-5.6-071 — Avancement transactionnel

Le checkpoint n'avance qu'après persistance durable de tout ce qui est exploitable dans l'unité d'acquisition ou journalisation explicite des anomalies événement isolables.

### AC-5.6-072 — Crash/rejeu idempotent

Un crash entre appel fournisseur et commit peut provoquer le rejeu de l'unité, mais jamais de doublon source.

### AC-5.6-073 — Curseur invalidé

Si un curseur/page n'est plus réutilisable, le moteur reprend depuis la plus petite unité sûre, généralement la saison concernée.

**Accepté si :** l'historique entier n'est pas recommencé sans nécessité.

### AC-5.6-074 — Fencing/lease

Une perte de lease ou un fencing stale interdit le commit et l'avancement du checkpoint conformément à 5.4.

## 10. Périmètre complet et absences

### AC-5.6-080 — Déclaration `complete`

Seul l'adaptateur peut déclarer qu'un périmètre attendu a été entièrement parcouru (`complete=true`) après une terminaison fournisseur certaine.

### AC-5.6-081 — Partiel = aucune preuve d'absence

Toute interruption, quota, erreur, curseur invalide, parsing incomplet ou pagination inachevée implique `complete=false`.

### AC-5.6-082 — Absence seulement après parcours complet

Une preuve d'absence ou `empty_confirmed` ne peut être produite qu'après `complete=true`.

### AC-5.6-083 — Absence non destructive

Une absence observée ne supprime pas la donnée, ne force pas `cancelled` et ne dépublie rien en 5.6.

## 11. Anomalies

### AC-5.6-090 — Anomalie événement isolable

Une donnée événement invalide peut être isolée et journalisée sans annuler les autres éléments valides de l'unité.

### AC-5.6-091 — Anomalie structurelle

Pagination incohérente, réponse globalement inexploitable, erreur de persistance ou violation de fencing provoquent l'arrêt contrôlé/rollback et empêchent l'avancement du checkpoint.

### AC-5.6-092 — Déduplication des anomalies répétitives

Une anomalie identique persistante est agrégée avec `first_seen_at`, `last_seen_at`, `occurrence_count` et état courant.

Après résolution puis réapparition, une nouvelle occurrence logique peut être créée.

## 12. Dates historiques et pré-1970

### AC-5.6-100 — Dates pré-1970 supportées

Aucune logique ne suppose qu'un timestamp Unix doit être positif.

### AC-5.6-101 — Pas de sentinelle Unix zéro

`0` ne peut pas signifier « date inconnue » lorsqu'il pourrait représenter un instant réel.

### AC-5.6-102 — Tests historiques obligatoires

Les tests couvrent au minimum :

- 1969 ;
- 1950 ;
- un cas autour de 1900 ;
- stockage/relecture PostgreSQL ;
- tri chronologique ;
- sérialisation API ;
- reprise/curseurs lorsque les dates interviennent.

## 13. Corrections manuelles

### AC-5.6-110 — Override préservé

Une mise à jour fournisseur peut actualiser la valeur source mais ne supprime ni n'écrase une correction manuelle active.

### AC-5.6-111 — Traçabilité

Le journal fonctionnel indique lorsqu'un changement fournisseur intervient alors qu'une correction manuelle est active, y compris lorsque la nouvelle valeur fournisseur devient identique à la correction.

## 14. Journalisation et rétention

### AC-5.6-120 — Logs techniques

Rétention par défaut : 90 jours, configurable.

### AC-5.6-121 — Journal fonctionnel

Conservation durable par défaut des changements significatifs, anomalies et actions administratives.

### AC-5.6-122 — Pas de payload brut dans le journal fonctionnel

Le journal ne duplique pas systématiquement les payloads HTTP complets.

### AC-5.6-123 — Aucun secret

Aucun credential, token, header d'authentification ou secret fournisseur ne doit apparaître dans les logs, anomalies, UI ou traces persistées.

## 15. Actions administratives

### AC-5.6-130 — Resynchronisation événement

L'administrateur peut demander la réacquisition du plus petit périmètre permettant de retrouver l'événement.

### AC-5.6-131 — Resynchronisation saison

Une saison peut être reparcourue par upsert, sans duplication ni suppression automatique des corrections manuelles.

### AC-5.6-132 — Reprise/reconstruction historique

L'administrateur peut réouvrir `deep_history` et choisir une saison de départ lorsque nécessaire, même si l'historique avait été déclaré terminé.

### AC-5.6-133 — Aucun bypass

Toutes les actions administratives restent soumises aux quotas/cadence 5.5 et aux leases/fencing 5.4.

### AC-5.6-134 — `empty_confirmed` réinterrogeable

Une saison précédemment vide peut être explicitement resynchronisée.

## 16. UI ACP

### AC-5.6-140 — Contrat UI

L'implémentation respecte intégralement `LOT-5.6-UI-CONTRACT.md` et le contrat UI global.

### AC-5.6-141 — Pas de faux pourcentage historique

Tant que la borne historique n'est pas connue, aucun pourcentage d'avancement inventé n'est affiché.

### AC-5.6-142 — États distincts

L'ACP distingue notamment actif, attente quota, erreur, suspendu, bootstrap en cours et historique terminé.

### AC-5.6-143 — Responsive et accessibilité

Les vues desktop/responsive, navigation clavier, focus visible et états chargement/vide/erreur sont testés conformément au contrat UI global.

## 17. Sécurité

### AC-5.6-150 — Contrôle d'accès ACP

Les actions 5.6 utilisent les contrôles d'accès ACP existants et ne créent aucun chemin public d'administration.

### AC-5.6-151 — Entrées fournisseur non fiables

Toutes les données fournisseur sont considérées non fiables : validation de schéma, bornes de taille et parsing défensif sont obligatoires avant persistance/exposition.

### AC-5.6-152 — Pagination hostile ou bouclante

Une pagination répétitive/bouclante doit être détectée et arrêtée comme anomalie flux/provider ; elle ne peut pas provoquer une boucle infinie.

### AC-5.6-153 — Bornage des ressources

L'acquisition doit empêcher qu'une réponse ou collection fournisseur anormalement volumineuse épuise sans contrôle mémoire, stockage ou workers.

### AC-5.6-154 — Injection / rendu

Les chaînes fournisseur affichées dans l'ACP sont rendues comme données et ne doivent pas permettre XSS/HTML actif ou injection dans les logs structurés.

### AC-5.6-155 — Transactions et concurrence

Les upserts, checkpoints et journaux respectent les transactions, contraintes d'unicité et mécanismes de concurrence nécessaires pour empêcher doublons et commits concurrents incohérents.

## 18. Tests d'acceptation minimum

La suite de tests 5.6 doit démontrer au minimum :

1. bootstrap d'un championnat neuf ;
2. acquisition de tout le futur au-delà de J+30 ;
3. priorité J→J+30 sans starvation du futur éloigné ;
4. finalisation puis anomalie après 30 jours ;
5. estimation de fin par événements comparables et fallback ;
6. recent catchup de saison courante ;
7. deep history sur plusieurs saisons ;
8. remise à zéro du compteur de saisons vides après une saison non vide ;
9. arrêt après 5 saisons vides valides ;
10. erreur/429 ne comptant pas comme saison vide ;
11. crash avant commit puis reprise sans doublon ;
12. curseur expiré puis reprise de la saison seulement ;
13. parcours partiel ne produisant aucune absence ;
14. parcours complet produisant une observation d'absence sans suppression ;
15. anomalie événement isolée sans perte des autres événements ;
16. anomalie structurelle avec rollback/checkpoint inchangé ;
17. perte de lease/fencing stale ;
18. changement source journalisé sans version dupliquée ;
19. correction manuelle préservée ;
20. identité fournisseur modifiée sans fusion automatique ;
21. identité synthétique stable ;
22. épreuve + sessions fidèlement persistées ;
23. dates 1969/1950/~1900 ;
24. désactivation/réactivation sans rescan du passé ;
25. historique terminé ne redémarrant pas automatiquement ;
26. reconstruction administrative d'un historique terminé ;
27. resynchronisation `empty_confirmed` ;
28. anomalies répétitives agrégées ;
29. aucun secret dans logs/UI ;
30. pagination fournisseur bouclante arrêtée ;
31. UI ACP conforme aux états du contrat ;
32. responsive, clavier et focus visible ;
33. cadence réellement déléguée à 5.4/5.5 ;
34. aucune fonctionnalité métier réservée à 5.7 introduite.

## 19. Preuves requises avant validation mainteneur

L'implémentation future ne peut être déclarée acceptée sans :

- tests unitaires et d'intégration verts ;
- tests PostgreSQL réels des transactions/checkpoints ;
- tests concurrence/lease/fencing ;
- fixtures providers couvrant pagination, erreurs et historique profond ;
- preuve des cas pré-1970 ;
- preuve d'absence de doublons après rejeu ;
- preuve d'absence de secrets dans les surfaces observables ;
- captures ACP desktop et responsive ;
- comparaison aux maquettes/contrat UI ;
- audit sécurité ;
- audit de frontière 5.6/5.7 ;
- état documentaire synchronisé.

## 20. Conditions de refus

Le Lot 5.6 doit être refusé notamment si :

- le futur est limité à J+30 ;
- une fréquence fixe contourne 5.5 ;
- une synchronisation partielle produit des absences ;
- une absence supprime automatiquement une donnée ;
- des corrections manuelles sont écrasées ;
- des doublons source apparaissent après rejeu ;
- un checkpoint avance avant persistance durable ;
- les dates pré-1970 échouent ;
- les quotas, leases ou fencing peuvent être contournés ;
- un secret fournisseur est exposé ;
- l'historique est rescanné automatiquement après achèvement ;
- 5.6 effectue une fusion/réconciliation métier réservée à 5.7 ;
- l'UI affiche un faux pourcentage historique ;
- les preuves de tests/audit sont insuffisantes.

## 21. Gate documentaire

État après rédaction de ce document :

- Concept 5.6 : formalisé ;
- Contrat UI 5.6 : formalisé et validé en conception ;
- Acceptance 5.6 : formalisée ;
- audit croisé : **À FAIRE** ;
- corrections issues de l'audit : **À FAIRE SI NÉCESSAIRE** ;
- validation mainteneur d'implémentation : **NON ACCORDÉE**.

## 22. Interdiction normative

**Aucun code du Lot 5.6 ne doit être développé sur la seule base de cette Acceptance.**

L'étape suivante obligatoire est l'audit croisé :

`Concept 5.6 ↔ UI Contract 5.6 ↔ Acceptance 5.6 ↔ scheduler 5.4 ↔ quotas/cadence 5.5 ↔ sécurité ↔ frontière 5.7`.

Le Lot 5.6 reste **NON AUTORISÉ pour l'implémentation** jusqu'à décision mainteneur explicite post-audit.
