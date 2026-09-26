# 8.1.0-alpha.2-lot.4

Cette révision corrige l'échec de build :

```text
TS2503: Cannot find namespace 'JSX'
```

Le registre d'icônes utilise désormais `ReactNode`.

Elle ajoute également les scripts de nettoyage Docker :

- `scripts/cleanup.ps1`
- `scripts/cleanup.cmd`
- `scripts/cleanup.sh`
- `scripts/reset-dev.ps1`
- `scripts/reset-dev.cmd`

## Validation attendue

```cmd
scripts\start-clean.cmd
```

Puis :

```cmd
scripts	est-lot2.cmd
```

Le lot ne doit être déclaré validé qu'après réussite du build Docker et des
healthchecks sur le poste de l'utilisateur.
