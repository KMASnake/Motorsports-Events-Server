# Lot 5.6 — Acceptance — Acquisition durable fournisseur

Date : 2026-08-14
Statut : **ACCEPTANCE CONSOLIDÉE POST-AUDIT — IMPLÉMENTATION AUTORISÉE**

Autorisation mainteneur : **accordée explicitement le 2026-08-14**. Voir `docs/handbook/architecture/ADR-0019-LOT-5.6-ACQUISITION-AUTHORIZATION.md`.

Documents normatifs associés :
- `docs/handoff/LOT-5.6-ACQUISITION-CONCEPT.md`
- `docs/handoff/LOT-5.6-UI-CONTRACT.md`
- `docs/handoff/LOT-5.6-AUDIT-CORRECTIONS.md` (preuve historique de l'audit)
- règles scheduler / leases / fencing du Lot 5.4
- règles quotas / cadence / backoff du Lot 5.5
- `PROJECT-HANDBOOK.md` et ADR permanents applicables

## 1. Objet du gate

Le Lot 5.6 est accepté uniquement si l'implémentation démontre une acquisition fournisseur durable, idempotente, reprenable, observable et sûre, sans empiéter sur la transformation métier définitive réservée au Lot 5.7. Le présent document consolide directement les corrections C1 à C4 de l'audit croisé. **L'implémentation du Lot 5.6 est autorisée ; sa validation finale ne l'est pas encore.**

## 2. Frontière normative 5.6 / 5.7

### AC-5.6-001 — Acquisition seulement
5.6 acquiert, structure et persiste fidèlement les données fournisseur nécessaires à un traitement ultérieur. Les données source sont rejouables sans nouvel appel fournisseur et les décisions de rapprochement métier définitif restent absentes.

### AC-5.6-002 — Pas de réconciliation métier anticipée
5.6 ne fusionne pas automatiquement deux identités fournisseur distinctes, ne supprime pas un événement métier pour absence fournisseur et n'écrase pas une correction manuelle. Ces situations sont observées/journalisées et laissées à 5.7 ou à une action administrative explicitement autorisée.

### AC-5.6-003 — Graphe source ≠ modèle métier
Le stockage 5.6 peut représenter un graphe fournisseur `meeting/event → sessions` uniquement comme structure technique d'acquisition. Il ne réintroduit jamais un workflow métier `Event → Sessions`. Le modèle permanent du Handbook/ADR-0013 reste : un Événement métier représente directement une Session métier, avec `session_title` facultatif. La transformation du graphe source vers les Événements métier appartient à 5.7.

## 3. Identité et stockage source

### AC-5.6-010 — Unicité source
Identité conceptuelle : `provider_instance_id + championship_source_id + entity_kind + external_id`. Deux acquisitions du même objet mettent à jour le même enregistrement sans doublon.

### AC-5.6-011 — Identité synthétique
Sans ID fournisseur stable, l'adaptateur peut fournir une clé déterministe explicitement marquée synthétique, stable et traçable, jamais présentée comme identité fournisseur native.

### AC-5.6-012 — Structure source fidèle
Lorsque le provider expose une épreuve et des sessions, les deux niveaux et leurs relations **source techniques** sont conservés. Si un niveau n'existe pas, 5.6 ne l'invente pas. Cette structure ne modifie pas le modèle métier permanent.

### AC-5.6-013 — Pas de versions source dupliquées
Un objet source possède une représentation courante unique ; les changements significatifs vont au journal fonctionnel et non dans des copies intégrales successives.

## 4. Current et temporalité

### AC-5.6-020 — Étendue future complète
`current` couvre de J jusqu'au dernier événement futur disponible chez le fournisseur. **Refus si J+30 devient une limite d'import.**

### AC-5.6-021 — Fenêtre chaude
J→J+30 est la fenêtre chaude par défaut, configurable, servant à la priorité sans empêcher l'acquisition au-delà.

### AC-5.6-022 — Aucune fréquence métier fixe
5.6 n'impose aucun `refresh_interval` fixe ; la cadence réelle provient de 5.4/5.5.

### AC-5.6-023 — Temps déterministe
Les instants persistés/comparés sont normalisés en UTC. Toute notion civile de J, J+30 ou fin de journée utilise explicitement le fuseau pertinent déterminé par la donnée/adaptateur avant conversion en UTC. J→J+30 n'est pas assimilé à `30 × 24 h` lorsque la règle est civile. La finalisation de 30 jours suit une règle unique documentée et déterministe entre workers. Minuit, DST et TZ système différentes ne doivent pas modifier incohérement la classification. Les dates pré-1970 restent valides.

## 5. Priorités

### AC-5.6-030 — Classes de priorité
`finalization ≈ current-hot > current-future > recent_catchup > deep_history`. Les trois premières restent dans le domaine `current` de 5.4 ; aucun second scheduler.

### AC-5.6-031 — Fairness
Les sous-priorités supérieures ne peuvent pas affamer indéfiniment les travaux inférieurs éligibles.

## 6. Finalisation

### AC-5.6-040 — Fenêtre
30 jours par défaut, configurable.

### AC-5.6-041 — Fin théorique
Ordre : `end_at` fournisseur ; dernière session connue ; médiane d'au moins 3 événements comparables même fournisseur/championnat/type en privilégiant le récent ; règle fiable adaptateur ; fin civile dans le fuseau pertinent. Toute valeur non directement fournie est `estimated` avec provenance.

### AC-5.6-042 — Non finalisé après délai
Après 30 jours, ouvrir/maintenir `event_not_finalized_after_grace_period` si le provider ne marque toujours pas l'événement terminé. Aucun statut forcé et aucune prolongation silencieuse infinie.

## 7. Bootstrap et historique

### AC-5.6-050 — Ordre
Futur `current` complet, puis passé de saison courante (`recent_catchup`), puis saisons précédentes (`deep_history`).

### AC-5.6-051 — Deep history complet par défaut
Remonter jusqu'à épuisement des données fournisseur, sauf configuration explicite limitant/désactivant l'historique.

### AC-5.6-052 — Cinq saisons vides
Après 5 saisons consécutives complètement et validement parcourues sans donnée exploitable, valeur configurable, `deep_history` est épuisé. Une saison non vide remet le compteur à zéro.

### AC-5.6-053 — Erreur ≠ saison vide
Timeout, 429, réseau, auth, parsing incomplet, interruption, quota ou parcours partiel ne comptent jamais comme saison vide.

### AC-5.6-054 — `empty_confirmed`
Une saison complètement parcourue et réellement vide peut être marquée `empty_confirmed`.

### AC-5.6-055 — Historique terminé
Aucun rescan automatique périodique après achèvement ; fonctionnement normal en `current` + `finalization`, sauf action administrative explicite.

## 8. Réactivation

### AC-5.6-060
Pas de rattrapage automatique du passé déjà acquis.

### AC-5.6-061
`current` reprend ; `deep_history` reprend au checkpoint seulement s'il était incomplet ; un historique terminé reste terminé.

## 9. Checkpoints et reprise

### AC-5.6-070
Checkpoint durable : provider, championnat, flux, saison et pagination/curseur nécessaires.

### AC-5.6-071
Le checkpoint n'avance qu'après persistance durable de tout ce qui est exploitable ou journalisation explicite des anomalies événement isolables.

### AC-5.6-072
Crash avant commit : rejeu possible, jamais doublon source.

### AC-5.6-073
Curseur invalidé : reprise depuis la plus petite unité sûre, généralement la saison.

### AC-5.6-074
Perte de lease/fencing stale : commit et checkpoint interdits conformément à 5.4.

## 10. Périmètre complet et absences

### AC-5.6-080
Seul l'adaptateur déclare `complete=true` après terminaison fournisseur certaine.

### AC-5.6-081
Interruption, quota, erreur, curseur invalide, parsing incomplet ou pagination inachevée => `complete=false`.

### AC-5.6-082
Preuve d'absence ou `empty_confirmed` uniquement après `complete=true`.

### AC-5.6-083
Absence non destructive : aucune suppression, annulation forcée ou dépublication en 5.6.

## 11. Anomalies

### AC-5.6-090
Une anomalie événement isolable n'annule pas les autres éléments valides de l'unité.

### AC-5.6-091
Anomalie structurelle, persistance ou fencing : arrêt contrôlé/rollback et checkpoint inchangé.

### AC-5.6-092
Anomalies identiques persistantes agrégées avec `first_seen_at`, `last_seen_at`, `occurrence_count`, état ; nouvelle occurrence logique après résolution puis réapparition.

## 12. Dates historiques

### AC-5.6-100
Dates pré-1970 supportées ; aucun invariant `timestamp > 0`.

### AC-5.6-101
Unix `0` n'est pas une sentinelle de date inconnue.

### AC-5.6-102
Tests minimum 1969, 1950, ~1900, PostgreSQL, tri, sérialisation, reprise/curseurs et conversion de fuseau.

## 13. Corrections manuelles

### AC-5.6-110 — Override préservé
Une acquisition actualise la source mais ne supprime, n'écrase ni ne rend inopérant un override actif.

### AC-5.6-111 — Traçabilité
Tout changement fournisseur sous override actif est journalisé, y compris convergence source/override.

### AC-5.6-112 — Protection transactionnelle immédiate
La protection source/override/audit est effective dès 5.6 selon les invariants transactionnels permanents du Handbook. 5.7 conserve la décision métier définitive de réconciliation, pas la protection technique. Un test concurrent source + override est obligatoire.

## 14. Journalisation et rétention

### AC-5.6-120
Logs techniques : 90 jours par défaut, configurable.

### AC-5.6-121
Journal fonctionnel : conservation durable par défaut.

### AC-5.6-122
Pas de duplication systématique des payloads HTTP complets.

### AC-5.6-123
Aucun credential, token, header auth ou secret dans logs, anomalies, UI, traces ou source persistée.

## 15. Actions administratives

### AC-5.6-130
Resynchronisation événement via le plus petit périmètre fournisseur possible.

### AC-5.6-131
Resynchronisation saison par upsert, sans doublon ni destruction d'override.

### AC-5.6-132
Réouverture/reconstruction de `deep_history` depuis une saison choisie, y compris après achèvement.

### AC-5.6-133
Aucun bypass de 5.4/5.5.

### AC-5.6-134
Une saison `empty_confirmed` reste explicitement réinterrogeable.

## 16. UI ACP

### AC-5.6-140
Respect intégral de `LOT-5.6-UI-CONTRACT.md` et du contrat UI global.

### AC-5.6-141
Aucun faux pourcentage historique tant que la borne est inconnue.

### AC-5.6-142
États distincts : actif, attente quota, erreur, suspendu, bootstrap, historique terminé.

### AC-5.6-143
Responsive, clavier, focus visible et états chargement/vide/erreur testés.

### AC-5.6-144
Le graphe source meeting/session est présenté comme information fournisseur technique et jamais comme structure métier officielle.

## 17. Sécurité

### AC-5.6-150
Contrôles d'accès ACP existants ; aucun chemin public d'administration.

### AC-5.6-151
Données fournisseur non fiables : validation de schéma, bornes de taille, parsing défensif avant persistance/exposition.

### AC-5.6-152
Pagination hostile/bouclante détectée et arrêtée.

### AC-5.6-153
Ressources mémoire/stockage/workers bornées.

### AC-5.6-154
Chaînes fournisseur rendues comme données : pas de XSS/HTML actif ni injection logs structurés.

### AC-5.6-155
Transactions, unicité et concurrence empêchent doublons/commits incohérents.

### AC-5.6-156 — HTTPS uniquement
Tout appel fournisseur réel utilise HTTPS ; HTTP non TLS est refusé.

### AC-5.6-157 — Allowlist
Destination/host soumis à l'allowlist fournisseur autorisée.

### AC-5.6-158 — Redirections
Aucune redirection ne peut sortir de la frontière autorisée ; une redirection vers un host non autorisé est refusée.

### AC-5.6-159 — Timeout
Timeout fournisseur explicitement borné.

### AC-5.6-160 — Streaming/réponse bornés
Flux, réponse et tailles sont bornés ; dépassement arrêté proprement sans épuisement incontrôlé des ressources.

### AC-5.6-161 — Redaction
Secrets/credentials sont redacted y compris dans erreurs, exceptions et traces
d'échec HTTP. Une URL credentialisée est interdite, à l’unique exception du
segment de chemin TheSportsDB v1 explicitement accepté par le mainteneur dans
ADR-0020. Cette URL ne doit jamais quitter la primitive HTTP ni être loggée,
persistée, auditée ou retournée.

## 18. Tests d'acceptation minimum

La suite doit démontrer au minimum :

1. bootstrap championnat neuf ;
2. futur complet au-delà de J+30 ;
3. priorité J→J+30 sans starvation ;
4. finalisation puis anomalie après 30 jours ;
5. estimation de fin par pairs et fallback ;
6. recent catchup ;
7. deep history multi-saisons ;
8. reset compteur saisons vides ;
9. arrêt après 5 saisons vides valides ;
10. erreur/429 ≠ saison vide ;
11. crash avant commit + reprise sans doublon ;
12. curseur expiré + reprise saison seulement ;
13. partiel => aucune absence ;
14. complet => observation absence sans suppression ;
15. anomalie événement isolée ;
16. anomalie structurelle + rollback/checkpoint inchangé ;
17. perte lease/fencing stale ;
18. changement source journalisé sans version dupliquée ;
19. correction manuelle préservée ;
20. changement ID sans fusion automatique ;
21. identité synthétique stable ;
22. graphe source épreuve/sessions fidèlement persisté ;
23. dates 1969/1950/~1900 ;
24. réactivation sans rescan passé ;
25. historique terminé ne redémarre pas ;
26. reconstruction administrative historique terminé ;
27. resynchronisation `empty_confirmed` ;
28. anomalies répétitives agrégées ;
29. aucun secret logs/UI ;
30. pagination bouclante arrêtée ;
31. UI conforme ;
32. responsive/clavier/focus ;
33. cadence déléguée 5.4/5.5 ;
34. aucune fonctionnalité 5.7 anticipée ;
35. graphe source meeting/session sans réintroduction du modèle métier Event→Sessions ;
36. acquisition concurrente à un override sans destruction de l'override ;
37. classification current-hot/current-future stable à minuit ;
38. classification stable DST été/hiver ;
39. classification identique entre workers malgré TZ système différentes ;
40. `civil_day_fallback` correctement converti UTC ;
41. pré-1970 + conversion fuseau ;
42. HTTP fournisseur non TLS refusé ;
43. host hors allowlist refusé ;
44. redirection hors allowlist refusée ;
45. timeout fournisseur borné ;
46. réponse/stream surdimensionné arrêté proprement ;
47. absence de secret dans erreurs/traces après échec HTTP.

## 19. Preuves requises avant validation finale du Lot

- tests unitaires/intégration verts ;
- PostgreSQL réel transactions/checkpoints ;
- concurrence/lease/fencing ;
- fixtures providers pagination/erreurs/historique profond ;
- preuves pré-1970, minuit et DST ;
- absence de doublons après rejeu ;
- protection concurrente des overrides ;
- tests HTTP baseline ADR-0016 ;
- absence de secrets ;
- captures ACP desktop/responsive ;
- comparaison maquettes/contrat UI ;
- audit sécurité ;
- audit frontière 5.6/5.7 ;
- état documentaire synchronisé.

## 20. Conditions de refus

Refus notamment si : futur limité J+30 ; fréquence fixe contournant 5.5 ; partiel produisant absence ; absence destructive ; override écrasé ; doublon après rejeu ; checkpoint prématuré ; pré-1970/DST/minuit incohérents ; quotas/leases/fencing contournés ; secret exposé ; historique rescanné automatiquement après achèvement ; modèle métier Event→Sessions réintroduit ; fusion/réconciliation 5.7 anticipée ; HTTP non TLS/host hors allowlist/redirection hors frontière acceptés ; UI avec faux pourcentage ; preuves insuffisantes.

## 21. Gate documentaire post-audit

- Concept 5.6 : formalisé ;
- Contrat UI 5.6 : formalisé et validé en conception ;
- Acceptance 5.6 : **consolidée avec C1–C4** ;
- audit croisé : **EFFECTUÉ** ;
- corrections audit : **INTÉGRÉES NORMATIVEMENT** ;
- revue post-corrections : **PASS FONCTIONNEL** ;
- validation mainteneur autorisant l'implémentation : **ACCORDÉE LE 2026-08-14** ;
- `authorized_sub_lot = 5.6` ;
- Lots 5.7+ : **NON AUTORISÉS**.

## 22. Autorisation normative

**Le code du Lot 5.6 peut être développé dans le strict respect de cette Acceptance, du Concept, du contrat UI, du Handbook, de l'ADR-0019 et des invariants 5.4/5.5/sécurité.**

Cette autorisation ne vaut pas validation finale de l'implémentation et n'autorise pas le Lot 5.7+ ni une fusion dans `main`.

`LOT-5.6-AUDIT-CORRECTIONS.md` reste conservé comme preuve historique de l'audit ; les exigences C1–C4 sont désormais directement présentes dans cette Acceptance consolidée.
