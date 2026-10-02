# Checklist sécurité — Données hybrides

## Protection de production

- [ ] Aucune écriture vers la production
- [ ] Refus de NODE_ENV=production
- [ ] Refus des hôtes de production
- [ ] Confirmation explicite
- [ ] Base temporaire isolée
- [ ] Rollback sur erreur

## Anonymisation

- [ ] Utilisateurs synthétiques
- [ ] E-mails en example.test
- [ ] Mots de passe remplacés
- [ ] Sessions supprimées
- [ ] Tokens supprimés
- [ ] Clés API supprimées
- [ ] IP sensibles supprimées
- [ ] Journaux nettoyés

## Neutralisation

- [ ] Webhooks désactivés
- [ ] E-mails redirigés/désactivés
- [ ] Push désactivé
- [ ] Tâches planifiées désactivées
- [ ] Providers en simulation/lecture seule
- [ ] URL de production absente

## Validation

- [ ] Script de vérification bloquant
- [ ] Code de sortie non nul en cas d'échec
- [ ] Rapport de contrôle
- [ ] Catalogue des données de test
- [ ] Dump absent de Git
