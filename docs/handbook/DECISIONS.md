# Journal des décisions

> Les entrées sont des décisions datées. Lorsqu'un gate évolue, la décision la plus récente et les ADR acceptés prévalent sur les mentions historiques d'un état antérieur.

## 2026-08-24 — Réouverture et correction d’intégration de 5.7-P-E

- la validation VPS a révélé une collision Fastify entre quatre lectures
  historiques et leurs routes Preview définitives ;
- la validation mainteneur E est rouverte malgré le PASS confirmé de la
  migration 0028 et de la recette E01-E18 ;
- l’assemblage partagé par `server.ts` conserve les lectures historiques avec
  Preview OFF et installe les lectures Preview sécurisées sans collision avec
  Preview ON, sans retirer les routes admin/write ;
- la correction est complète mais exige une revalidation mainteneur et VPS ;
- 5.7-P-F, la visibilité Production, l’onboarding externe, le Lot 5.7 complet,
  5.8+ et merge `main` restent non autorisés.

Voir `architecture/ADR-0022-LOT-5.7-P-E-CLIENT-SECURITY.md`.

## 2026-08-24 — Validation mainteneur de 5.7-P-E

- l’audit mainteneur de 5.7-P-E est PASS au SHA
  `bfe6d4818b105a08417e6c524084cae0a176690d` ;
- PP-T29 à PP-T35, les critères fonctionnels E applicables PP-105 à PP-135 et
  PP-180, E01-E18 et la migration 0028 fresh/down/up avec protection du
  rollback peuplé sont PASS ;
- aucun appel fournisseur réel et aucun crédit fournisseur n’ont été consommés ;
- aucun gate d’implémentation suivant n’est autorisé ; 5.7-P-F, la visibilité
  Production, l’onboarding externe, le Lot 5.7 complet, 5.8+ et merge `main`
  restent non autorisés.

Voir `architecture/ADR-0022-LOT-5.7-P-E-CLIENT-SECURITY.md`.

## 2026-08-24 — Achèvement de l’implémentation 5.7-P-E

- PP-T29 à PP-T35 sont implémentés et disposent de preuves ciblées et
  PostgreSQL reproductibles ;
- l’activation Preview reste désactivée par défaut et aucun client externe
  n’est onboardé ;
- 5.7-P-E attend l’audit mainteneur et n’est pas déclaré validé ;
- `authorized_gate` reste `5.7-P-E` et n’ouvre pas automatiquement F ;
- 5.7-P-F, la visibilité Production, le Lot 5.7 complet, 5.8+ et merge `main`
  restent non autorisés.

Voir `architecture/ADR-0022-LOT-5.7-P-E-CLIENT-SECURITY.md`.

## 2026-08-21 — Validation mainteneur de 5.6-H et ouverture du gate 5.6-I

- l’Acceptance finale de 5.6-H est 26 PASS, 0 PARTIAL, 0 FAIL et 0 NOT TESTED ;
- l’audit mainteneur de 5.6-H est PASS et le sous-lot est validé ;
- le P3 non bloquant hérité de 5.6-G sur les queries anomalies invalides reste
  tracé sans rouvrir 5.6-G ou 5.6-H ;
- le dernier sous-lot technique du plan approuvé est 5.6-I — recette complète,
  audit et passation ; seul ce gate de validation finale est ouvert ;
- aucune implémentation fonctionnelle 5.6-I n’est autorisée par cette décision ;
- le Lot 5.6 global reste non validé et non fusionnable ;
- les Lots 5.7 et suivants, ainsi que 5.7-P, restent non autorisés.

## 2026-08-21 — Validation mainteneur de 5.6-G et ouverture de 5.6-H

- l’Acceptance finale de 5.6-G est 26 PASS, 0 PARTIAL, 0 FAIL et 0 NOT TESTED ;
- P1, P2 fonctionnels et P2 preuves ouverts : 0 ;
- l’audit mainteneur de 5.6-G est PASS et le sous-lot est validé ;
- le P3 non bloquant sur les filtres invalides de la route anomalies (`[]` au
  lieu d’un HTTP 400) est tracé sans rouvrir 5.6-G ;
- le prochain sous-lot du plan approuvé est 5.6-H — interface ACP — dont
  l’implémentation seule est autorisée ;
- le Lot 5.6 global reste non validé et non fusionnable ;
- 5.6-I, les Lots 5.7 et suivants, ainsi que 5.7-P, restent non autorisés ;
- cette décision n’implémente aucun code 5.6-H.

## 2026-08-21 — Validation mainteneur de 5.6-F et ouverture de 5.6-G

- l’Acceptance finale de 5.6-F est 26 PASS, 0 PARTIAL, 0 FAIL et 0 NOT TESTED ;
- P1, P2 fonctionnels, P2 preuves et P3 bloquants ouverts : 0 ;
- l’audit mainteneur de 5.6-F est PASS et le sous-lot est validé ;
- le prochain sous-lot du plan approuvé est 5.6-G — API et actions ACP — dont
  l’implémentation seule est autorisée ;
- le Lot 5.6 global reste non validé et non fusionnable ;
- 5.6-H, les Lots 5.7 et suivants, ainsi que 5.7-P, restent non autorisés ;
- cette décision n’implémente aucun code 5.6-G.

## 2026-08-21 — Validation mainteneur de 5.6-E et ouverture de 5.6-F

- l’Acceptance finale de 5.6-E est 35 PASS, 0 PARTIAL, 0 FAIL et 0 NOT TESTED ;
- le ré-audit mainteneur de 5.6-E est PASS et le sous-lot est validé ;
- le prochain sous-lot du plan approuvé est 5.6-F — protection des corrections
  et observations — dont l’implémentation seule est autorisée ;
- le Lot 5.6 global reste non validé et non fusionnable ;
- 5.6-G, les Lots 5.7 et suivants, ainsi que 5.7-P, restent non autorisés ;
- cette décision n’implémente aucun code 5.6-F et ne modifie aucun invariant
  fonctionnel validé de 5.6-E.

## 2026-08-21 — Validation mainteneur de 5.6-D et ouverture de 5.6-E

- le ré-audit mainteneur de 5.6-D est PASS et le sous-lot est validé ;
- le prochain sous-lot du plan approuvé est 5.6-E — temporalité et
  finalization — dont l’implémentation seule est autorisée ;
- le Lot 5.6 global reste non validé et non fusionnable ;
- 5.6-F, les Lots 5.7 et suivants, ainsi que 5.7-P, restent non autorisés ;
- cette décision ne modifie aucun invariant fonctionnel validé de 5.6-D.

## 2026-08-15 — Exception mainteneur TheSportsDB v1

- le mainteneur impose le maintien de TheSportsDB v1 et accepte explicitement
  que sa clé gratuite apparaisse dans le segment de chemin de l’appel réseau ;
- cette exception ne s’étend à aucun autre fournisseur ni à une query string ;
- le secret et l’URL credentialisée restent interdits dans logs, erreurs,
  traces, audits, stockage et surfaces applicatives ;
- ADR-0016 reste applicable pour toutes les autres garanties.

Voir `architecture/ADR-0020-THESPORTSDB-V1-CREDENTIAL-PATH.md`.

## 2026-08-15 — Application d’ADR-0016 aux versions d’API fournisseur

- aucune compatibilité fournisseur ne justifie un secret dans une URL ;
- lorsqu’un fournisseur propose une version authentifiée par header, cette
  version est obligatoire même si une version historique gratuite utilise une
  clé dans son chemin ;
- l’adaptateur TheSportsDB utilise l’API v2 et `X-API-KEY` ; l’API v1
  credentialisée est refusée pour les appels 5.6 ;
- cette clarification ne crée aucune exception à AC-5.6-161.

Voir `architecture/ADR-0016-HTTP-SECURITY-BOUNDARY.md`.

## 2026-08-14 — Autorisation d'implémentation du Lot 5.6

- le Concept, le contrat UI et l'Acceptance consolidée du Lot 5.6 ont été audités contre 5.4, 5.5, la baseline sécurité et la frontière 5.7 ;
- les constats de l'audit ont été corrigés et la revue post-corrections est PASS ;
- le mainteneur a explicitement déclaré : « Je valide et j'autorise l'implémentation du lot 5.6 » ;
- `authorized_sub_lot = 5.6` ;
- l'implémentation du seul Lot 5.6 est autorisée ;
- cette autorisation ne vaut ni validation finale du Lot 5.6, ni autorisation de fusion dans `main` ;
- les Lots 5.7 et suivants restent non autorisés à l'implémentation.

Voir `architecture/ADR-0019-LOT-5.6-ACQUISITION-AUTHORIZATION.md`.

## 2026-08-14 — Validation mainteneur du Lot 5.5

- l'audit initial de l'implémentation 5.5 et ses ré-audits ont été menés à
  terme ;
- les corrections P1, P2 et P3 sont closes et le ré-audit final est PASS ;
- la recette PostgreSQL dédiée compte 61 cas réussis ;
- la sécurité et la non-régression du scheduler 5.4 sont validées ;
- `REAL PROVIDER REQUESTS = 0` et `PROVIDER CREDITS CONSUMED = 0` ;
- l'implémentation du Lot 5.5 est validée par le mainteneur le 2026-08-14 ;
- **à la date de cette décision**, le Lot 5.6 restait non autorisé ; cet état historique a ensuite été remplacé par l'autorisation formalisée dans l'ADR-0019.

Voir `architecture/ADR-0018-LOT-5.5-MAINTAINER-VALIDATION.md`.

## 2026-08-14 — Autorisation du Lot 5.5 Quotas et cadence

- la baseline sécurité pré-5.5 est explicitement validée par le mainteneur ;
- le Concept et l'Acceptance 5.5 ont passé l'audit croisé avec 5.4 et sécurité après corrections ;
- l'implémentation du seul Lot 5.5 est autorisée avec `authorized_sub_lot = 5.5` ;
- cette autorisation ne vaut pas validation finale de 5.5 ;
- Codex doit s'arrêter après implémentation et preuves de validation pour audit mainteneur ;
- **à la date de cette décision**, les Lots 5.6 et suivants restaient non autorisés ; le Lot 5.6 a ensuite été autorisé par l'ADR-0019, tandis que 5.7+ restent non autorisés.

Voir `architecture/ADR-0017-LOT-5.5-QUOTA-CADENCE-AUTHORIZATION.md`.

## 2026-08-14 — Frontière de sécurité HTTP pré‑5.5

- la confiance proxy est fermée par défaut et limitée à `TRUST_PROXY_CIDRS` ;
- Fastify impose headers de sécurité, redaction des secrets et corps de 1 Mio ;
- Nginx impose les headers de l’ACP et une CSP dont `connect-src` est aligné
  sur l’origine API configurée au build ;
- HSTS appartient à la terminaison qui voit réellement le HTTPS public ;
- les réponses publiques de championnats sont actives uniquement et utilisent
  une projection explicite, distincte du contrat administratif ;
- les mutations sensibles historiques écrivent mutation et audit dans une
  même transaction ;
- les transports fournisseurs exigent HTTPS, allowlist exacte et lecture
  streaming bornée, sans redirection ni destination privée ;
- ces règles ne démarrent aucune fonctionnalité du Lot 5.5.

Voir `architecture/ADR-0016-HTTP-SECURITY-BOUNDARY.md`.

## 2026-08-12 — Scheduler de synchronisation persistant

- deux flux persistants `current` et `historical` portent trois classes de
  travail pondérées 3/2/1 ;
- les leases PostgreSQL, heartbeats et générations de fencing empêchent un
  worker périmé de valider ;
- résultat, curseur, état et exécution sont validés dans une transaction unique ;
- le pool global et la concurrence fournisseur sont tous deux appliqués ;
- discovery et sync partagent les mêmes plafonds, leases et règles de fencing ;
- la désactivation mémorise puis restaure l'état exact sans auto-activer un
  flux inactif ou en pause ;
- l'ingestion complète et le moteur de quotas restent hors du Lot 5.4.

Voir `architecture/ADR-0015-PERSISTENT-SYNC-SCHEDULER.md`.

## 2026-08-11 — Authentification humaine de la console

- un compte administrateur unique est initialisé par une commande dédiée ;
- la connexion humaine utilise identifiant/mot de passe et session serveur ;
- les durées validées sont une heure d'inactivité et huit heures absolues ;
- cinq échecs en quinze minutes bloquent quinze minutes ;
- le Bearer HMAC reste réservé aux usages techniques ;
- Argon2id, PostgreSQL et le double-submit CSRF signé constituent la décision
  technique validée par le mainteneur le 2026-08-11 dans l'ADR-0014.

Voir `architecture/ADR-0014-ADMIN-CONSOLE-AUTHENTICATION.md`.

## 2026-08-11 — Un Événement représente une Session

- l'Événement est l'unique unité temporelle administrée ;
- il porte un seul `session_title` facultatif ;
- le formulaire conserve ses champs et ajoute une combobox éditable/créable ;
- les suggestions réunissent fournisseurs et valeurs enregistrées sans origine
  visible ;
- une valeur inédite est acceptée puis devient réutilisable ;
- les tables et routes multi-sessions restent uniquement pour compatibilité.

Voir `architecture/ADR-0013-EVENT-AS-SESSION.md`.

## 2026-08-10 — Intitulé unique des Sessions

- le workflow métier ne demande qu'un `title`, jamais un couple nom/type ;
- les suggestions regroupent les intitulés fournisseur et locaux déjà connus ;
- un intitulé inédit peut être créé directement puis réutilisé ;
- `session_types` reste un détail technique de compatibilité de la migration
  `0004`, sans devenir un second champ visible.

Voir `architecture/ADR-0012-SESSIONS-MODEL.md`.

## 2026-08-14 — Quota gate fournisseur atomique

- le scheduler conserve la sélection et les leases ; le quota gate décide et charge séparément avant tout outbound ;
- les fenêtres minute/heure/jour/mois et l'intervalle minimal s'appliquent simultanément ;
- le compteur local est conservateur et les observations fournisseur normalisées ne réécrivent pas la policy ;
- seule la classe current accède à la réserve, après application de la marge ;
- seule une non-émission prouvée permet une compensation ; une émission reste chargée malgré timeout ou stale fencing.

Voir `architecture/ADR-0017-LOT-5.5-QUOTA-CADENCE-AUTHORIZATION.md`.

## 2026-08-10 — Projection publique des Sessions

- les Sessions publiques sont lues sous leur Événement ou par identifiant ;
- une Session non publiée, brouillon ou rattachée à un Événement non visible
  n'est jamais exposée ;
- la projection ne contient que les champs métier et est ordonnée par instant
  de début puis identifiant.

Voir `architecture/ADR-0012-SESSIONS-MODEL.md`.

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

## 2026-08-03 — Pagination et actions Corrections

- la page Corrections affiche dix corrections au maximum par page ;
- elle reprend la navigation précédente/suivante de la liste Événements ;
- « Accepter fournisseur » devient « Restaurer fournisseur » ;
- l'action redondante « Conserver local » est supprimée de l'interface ;
- l'action redondante de suppression de correction n'est pas exposée dans
  l'interface, car elle produit le même résultat que restaurer fournisseur ;
- les valeurs de statut techniques sont traduites, dont `postponed` en
  « Reporté ».

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
- les corrections historiques portant sur le fuseau sont archivées et restent
  restaurables par rollback ;
- la vue Liste affiche 25 événements par page ;
- son ordre par défaut utilise la proximité absolue entre le début de
  l'événement et l'instant courant.

Voir `architecture/ADR-0004-TIMEZONES.md` et
`architecture/ADR-0007-CALENDAR.md`.

## 2026-08-09 — Migrations PostgreSQL versionnées

- les migrations s'exécutent avant l'API et sont enregistrées dans
  `schema_migrations` ;
- le démarrage de l'API ne transforme jamais le schéma ou les données métier ;
- les transformations sont idempotentes et accompagnées d'un rollback ;
- toute donnée incompatible est archivée intégralement avant retrait.

Voir `architecture/ADR-0009-VERSIONED-DATABASE-MIGRATIONS.md`.

## 2026-08-03 — Tri des listes

- le tri s'applique à l'ensemble des événements filtrés avant pagination ;
- le premier affichage conserve l'événement le plus proche de maintenant ;
- un clic sur Date bascule entre ordre chronologique croissant et décroissant ;
- un clic sur une colonne métier bascule entre ordre alphabétique croissant et
  décroissant ;
- tout changement de tri revient à la première page.

Voir `architecture/ADR-0007-CALENDAR.md`.

## 2026-08-10 — Modèle Sessions

- une session appartient à un événement et possède une identité propre ;
- les types proviennent d'un référentiel global extensible initialisé avec
  practice, qualifying, sprint, warmup, race et other ;
- les horaires sont en UTC, la fin est facultative et les chevauchements sont
  autorisés ;
- l'ordre canonique est le début puis l'identifiant ;
- les corrections Session reprennent la séparation source/override/effective ;
- mutation Session et journal d'audit sont atomiques ;
- l'ingestion automatisée future utilise une identité de service et des routes
  séparées de l'administration humaine.

Voir `architecture/ADR-0012-SESSIONS-MODEL.md`.

## 2026-08-10 — API administrative Sessions

- la liste et la création sont rattachées à l'événement dans le chemin HTTP ;
- la consultation, la modification et la suppression utilisent l'identifiant
  propre de la Session ;
- les entrées datées exigent un offset et sont normalisées en UTC ;
- une création humaine est manuelle et sans identité fournisseur ;
- une mutation Session et son audit utilisent une transaction unique ;
- une Session fournisseur n'est pas modifiée avant le workflow de corrections.

Voir `architecture/ADR-0012-SESSIONS-MODEL.md`.

## 2026-08-10 — Corrections Sessions

- seuls `title`, `starts_at`, `ends_at`, `status`, `published` et `description`
  sont corrigibles et chaque valeur suit le type métier du champ ;
- la synchronisation fournisseur conserve l'override, signale le conflit et
  supprime la correction lorsque source et override convergent ;
- accepter ou restaurer le fournisseur retire l'override, tandis que conserver
  local maintient la valeur effective ;
- résolutions, synchronisations et overrides concurrents sont sérialisés par
  verrou de Session ;
- mutation et audit unique utilisent la même transaction ;
- suggestions et API publique lisent respectivement les valeurs source/locales
  utiles et la seule valeur effective.

Voir `architecture/ADR-0012-SESSIONS-MODEL.md`.

## 2026-08-03 — Exploitation des corrections

- les filtres de Corrections sont combinables et portent sur l'ensemble des
  dimensions métier prévues par le contrat ;
- un override peut être modifié sans altérer sa valeur fournisseur ;
- l'événement concerné est ouvert directement avec son panneau de détail
  sélectionné ;
- les actions accepter fournisseur, conserver local et supprimer l'override
  continuent d'utiliser le service transactionnel unique.

Voir `architecture/ADR-0003-PROVIDER-CORRECTIONS.md`.

## 2026-08-09 — Protection de l'API d'administration

- toute route `/api/v1/admin/` exige un Bearer HMAC valide et non expiré ;
- seul le rôle `admin` est autorisé, un autre rôle reçoit `403` ;
- le secret reste côté API et le jeton Web reste limité à la session ;
- les routes publiques ne nécessitent aucune authentification.
- les mutations historiques de championnats sont protégées sans modifier leur
  chemin public existant.

Voir `architecture/ADR-0010-ADMIN-API-AUTHORIZATION.md`.

## 2026-08-09 — Pagination et audit administratifs

- filtres et tris sont validés et exécutés avant la pagination serveur ;
- les colonnes de tri et tailles de page sont bornées par liste blanche ;
- chaque mutation conserve acteur, avant/après et identifiant de requête ;
- les secrets sont retirés du journal et l'identité fournisseur est unique.

Voir `architecture/ADR-0011-ADMIN-PAGINATION-AND-AUDIT.md`.

## 2026-08-09 — Interactions calendrier fiables

- une plage se crée à partir de deux dates explicites ;
- un déplacement ou redimensionnement optimiste refusé restaure l'affichage ;
- les durées sont calculées entre instants UTC, y compris à minuit et pendant
  les changements d'heure civile.

Voir `architecture/ADR-0007-CALENDAR.md`.
## 2026-08-21 — Recette finale 5.6-I PASS et décision mainteneur attendue

- la recette complète 5.6-I est PASS et clôt le dernier sous-lot technique du
  plan approuvé, sans changement fonctionnel ;
- les preuves PostgreSQL, API, Web, Chromium, sécurité, reprise, régressions
  5.4/5.5 et release sont consignées dans
  `docs/handoff/LOT-5.6-I-FINAL-VALIDATION.md` ;
- cette clôture technique ne vaut pas validation globale du Lot 5.6 ;
- `merge_authorized` reste faux et la fusion dans `main` reste interdite ;
- 5.7, 5.7-P et les lots ultérieurs restent non autorisés ;
- le prochain gate appartient au mainteneur : décider explicitement de la
  validation globale du Lot 5.6.

## 2026-08-21 — Validation mainteneur globale du Lot 5.6

- le mainteneur accepte le dossier final 5.6-I et ses 26/26 PASS ;
- les sous-lots 5.6-A à 5.6-H sont validés et 5.6-I est un gate final PASS ;
- P1 ouverts : 0 ; P2 ouverts : 0 ; P3 bloquants : 0 ;
- le P3 hérité de 5.6-G sur la query anomalies invalide reste connu et non
  bloquant ;
- le Lot 5.6 est globalement validé le 2026-08-21 et complet à 100 % ;
- le prochain gate identifié est 5.7-P — tranche verticale de normalisation
  Production Preview — déjà conçu mais non autorisé ;
- 5.7, 5.7-P et les lots ultérieurs restent non autorisés ;
- la fusion dans `main` reste soumise à une décision séparée et non autorisée.

## 2026-08-21 — Autorisation mainteneur de 5.7-P

- le mainteneur autorise 5.7-P, tranche verticale de normalisation Production
  Preview ;
- le Concept, l’Acceptance effective PP-001 à PP-183 et les corrections
  d’audit constituent les normes existantes ;
- ces normes ne définissent aucun sous-lot technique ni premier gate
  d’implémentation nommé : seule leur traduction en plan technique ordonné est
  autorisée dans le premier gate ;
- l’implémentation 5.7-P reste non commencée et aucun sous-lot technique n’est
  autorisé ;
- le Lot 5.7 complet, 5.8+ et la fusion dans `main` restent non autorisés ;
- le P3 non bloquant hérité de 5.6-G reste connu sans rouvrir 5.6.

## 2026-08-22 — Achèvement de l’implémentation 5.7-P-A

- les fondations persistantes PP-T01 à PP-T06 sont implémentées et prouvées ;
- 5.7-P-A est complet et attend l’audit mainteneur, sans être validé mainteneur ;
- aucun moteur de normalisation, mapping, endpoint Preview, publication ou
  contrôle client n’est ajouté ;
- l’autorisation technique de A est consommée et aucun gate B à F n’est
  autorisé ;
- le Lot 5.7 complet, 5.8+ et la fusion dans `main` restent non autorisés.

## 2026-08-22 — Validation de 5.7-P-A et autorisation de 5.7-P-B

- l’audit mainteneur de 5.7-P-A est PASS et A est validé mainteneur ;
- PP-T01 à PP-T06 et la recette dédiée 18/18 sont PASS, sans P1, P2 ni P3
  bloquant ;
- seul 5.7-P-B — normalisation déterministe et mapping source — est autorisé et
  reste non commencé ; son Acceptance est PP-T07 à PP-T16 avec les critères
  fonctionnels pertinents PP-030 à PP-061 et PP-181 à PP-183 ;
- B doit s’arrêter aux candidats normalisés persistés, sans publication ;
- 5.7-P-C à F, le Lot 5.7 complet, 5.8+ et la fusion dans `main` restent non
  autorisés ;
- le P3 hérité de 5.6-G reste non bloquant et ne rouvre ni 5.6 ni A.

## 2026-08-22 — Achèvement de l’implémentation 5.7-P-B

- la normalisation déterministe et le mapping source PP-T07 à PP-T16 sont
  implémentés et prouvés ;
- B s’arrête aux candidats, décisions, liens et checkpoints persistés ; aucune
  publication, API Preview ou surface client n’est ajoutée ;
- 5.7-P-B est complet et attend l’audit mainteneur, sans être validé
  mainteneur ;
- l’autorisation technique de B est consommée et aucun gate C à F n’est
  autorisé ;
- le Lot 5.7 complet, 5.8+ et la fusion dans `main` restent non autorisés ;
- le P3 hérité de 5.6-G reste non bloquant et inchangé.

## 2026-08-22 — Validation de 5.7-P-B et autorisation de 5.7-P-C

- l’audit mainteneur de 5.7-P-B est PASS et B est validé mainteneur ;
- 45 critères applicables sont PASS, sans PARTIAL, FAIL ni NOT TESTED ;
- seul 5.7-P-C — état de publication, last-known-good et journal de
  changements — est autorisé et reste non commencé ;
- C couvre PP-T17 à PP-T22 et les critères fonctionnels pertinents PP-062 à
  PP-073 / PP-086 à PP-104, avec persistance interne atomique mais sans route
  client ;
- 5.7-P-D à F, le Lot 5.7 complet, 5.8+ et la fusion dans `main` restent non
  autorisés ;
- le P3 hérité de 5.6-G reste non bloquant et ne rouvre ni A ni B.

## 2026-08-22 — Achèvement de l’implémentation 5.7-P-C

- PP-T17 à PP-T22 sont implémentés et prouvés sur PostgreSQL réel ;
- état public interne, last-known-good, révisions, journal monotone, kill switch
  et tombstones sont durables et transactionnels ;
- 5.7-P-C est complet et attend l’audit mainteneur sans être validé ;
- aucun gate suivant n’est autorisé et 5.7-P-D ne doit pas commencer ;
- aucune route Preview ni sécurité client n’est ajoutée ;
- le Lot 5.7 complet, 5.8+ et merge `main` restent non autorisés.

Voir `architecture/ADR-0021-LOT-5.7-P-C-DURABLE-PUBLICATION.md`.

## 2026-08-22 — Validation mainteneur de C et readiness préproduction interne

- l’audit mainteneur de 5.7-P-C est PASS et C est validé mainteneur ;
- PP-T17 à PP-T22 et 25 critères applicables sont PASS sans constat bloquant ;
- la stack A/B/C est prête localement pour une préproduction VPS interne avec
  PostgreSQL persistant, migration 0025, restart, healthchecks et backup/restore ;
- aucun déploiement/reboot VPS réel n’est encore déclaré ;
- 5.7-P-D à F, le Lot 5.7 complet, 5.8+ et merge `main` restent non autorisés.

## 2026-08-21 — Design technique 5.7-P prêt pour audit mainteneur

- la matrice fonctionnelle PP-F01 à PP-F25 consolide les normes existantes ;
- le design technique et l’Acceptance PP-T01 à PP-T42 sont complets ;
- 5.7-P est décomposé en six gates ordonnés 5.7-P-A à 5.7-P-F ;
- le cross-audit documentaire est PASS sans P1/P2/P3 bloquant ;
- 5.7-P-A est le premier gate candidat mais reste non autorisé ;
- l’implémentation reste à 0 % et non commencée ;
- le Lot 5.7 complet, 5.8+ et la fusion dans `main` restent non autorisés.
## 2026-08-21 — Validation du design 5.7-P et autorisation de 5.7-P-A

- l’audit mainteneur du design technique, de l’Acceptance PP-T01 à PP-T42 et
  de la décomposition A→F est PASS ;
- le design 5.7-P est validé par le mainteneur le 2026-08-21 ;
- seul 5.7-P-A — fondations d’identité normalisée et de persistance — est
  autorisé pour implémentation et reste non commencé ;
- A couvre PP-T01 à PP-T06 et les critères fonctionnels pertinents PP-001 à
  PP-009 et PP-024 à PP-036, sans normalisation ni exposition client ;
- 5.7-P-B à F, le Lot 5.7 complet, 5.8+ et la fusion dans `main` restent non
  autorisés ;
- le P3 non bloquant hérité de 5.6-G reste connu sans rouvrir 5.6.
