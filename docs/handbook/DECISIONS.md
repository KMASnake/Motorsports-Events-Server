# Journal des décisions

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
