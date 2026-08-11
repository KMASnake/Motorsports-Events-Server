# Lot 4.4 — Analyse d'impact Authentification

Date : 2026-08-11

Statut : `phase-0-specification-complete-awaiting-maintainer-validation`

## Conclusion

L'authentification humaine nécessite une évolution durable de l'architecture
et une migration PostgreSQL. Elle ne nécessite ni Redis, ni JWT navigateur, ni
service externe dans cette première version.

- ADR : **oui**, ADR-0014 proposé ;
- migration : **oui**, `0006_admin_console_authentication` proposée ;
- nouvelles routes : **oui**, trois routes `/api/v1/auth/*` ;
- dépendance API : bibliothèque Argon2id à sélectionner après validation ;
- modification Web : garde de routes, page login et client HTTP central ;
- HMAC existant : conservé pour les usages techniques.

## État actuel du dépôt

### API Fastify

`registerAdminAuth` protège `/api/v1/admin/*` et les mutations Championnats via
un Bearer signé HMAC-SHA256. Le principal contient `sub`, `role` et `exp`. Une
absence ou invalidité retourne `401`, un rôle non admin `403`.

Le hook doit évoluer vers un résolveur à deux mécanismes sans changer le format
ni les tests du Bearer technique. Les routes auth restent hors du préfixe admin.

### Audit

`registerAdminAudit` filtre déjà les noms contenant authorization, token,
secret, password et cookie. L'authentification ajoutera des événements dédiés
et doit éviter de placer le body de login ou les cookies dans son contexte.

### PostgreSQL et migrations

Le dépôt exécute des migrations SQL numérotées avant l'API et vérifie le schéma
en lecture seule au démarrage. La migration suivante doit être `0006`, avec UP,
DOWN gardé, idempotence et tests sur base vierge/existante.

### Web React

Il n'existe actuellement ni `/login`, ni état global de session, ni garde
React Router. Les appels administratifs sont répartis dans plusieurs fichiers
et ajoutent un Bearer lu depuis `sessionStorage`. Le tableau de bord utilise
encore un fetch distinct.

La Phase 1 doit introduire un client commun plutôt que modifier chaque appel de
façon divergente. Le HMAC n'est plus saisi ou stocké par le navigateur.

### Docker, proxy et environnement

Docker expose actuellement Web et API sur deux ports et CORS accepte l'origine
dynamiquement. Les cookies cross-origin locaux nécessitent
`credentials: include` et une origine exacte. En production, le reverse proxy
HTTPS doit acheminer Web et API sous le même site si possible.

Variables futures proposées :

- `ADMIN_WEB_ORIGIN` : origine exacte autorisée ;
- `ADMIN_COOKIE_SECURE` : `true` obligatoire en production ;
- `ADMIN_SESSION_SECRET` : secret séparé pour la signature CSRF, 32 octets ou
  plus ;
- `TRUST_PROXY` : proxy explicitement approuvé ;
- durées et seuils restent des constantes métier dans cette version afin
  d'éviter une configuration incohérente.

`ADMIN_AUTH_SECRET` reste requis tant que le HMAC technique existe. Aucun
secret ne porte le préfixe `VITE_`.

## Impacts futurs par zone

| Zone | Impact Phase 1 |
|---|---|
| `apps/api/src/lib/adminAuth.ts` | Conserver HMAC, résoudre session cookie, enrichir le principal et appliquer CSRF selon la méthode. |
| Nouvelles bibliothèques API | Hash Argon2id, cookies Fastify si nécessaire ; versions verrouillées et auditées. |
| Routes auth | Login, état session et logout avec schémas Zod stricts. |
| Persistance | Compte singleton, état anti-bruteforce et sessions. |
| Audit | Événements auth explicites et sanitisation renforcée. |
| Démarrage API | Vérification read-only de la migration `0006`. |
| CLI | Création initiale et reset de mot de passe sans secret en argument. |
| React Router | `/login`, provider de session, garde et retour interne sûr. |
| Client HTTP Web | Cookies credentials, CSRF sur mutations, gestion centrale des `401`. |
| Navigation | Bouton logout relié à l'API. |
| Docker/env | Origine Web, cookie Secure, secret CSRF/session, commandes bootstrap. |
| CI/recettes | Bootstrap synthétique, login Chromium et maintien des validateurs HMAC. |

## Risques et mesures

| Risque | Mesure |
|---|---|
| Vol de cookie par JavaScript | Cookie de session HttpOnly, aucun token auth dans le stockage Web. |
| CSRF | Double-submit signé lié à la session, en-tête obligatoire et Origin exact. |
| Fixation de session | Nouveau token aléatoire à chaque login réussi. |
| Fuite de base | Stocker seulement hash PHC du mot de passe et SHA-256 du token opaque. |
| Énumération du compte | Message identique et hash factice pour identifiant inconnu. |
| Bruteforce | Fenêtre et blocage persistants en PostgreSQL, succès réinitialisant l'état. |
| Déni de service par blocage | Blocage court de 15 min conforme à la décision ; audit permettant le diagnostic. |
| Session éternelle | Idle 1 h borné par maximum absolu 8 h en base. |
| Cookie Secure cassant le local | Noms/configurations distincts, production refusée sans Secure. |
| Mauvais proxy | Liste de proxy de confiance explicite, jamais universelle par défaut. |
| Régression des scripts | Bearer HMAC conservé et suites existantes rejouées. |
| Secrets dans les traces | Schémas de log dédiés, sanitisation et tests négatifs sur toutes les sorties. |

## Alternative Redis écartée

PostgreSQL est déjà obligatoire, transactionnel, sauvegardé et suffisant pour
un compte et un faible volume de sessions. Redis ajouterait exploitation,
sauvegarde et disponibilité sans bénéfice démontré. Il pourra être reconsidéré
uniquement face à une charge mesurée ou un besoin distribué nouveau.

## Alternative JWT navigateur écartée

Un JWT accessible au JavaScript contredit les décisions approuvées. Un JWT en
cookie HttpOnly compliquerait la révocation immédiate et nécessiterait tout de
même un état serveur. Un token opaque indexé par empreinte est plus simple.

## Découpage Phase 1 proposé

1. **Migration et primitives cryptographiques** : tables, Argon2id, tokens,
   horloge injectée et rollback ; arrêt et validation.
2. **CLI bootstrap/récupération** : création singleton, reset et audit ; arrêt.
3. **API session et coexistence HMAC** : login/session/logout, brute-force,
   cookies, CSRF et tests ; arrêt.
4. **Frontend** : page login, garde, client HTTP, logout et redirections ; arrêt.
5. **Recettes** : données synthétiques, Chromium, Docker, reverse proxy, VPS et
   Windows ; arrêt avant validation finale.

Chaque étape met à jour les fichiers d'état, fournit ses commandes de test et
ne passe à la suivante qu'après les validations exigées.
