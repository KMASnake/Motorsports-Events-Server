# Lot 4.4 — Critères d'acceptation Authentification

Date : 2026-08-11

Statut : `maintainer-validated-ci-green-awaiting-merge`

## État de couverture — 2026-08-12

Les étapes 0 à 4 ont été validées explicitement par le mainteneur. Les recettes
finales Windows et VPS couvrent le durcissement API, la session humaine, le
bootstrap CI, le contrôle Chromium et les régressions techniques. Les workflows
CI et Docker sont verts sur `27b85ae`; la fusion attend une autorisation
explicite.

Preuves associées :

- `docs/handoff/LOT-4.4-STEP-1-VALIDATION.md` ;
- `docs/handoff/LOT-4.4-STEP-2-VALIDATION.md` ;
- `docs/handoff/LOT-4.4-STEP-3-VALIDATION.md` ;
- `docs/handoff/LOT-4.4-STEP-4-VALIDATION.md`.

## Phase 0

- [x] décisions fonctionnelles approuvées retranscrites sans les rediscuter ;
- [x] Argon2id comparé aux alternatives et paramétré ;
- [x] sessions PostgreSQL, idle 1 h et maximum absolu 8 h spécifiés ;
- [x] cookie, proxy, CORS et développement HTTP spécifiés ;
- [x] protection CSRF distincte de SameSite spécifiée ;
- [x] coexistence HMAC technique/session humaine spécifiée ;
- [x] bootstrap, récupération, audit et migration cadrés ;
- [ ] validation explicite du mainteneur.

## Compte et mot de passe — Phase 1

- [ ] création initiale réussie par commande dédiée ;
- [ ] mot de passe lu de manière masquée ou par stdin de test, jamais en
  argument ni variable d'environnement ;
- [ ] seconde création refusée sans altérer le compte ;
- [ ] identifiant normalisé et compte singleton ;
- [ ] chaîne PHC Argon2id stockée, jamais le mot de passe ;
- [ ] paramètres Argon2id vérifiés et mesurés dans Docker ;
- [ ] hash distinct pour deux mots de passe identiques grâce aux sels ;
- [ ] procédure reset remplace le hash, révoque toutes les sessions et remet
  le blocage à zéro ;
- [ ] aucun secret dans sortie CLI, logs ou audit.

## Login et anti-bruteforce

- [ ] identifiant et mot de passe corrects : `200` ;
- [ ] mauvais identifiant : `401` générique ;
- [ ] mauvais mot de passe : même `401` et même message ;
- [ ] vérification factice coûteuse pour identifiant inconnu ;
- [ ] fenêtre de quinze minutes ;
- [ ] cinq échecs déclenchent quinze minutes de blocage ;
- [ ] blocage retourne `429` et `Retry-After` sans révéler le compte ;
- [ ] expiration du blocage autorise une nouvelle tentative ;
- [ ] succès remet compteur, fenêtre et blocage à zéro ;
- [ ] tests avec horloge injectée, sans attente réelle.

## Session et cookies

- [ ] token opaque de 32 octets, seule son empreinte SHA-256 en base ;
- [ ] nouvelle session après login, sans fixation de session ;
- [ ] cookie authentification `HttpOnly`, `Path=/`, sans `Domain` ;
- [ ] `Secure` et préfixe `__Host-` en production HTTPS ;
- [ ] développement HTTP local fonctionnel avec cookie non-Secure distinct ;
- [ ] `SameSite=Lax` ;
- [ ] cookie persistant au redémarrage navigateur dans la limite serveur ;
- [ ] idle timeout exactement 1 heure ;
- [ ] activité renouvelle l'idle sans dépasser 8 heures absolues ;
- [ ] session absolue expirée après 8 heures ;
- [ ] session expirée/revoquée rejetée et cookies effacés ;
- [ ] nettoyage des sessions expirées/revoquées ;
- [ ] logout révoque côté serveur avant d'effacer les cookies ;
- [ ] réutilisation d'un cookie volé après logout rejetée.

## CSRF et origines

- [ ] cookie CSRF signé, lié à la session et non utilisable comme authentifiant ;
- [ ] mutation cookie sans en-tête CSRF rejetée `403` ;
- [ ] cookie/en-tête différents rejetés ;
- [ ] signature ou liaison à une autre session rejetée ;
- [ ] origine navigateur non autorisée rejetée ;
- [ ] login JSON avec origine autorisée ;
- [ ] mutation avec session et jeton valides autorisée ;
- [ ] Bearer HMAC technique valide reste exempt de CSRF ;
- [ ] SameSite testé comme défense complémentaire seulement.

## API et coexistence

- [ ] `POST /api/v1/auth/login` conforme aux schémas et codes documentés ;
- [ ] `GET /api/v1/auth/session` renouvelle seulement l'idle timeout ;
- [ ] `POST /api/v1/auth/logout` idempotent et révocateur ;
- [ ] route admin sans cookie ni HMAC : `401` ;
- [ ] route admin avec session humaine : autorisée ;
- [ ] route admin avec ancien HMAC admin : autorisée sans régression ;
- [ ] ancien HMAC viewer : `403` ;
- [ ] Authorization invalide ne retombe pas sur un cookie valide ;
- [ ] API publique reste accessible sans session ;
- [ ] réponses auth ne contiennent mot de passe, hash, cookie ou token.

## Audit et confidentialité

- [ ] succès, échecs, blocage et logout audités ;
- [ ] création et récupération du compte auditées ;
- [ ] messages non révélateurs ;
- [ ] aucune valeur sensible dans `admin_audit_log` ;
- [ ] aucune valeur sensible dans les logs Fastify/Docker/CI ;
- [ ] identifiant de session exploitable et empreinte absents de l'audit ;
- [ ] request ID et méthode d'authentification présents lorsque pertinent.

## Frontend et Chromium

- [ ] `/login` accessible sans session et hors console ;
- [ ] chargement initial de session sans flash de console ;
- [ ] accès direct `/events` redirige vers `/login` ;
- [ ] login réussi revient vers `/events` ;
- [ ] redirection externe ou `//host` refusée ;
- [ ] mauvais identifiant, mot de passe et blocage affichés correctement ;
- [ ] expiration entraîne une seule redirection sans boucle ;
- [ ] logout depuis la navigation invalide la session et revient au login ;
- [ ] aucune saisie manuelle du HMAC dans l'interface ;
- [ ] aucun token d'authentification dans localStorage/sessionStorage ;
- [ ] desktop 1440×900, 1280×720 et largeur mobile du login ;
- [ ] non-régression fonctionnelle Lots 4.1 à 4.3.

## Migration, Docker et livraison

- [ ] migration UP sur base vierge et base Lot 4.3 ;
- [ ] deuxième UP idempotent ;
- [ ] rollback gardé puis réapplication ;
- [ ] compte, blocage et sessions conservés lors d'un redémarrage API ;
- [ ] fonctionnement Docker local et VPS derrière HTTPS ;
- [ ] CORS credentials limité à l'origine configurée ;
- [ ] npm audit, lint, typecheck, tests, builds et Docker réussis ;
- [ ] CI verte sur le SHA final ;
- [ ] recette Windows avec commandes de bootstrap, login, jeton CSRF implicite
  et nettoyage ;
- [ ] validation utilisateur explicite avant fusion.

## Hors périmètre

Pas de comptes multiples, interface Utilisateurs, rôles complexes, CAPTCHA,
blocage permanent, blocage fondé uniquement sur IP ou synchronisation
fournisseur dans ce lot.
