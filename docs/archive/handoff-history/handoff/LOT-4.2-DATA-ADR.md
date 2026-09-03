# ADR — Données de test hybrides

## ADR-4.2.2-001 — Copie indirecte de production

La production n'est jamais utilisée directement pour les tests. Un dump est
restauré dans une base temporaire isolée avant anonymisation.

## ADR-4.2.2-002 — Données sportives conservées

Les données sportives non personnelles peuvent être conservées pour préserver
la densité et les relations réalistes.

## ADR-4.2.2-003 — Identités synthétiques

Les utilisateurs, contacts et destinataires sont intégralement remplacés par
des identités synthétiques.

## ADR-4.2.2-004 — Vérification bloquante

Aucune base restaurée ne devient base de développement tant que les contrôles
de sécurité ne passent pas.

## ADR-4.2.2-005 — Générateur de secours

Un générateur déterministe reste disponible lorsque l'utilisation d'un
snapshot n'est pas possible ou souhaitable.
