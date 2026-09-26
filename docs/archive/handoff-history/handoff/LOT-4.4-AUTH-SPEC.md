# Lot 4.4 — Spécification de l'authentification administration

Date : 2026-08-11

Statut : `phase-0-validated-ready-for-implementation`

## Objectif

Remplacer la manipulation humaine du Bearer HMAC par une authentification
identifiant/mot de passe et une session côté serveur, sans supprimer le HMAC
technique utilisé par les validateurs et futurs services.

## Compte administrateur unique

La première version possède au plus un compte actif. Il n'existe ni liste
d'utilisateurs, ni rôle configurable, ni interface Utilisateurs.

Le compte contient un identifiant affichable, sa forme normalisée pour la
comparaison, un hash de mot de passe Argon2id et ses timestamps techniques.
Le mot de passe n'est jamais normalisé, journalisé, retourné ou accepté comme
argument de ligne de commande.

Exigences proposées : minimum 12 caractères, maximum 1024 octets UTF-8. Cette
borne supérieure protège le coût du hash sans tronquer silencieusement.

## Hash du mot de passe

Solution recommandée : **Argon2id**, avec chaîne PHC complète stockée dans
PostgreSQL. Paramètres initiaux proposés :

- mémoire : 64 MiB (`memoryCost=65536` KiB) ;
- itérations : 3 ;
- parallélisme : 1 ;
- sel aléatoire généré par la bibliothèque ;
- sortie : 32 octets ;
- réévaluation des paramètres après mesure dans le conteneur cible.

Argon2id est préférable à bcrypt, notamment pour sa résistance mémoire et
l'absence de limite historique de 72 octets. `scrypt` de Node reste un repli
acceptable uniquement si la dépendance Argon2id ne peut pas être construite
de manière reproductible sur Node 22 Alpine. Aucun repli automatique n'est
autorisé : le choix effectif doit être unique et testé.

Références : RFC 9106 et OWASP Password Storage Cheat Sheet.

## Bootstrap et récupération

Commandes futures proposées :

```text
npm run admin:create --workspace @mse/api -- --username ADMIN
npm run admin:reset-password --workspace @mse/api -- --username ADMIN
```

Dans Docker/VPS, elles sont exécutées dans un conteneur API ponctuel. Le mot de
passe est lu deux fois depuis un terminal masqué. Pour les tests uniquement,
`--password-stdin` lit une valeur depuis l'entrée standard ; aucun `--password`
ni mot de passe en variable d'environnement n'est accepté.

`admin:create` :

- refuse un identifiant vide ou invalide ;
- refuse si le compte singleton existe déjà ;
- crée compte et état anti-bruteforce dans une transaction ;
- écrit un audit `auth.admin_created` sans identifiant sensible autre que le
  nom administrateur, sans hash ni mot de passe ;
- n'affiche que le résultat et jamais le mot de passe.

`admin:reset-password` :

- exige l'accès console au serveur ;
- remplace le hash dans une transaction ;
- révoque toutes les sessions ;
- réinitialise le blocage ;
- écrit `auth.password_reset` sans secret.

## Sessions côté serveur

Après authentification réussie, l'API génère 32 octets aléatoires
cryptographiquement sûrs et remet leur encodage base64url dans le cookie. La
base ne stocke que `SHA-256(token)` ; une fuite de la table ne fournit donc pas
un cookie directement réutilisable.

Chaque session stocke : création, dernière activité, expiration d'inactivité,
expiration absolue et révocation. À chaque requête authentifiée :

1. calcul du hash du cookie et recherche de la session active ;
2. rejet si révoquée, inactive depuis une heure ou âgée de huit heures ;
3. mise à jour de la dernière activité et de l'expiration idle à
   `min(now + 1 heure, expiration absolue)` ;
4. aucune prolongation de la limite absolue.

Les sessions expirées ou révoquées sont supprimées opportunément lors du
login et de la validation, ainsi que par une future commande de nettoyage
testable. Aucun Redis n'est nécessaire pour un compte unique.

## Cookies

Cookie d'authentification :

- production : `__Host-mse_admin_session` ;
- développement HTTP : `mse_admin_session` ;
- `HttpOnly` ;
- `Secure` obligatoire en production ;
- `SameSite=Lax` ;
- `Path=/` ;
- aucun attribut `Domain` ;
- `Max-Age=28800` au plus, la base restant autoritaire pour l'idle timeout.

La configuration `ADMIN_COOKIE_SECURE=true` est obligatoire en production et
refuse le démarrage si `NODE_ENV=production` ne l'active pas. Derrière le
reverse proxy HTTPS, le navigateur reçoit bien `Secure` même si le lien Docker
interne vers l'API est HTTP. Fastify doit connaître le proxy de confiance pour
les informations de requête, sans déduire silencieusement la sécurité du
cookie.

En développement, l'origine Web exacte est configurée et les requêtes Fetch
utilisent `credentials: 'include'`. CORS n'utilise plus `origin: true` pour les
routes avec credentials.

## CSRF

`SameSite` est une défense complémentaire, pas la protection unique. La
solution recommandée est un **double-submit cookie signé et lié à la session** :

- cookie CSRF distinct, lisible par JavaScript, sans valeur d'authentification ;
- nonce aléatoire signé par HMAC avec un secret serveur distinct et l'ID de la
  session ;
- valeur identique envoyée dans `X-CSRF-Token` ;
- comparaison constante du cookie, de l'en-tête et de la signature ;
- validation de `Origin` contre une liste exacte pour les requêtes navigateur ;
- exigé pour `POST`, `PUT`, `PATCH`, `DELETE` authentifiés par cookie, y compris
  logout ;
- non exigé pour les GET/HEAD/OPTIONS ni pour un Bearer HMAC technique valide.

Le cookie CSRF utilise `Secure`, `SameSite=Lax`, `Path=/`, sans `Domain`, mais
n'est volontairement pas `HttpOnly` afin que le client puisse recopier sa
valeur dans l'en-tête. Il n'est ni un identifiant de session ni un secret
d'authentification.

Le login exige JSON et rejette tout `Origin` présent mais non autorisé. Il ne
peut pas exiger de jeton CSRF avant création de session.

## Protection anti-bruteforce

Avec un unique compte, l'état est un singleton global :

- première erreur : début d'une fenêtre de 15 minutes ;
- cinquième erreur dans cette fenêtre : blocage jusqu'à `now + 15 minutes` ;
- pendant le blocage : aucune vérification du vrai hash, réponse `429` et
  `Retry-After` ;
- fenêtre expirée : compteur redémarré ;
- succès : compteur, fenêtre et blocage remis à zéro.

Un mauvais identifiant exécute une vérification Argon2id sur un hash factice de
même coût afin de réduire les différences temporelles. Toute erreur normale
répond `401` avec « Identifiant ou mot de passe incorrect. ». Le blocage répond
`429` avec un message générique ne confirmant pas l'existence du compte.

Le blocage n'est pas fondé uniquement sur l'IP. L'IP peut être enregistrée
sous forme de métadonnée d'audit non secrète derrière un proxy de confiance,
mais ne décide pas seule de l'autorisation.

## Coexistence session humaine et HMAC technique

Le hook Fastify protège les routes administratives selon cet ordre :

1. si un en-tête `Authorization` est présent, il doit être un Bearer HMAC
   technique valide ; aucun repli silencieux vers le cookie ;
2. sinon, vérifier le cookie de session serveur ;
3. pour une mutation par cookie, vérifier CSRF ;
4. enrichir `adminPrincipal` avec l'acteur et `auth_method` (`technical_hmac`
   ou `human_session`) afin de conserver l'audit existant.

Les validateurs actuels continuent à générer des Bearer HMAC. Le navigateur ne
lit plus `ADMIN_AUTH_SECRET`, ne génère plus de Bearer et ne stocke plus de
jeton d'authentification dans `localStorage` ou `sessionStorage`.

## API future

### `POST /api/v1/auth/login`

Entrée JSON stricte :

```json
{"username":"admin","password":"valeur non journalisée"}
```

Succès `200` : pose les deux cookies et retourne uniquement :

```json
{
  "authenticated": true,
  "administrator": {"username":"admin"},
  "idle_expires_at": "ISO-8601",
  "absolute_expires_at": "ISO-8601"
}
```

Erreurs : `400` entrée invalide, `401` échec générique, `429` blocage avec
`Retry-After`, `503` console non initialisée avec message opérationnel générique.
Le corps et les en-têtes sensibles ne sont jamais inclus dans les logs/audits.

### `GET /api/v1/auth/session`

Vérifie et renouvelle l'idle timeout. `200` retourne le même état public sans
token ; `401` efface les cookies devenus invalides.

### `POST /api/v1/auth/logout`

Exige session et CSRF, marque immédiatement la session révoquée, efface les
deux cookies et répond `204`. Un appel sans session exploitable efface aussi
les cookies et reste idempotent, sans prétendre avoir révoqué une autre
session.

## Audit

Actions prévues : `auth.login_succeeded`, `auth.login_failed`,
`auth.login_blocked`, `auth.logout`, `auth.admin_created` et
`auth.password_reset`.

Les détails autorisés sont acteur connu ou valeur générique, méthode
d'authentification, request ID, horodatage et IP/proxy validée si utile. Sont
interdits : mot de passe, hash, cookies, token de session, hash de token, jeton
CSRF, secret HMAC et en-tête Authorization.

## Frontend futur

- route `/login` hors `AppShell` ;
- `AuthProvider` charge `GET /api/v1/auth/session` avant d'afficher les routes ;
- `ProtectedRoute` affiche un état de chargement puis redirige vers `/login` ;
- destination demandée conservée uniquement comme chemin interne commençant
  par `/` mais jamais `//`, schéma ou hôte externe ;
- succès du login : retour vers la destination sûre, sinon `/` ;
- erreur `401` : message générique ; `429` : blocage temporaire ;
- expiration pendant l'usage : état vidé et redirection unique sans boucle ;
- logout : appel serveur, puis retour `/login` même si la suppression locale
  des cookies est répétée ;
- client HTTP central avec `credentials: 'include'` et en-tête CSRF pour les
  mutations ;
- suppression du parcours humain basé sur `sessionStorage`.

## Validation de la Phase 0

Le mainteneur a explicitement validé cette spécification, l'ADR et le plan de
migration le 2026-08-11. L'implémentation peut commencer par étapes vérifiées ;
elle reste à 0 % au moment de cette consignation.
