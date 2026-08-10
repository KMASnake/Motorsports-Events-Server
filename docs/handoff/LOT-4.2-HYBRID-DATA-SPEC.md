# Lot 4.2 complet — Données de test hybrides réalistes

## 1. Objectif

Fournir à l'environnement de développement des données sportives réalistes
sans exposer de données personnelles, secrets ou intégrations de production.

L'approche retenue est hybride :

```text
données sportives réalistes issues d'un snapshot de production
+
identités, utilisateurs et secrets entièrement synthétiques
+
intégrations externes neutralisées
```

## 2. Données pouvant être conservées

Sous réserve qu'elles ne contiennent aucune donnée personnelle ou secrète :

- sports ;
- championnats ;
- saisons ;
- événements ;
- sessions ;
- circuits ;
- pays ;
- villes ;
- fuseaux horaires ;
- relations entre entités ;
- statuts ;
- données de calendrier ;
- identifiants techniques externes nécessaires aux tests ;
- historiques purement techniques non identifiants.

## 3. Données à remplacer ou supprimer

Doivent être supprimés, révoqués ou remplacés :

- utilisateurs réels ;
- noms, pseudonymes et adresses e-mail réels ;
- mots de passe et hashes de production ;
- sessions actives ;
- refresh tokens ;
- JWT persistés ;
- clés API ;
- secrets OAuth ;
- credentials de providers ;
- webhooks ;
- destinataires de notifications ;
- adresses IP ;
- user agents si identifiants ;
- journaux contenant des données personnelles ;
- données de support ou commentaires administratifs sensibles.

## 4. Intégrations à neutraliser

Dans l'environnement restauré :

- e-mails désactivés ou redirigés vers `example.test` ;
- notifications push désactivées ;
- SMS désactivés ;
- webhooks supprimés ;
- tâches planifiées désactivées ;
- synchronisations providers en mode lecture seule, simulation ou désactivées ;
- aucun appel automatique vers la production ;
- aucune URL de production utilisée pour les callbacks ;
- aucune clé réelle chargée depuis le snapshot.

## 5. Scripts attendus

Codex doit créer ou adapter :

```text
scripts/data/
├── export-production.ps1
├── import-production-snapshot.ps1
├── sanitize-test-data.sql
├── verify-sanitized-data.ps1
├── generate-realistic-test-data.ts
├── reset-from-production-snapshot.ps1
└── reset-from-production-snapshot.cmd
```

Une variante `.sh` peut être ajoutée mais Windows reste prioritaire.

## 6. Export de production

`export-production.ps1` doit :

- être explicitement exécuté par un administrateur ;
- fonctionner en lecture seule ;
- ne jamais contenir de mot de passe codé en dur ;
- recevoir les paramètres via environnement ou invite sécurisée ;
- produire un dump PostgreSQL au format custom ;
- calculer un SHA-256 ;
- dater le fichier ;
- afficher un avertissement clair ;
- ne jamais ajouter le dump au dépôt Git.

Exemple de nom :

```text
motorsports-events-prod-2026-08-01T180000Z.dump
```

## 7. Import sécurisé

`import-production-snapshot.ps1` doit :

1. vérifier que Docker fonctionne ;
2. refuser `NODE_ENV=production` ;
3. refuser un hôte ou une URL identifiée comme production ;
4. demander une confirmation explicite ;
5. restaurer dans une base temporaire isolée ;
6. exécuter l'anonymisation ;
7. exécuter la neutralisation ;
8. exécuter la vérification ;
9. promouvoir la base comme base de développement uniquement si tous les tests passent ;
10. supprimer la base temporaire en cas d'échec.

## 8. Anonymisation et synthèse

### Utilisateurs

Les utilisateurs doivent être remplacés par des comptes synthétiques :

```text
admin-001@example.test
editor-001@example.test
viewer-001@example.test
```

Les mots de passe ne doivent pas être repris. Les comptes synthétiques doivent
utiliser des secrets de développement clairement documentés ou un mécanisme de
réinitialisation local.

### Identifiants

Lorsque les relations nécessitent de conserver les identifiants internes,
l'anonymisation doit remplacer les attributs personnels sans casser les clés
étrangères.

### Journaux

Les journaux doivent être :

- supprimés ;
- ou expurgés ;
- ou limités à des entrées techniques synthétiques.

## 9. Vérifications bloquantes

`verify-sanitized-data.ps1` doit échouer si l'un de ces éléments est détecté :

- domaine e-mail autre que la liste autorisée (`example.test`, `localhost`) ;
- token ou secret ressemblant à une valeur de production ;
- clé API active ;
- webhook actif ;
- destinataire réel ;
- tâche planifiée active ;
- URL de production ;
- environnement `production` ;
- base distante non autorisée ;
- adresse IP publique dans une table sensible ;
- credential provider non factice.

Le script doit retourner un code de sortie non nul.

## 10. Générateur synthétique de secours

`generate-realistic-test-data.ts` doit permettre de travailler sans snapshot.

Il doit générer notamment :

- plusieurs sports ;
- au moins 12 championnats ;
- au moins 40 circuits ;
- plusieurs pays et fuseaux ;
- une saison dense ;
- événements passés, futurs, annulés et reportés ;
- chevauchements simples ;
- événements publiés et brouillons ;
- sessions variées ;
- logos et drapeaux via le registre d'assets ;
- cas limites utiles au calendrier du lot 4.2.

Les données doivent être déterministes avec un paramètre `--seed`.

## 11. Commandes attendues

Exemples cibles :

```powershell
.\scripts\data\export-production.ps1
```

```powershell
.\scripts\data\reset-from-production-snapshot.ps1 `
  -DumpFile "C:\backups\motorsports-events-prod.dump"
```

```powershell
npm run data:generate
npm run data:verify
```

## 12. Fichiers à ignorer par Git

Ajouter au `.gitignore` :

```text
*.dump
*.dump.gz
backups/
snapshots/
sanitized-snapshots/
.env.production
```

Aucun dump, même anonymisé, ne doit être commité sans décision explicite.

## 13. Documentation attendue

Créer :

```text
docs/data/PRODUCTION-SNAPSHOT-GUIDE.md
docs/data/SANITIZATION-POLICY.md
docs/data/TEST-DATA-CATALOG.md
docs/data/SECURITY-CHECKLIST.md
```

La documentation doit expliquer :

- quelles données sont conservées ;
- quelles données sont remplacées ;
- quelles intégrations sont neutralisées ;
- les risques résiduels ;
- la procédure de suppression du snapshot ;
- la rotation des snapshots ;
- les responsabilités de validation.

## 14. Critères d'acceptation

- [ ] export sans secret codé en dur ;
- [ ] import impossible vers production ;
- [ ] restauration dans une base temporaire ;
- [ ] anonymisation automatique ;
- [ ] comptes synthétiques ;
- [ ] secrets supprimés ;
- [ ] webhooks supprimés ;
- [ ] notifications neutralisées ;
- [ ] tâches planifiées désactivées ;
- [ ] vérification bloquante ;
- [ ] rollback en cas d'échec ;
- [ ] générateur synthétique déterministe ;
- [ ] documentation complète ;
- [ ] dumps ignorés par Git ;
- [ ] tests Windows documentés.

## 15. Hors périmètre

- automatiser une connexion directe permanente à la production ;
- utiliser la base de production comme base de test ;
- copier des secrets dans les environnements de développement ;
- publier des snapshots dans GitHub ;
- permettre à Codex d'accéder à une production réelle.
