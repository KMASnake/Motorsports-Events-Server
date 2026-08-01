# Provenance des assets — lot 4.2

| Ressource | Chemin | Source | Statut | Ajout | Notes |
|---|---|---|---|---|---|
| Identité Motorsports Events | `apps/web/public/assets/branding/motorsports-events/logo.svg` | Composition SVG interne d'après la maquette validée | Asset propre au projet | 2026-08-01 | Tachymètre, nom et mention Server ; aucune dépendance distante. |
| Fallback championnat/circuit | `apps/web/public/assets/fallbacks/championship.svg` | Création interne MEDS | Asset propre au projet | 2026-08-01 | Utilisé lorsqu'aucun fichier autorisé n'est disponible. |
| Badges sport F1, MotoGP, WRC | `apps/web/public/assets/sports/` | Compositions SVG internes MEDS | Assets propres au projet, non officiels | 2026-08-01 | Identités informatives distinctes des logos de marque. |
| Drapeaux AU, DE, ES, FR, GB, IT, JP, US | `apps/web/public/assets/flags/` | Reproductions géométriques internes des drapeaux nationaux | Domaine public / symboles nationaux, selon juridiction | 2026-08-01 | SVG locaux, sans service distant ni pistage. |

## Logos officiels

Aucun fichier de logo officiel redistribuable avec une autorisation vérifiable
n'était présent dans le package. Le registre accepte désormais en priorité le
champ `logo_url` configuré par l'administrateur lorsqu'il dispose des droits,
puis un badge sport local et enfin le fallback générique.

Les directives officielles Formula 1 interdisent l'usage de leurs logos sans
licence écrite expresse. Le dépôt n'intègre donc pas le logo officiel et ne
laisse entendre aucune affiliation. Référence consultée le 2026-08-01 :
`https://www.formula1.com/en/information/guidelines.4EOKE9RRqevL4niTK9kWyt`.

## Pays

Le drapeau SVG local du circuit est rendu dans les vues Mois, Semaine, Jour,
Agenda et dans le panneau de détail. Le code ISO reste le fallback accessible.
Aucun emoji et aucun service distant ne sont utilisés.
