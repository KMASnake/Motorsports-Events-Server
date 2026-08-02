# Journal des décisions

## 2026-08-02
- administration orientée métier ;
- slug masqué ;
- origine automatique ;
- fuseau automatique ;
- événements manuels sans correction ;
- corrections fournisseur champ par champ.
- le Project Handbook est la source de vérité des règles permanentes ;
- `docs/handoff/` reste la source canonique des règles et de l'avancement du
  lot courant, tandis que `docs/handover/` conserve l'historique ;
- une fusion dans `main` ne constitue jamais une validation utilisateur.

Voir `architecture/ADR-0008-DOCUMENTATION-GOVERNANCE.md`.

## 2026-08-03

- la valeur fournisseur, l'override local et la valeur effective sont
  réconciliés transactionnellement champ par champ ;
- une synchronisation fournisseur ne remplace jamais un override actif ;
- le retour à la valeur fournisseur supprime l'override actif ;
- les événements manuels refusent toute synchronisation fournisseur.

Voir `architecture/ADR-0003-PROVIDER-CORRECTIONS.md`.
