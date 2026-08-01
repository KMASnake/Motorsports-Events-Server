# Parcours end-to-end critiques

## E2E-001 — Synchronisation complète
Configurer un fournisseur, lancer une synchronisation, normaliser les données,
créer les entités canoniques et publier un snapshot.

## E2E-002 — Mise à jour incrémentale
Modifier une séance fournisseur puis vérifier la mise à jour sans doublon.

## E2E-003 — Correction protégée
Corriger un horaire, relancer la synchronisation et vérifier que seul le champ
corrigé reste protégé.

## E2E-004 — Réversion
Faire converger la source vers la correction, créer une proposition de
réversion, l'approuver et vérifier l'audit.

## E2E-005 — Conflit
Présenter deux valeurs incompatibles et vérifier l'ouverture puis la résolution
du conflit.

## E2E-006 — Course uniquement
Vérifier que les courses et courses sprint sont conservées, tandis que les
essais, qualifications, qualifications sprint et warm-up sont exclus.

## E2E-007 — Fournisseur indisponible
Vérifier retries, backoff, statut final et reprise.

## E2E-008 — Publication
Vérifier qu'un snapshot n'est créé que si le contenu public change.
