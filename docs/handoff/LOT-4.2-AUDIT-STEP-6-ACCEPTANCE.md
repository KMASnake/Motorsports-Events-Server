# Recette — remédiation audit Lot 4.2, étape 6

## Résultat de l'analyse

L'audit du verrou courant n'a reproduit qu'un avis élevé, malgré les deux avis
signalés par les installations Docker antérieures :

| Élément | Résultat |
| --- | --- |
| Paquet | `nanoid` |
| Avis | `GHSA-2v37-7h3g-55p8` (aucun CVE indiqué par npm) |
| Nature | dépendance transitive de `postcss`, elle-même utilisée par Vite |
| Version vulnérable | `3.3.16` (`<3.3.17`) |
| Version verrouillée corrigée | `3.3.18` |
| Exposition du projet | chaîne de construction Web ; aucune utilisation directe ni appel à un générateur personnalisé de taille zéro |
| Impact de mise à niveau | correctif compatible dans la même branche 3.3.x ; aucun changement d'API applicative |

Le scénario publié concerne une boucle infinie lorsqu'un générateur Nano ID
personnalisé reçoit une taille nulle. Le dépôt ne consomme pas directement
`nanoid`. Le verrou a néanmoins été corrigé afin de supprimer le composant
vulnérable de la chaîne de construction.

Après correction, `npm audit` retourne zéro vulnérabilité. Aucune exception de
sécurité temporaire n'est nécessaire.

## Commandes VPS

```bash
cd /home/debian/motorsports-events-server-lot42-test
git switch codex/lot-4.2-complete
git pull --ff-only

sudo docker run --rm \
  -v "$PWD":/source:ro \
  -w /tmp/project \
  node:22-alpine \
  sh -lc 'cp -a /source/. . && npm ci && npm audit && npm run typecheck && npm test && npm run build'
```

Résultat attendu :

- `found 0 vulnerabilities` ;
- 27 tests Web et 48 tests API réussis ;
- typage et builds Web/API réussis.

Aucun jeu de données n'est nécessaire : cette étape vérifie exclusivement la
chaîne de dépendances et les artefacts de construction.

Le lint reste un contrôle distinct : ESLint 9 ne peut pas démarrer tant que le
dépôt ne contient pas de fichier `eslint.config.*`. Ce défaut préexistant n'est
ni causé ni masqué par la correction de `nanoid` et devra être résolu avant la
validation finale du SHA.

## Résultat VPS

Validation confirmée par le mainteneur le 2026-08-09 dans l'image officielle
`node:22-alpine` avec npm 10.9.8 :

- installation verrouillée : 270 paquets, zéro vulnérabilité ;
- `npm audit` : zéro vulnérabilité ;
- typecheck API, Web et Types : réussi ;
- tests API : 48 réussis ;
- tests Web : 27 réussis ;
- builds API, Web et Types : réussis.

Cette validation ferme l'étape 6. Elle ne constitue pas la validation globale
du Lot 4.2 ni celle du SHA final.
