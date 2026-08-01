# Event — Épreuve

## Rôle
Rendez-vous d'une saison : Grand Prix, manche, meeting ou rallye.

## Attributs
`id`, `seasonId`, `name`, `eventNumber?`, `startsAt?`, `endsAt?`, `status`, `circuitId?`, `venueId?`.

## Relations
Appartient à une saison, référence éventuellement un circuit/lieu et contient des sessions.

## Invariants
Les sessions doivent rester dans une fenêtre temporelle cohérente avec l'épreuve.
