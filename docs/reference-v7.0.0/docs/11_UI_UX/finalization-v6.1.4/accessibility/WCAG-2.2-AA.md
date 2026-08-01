# Accessibilité WCAG 2.2 AA

## Exigences obligatoires

- Contraste texte normal >= 4.5:1.
- Contraste texte large >= 3:1.
- Focus visible sur tous les contrôles.
- Navigation complète au clavier.
- Aucun piège clavier.
- Libellés explicites pour champs et actions.
- Messages d’erreur reliés par `aria-describedby`.
- Notifications via `aria-live`.
- Dialogues avec focus initial, boucle de focus et restitution du focus.
- Respect de `prefers-reduced-motion`.
- Cibles tactiles de 44×44 px lorsque possible.
- Les statuts ne reposent jamais uniquement sur la couleur.

## Rôles ARIA recommandés

- Navigation principale : `nav`
- Zone principale : `main`
- Alertes critiques : `role="alert"`
- Notifications non bloquantes : `role="status"`
- Progression : `role="progressbar"`
- Tableau interactif : `table` natif avec en-têtes
- Fenêtre modale : `role="dialog"` et `aria-modal="true"`
