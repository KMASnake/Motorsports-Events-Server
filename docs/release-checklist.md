# Checklist de qualification d’une release

Cette checklist s’applique à toute release candidate et à sa promotion en
version stable.

## Validation automatisée

- [ ] `./scripts/validate-repository.sh` réussit ;
- [ ] la suite PostgreSQL isolée réussit ;
- [ ] l’archive est construite uniquement par `./scripts/build-release.sh` ;
- [ ] le SHA-256 du ZIP est valide ;
- [ ] l’archive réextraite réussit les mêmes tests ;
- [ ] les jobs GitHub `validate`, `postgres-integration` et
  `release-artifact` réussissent.

## Validation VPS

- [ ] le contrôle préalable à la mise à niveau réussit ;
- [ ] les versions locale et API correspondent à la candidate ;
- [ ] la révision Alembic attendue est active ;
- [ ] l’API et PostgreSQL sont sains ;
- [ ] Caddy et le scheduler sont actifs ;
- [ ] les nombres de sports, événements, séances et overrides sont conservés ;
- [ ] `/live`, `/ready` et `/metrics` répondent ;
- [ ] Prometheus et Grafana sont actifs sans exposition publique nouvelle ;
- [ ] le timer de sauvegarde reste actif ;
- [ ] aucune erreur applicative nouvelle n’apparaît dans les journaux.

## Promotion

- [ ] la validation VPS est enregistrée dans `PROJECT_STATUS.md` ;
- [ ] la pull request est intégrée dans `main` ;
- [ ] la version stable est construite depuis `main` ;
- [ ] le tag annoté correspondant est poussé ;
- [ ] le ZIP et son SHA-256 sont publiés avec la release GitHub.
