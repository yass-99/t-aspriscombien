# DA « Le Compagnon » — décision finale après exploration des variations

**Date :** 2026-06-06
**Statut :** validé par l'utilisateur
**Référence :** `docs/presentation-da/screens/05-le-compagnon.html` (maquette source) · `docs/presentation-da/lecompagnon.jpeg` (rendu)

## Décision

L'identité retenue pour l'app est **« Le Compagnon » (Gus) dans son esthétique originale** — celle de la maquette `05-le-compagnon.html` validée le 04/06 : vert pré #4FB81F, typo display Baloo 2, boutons 3D à ombre dure, canvas clair #FDFEFB, accents ciel #27A4E0 et flamme #FFA216.

Cette décision fait suite à une exploration complète de variations (12 directions sur 4 rounds) motivée par la crainte d'un rendu « trop enfantin ». L'exploration a confirmé que l'esthétique originale est un choix assumé, pas un défaut : l'utilisateur préfère son énergie aux versions « mûries ».

## Acquis invisibles à intégrer (sans changer le look)

Trois correctifs issus de la recherche (analyse Perplexity + base ui-ux-pro-max), à appliquer lors de l'implémentation de la DA :

1. **Contraste WCAG du vert en texte.** #4FB81F sur fond clair ≈ 2,3:1 — insuffisant pour du texte. Règle : #4FB81F reste réservé aux **surfaces** (boutons, pastilles, jauges) ; tout **texte vert** (chiffres de perf, « 62 kg », « +18 % », libellés) utilise le vert foncé existant `--pre-deep` #3D9414 minimum, ou #2E6D12 pour les petites tailles (5,75:1 sur crème). Vérifier chaque paire au contrast-checker.
2. **Micro-copie coach adulte.** Le ton Gus reste chaleureux mais factuel : « +8 % de volume ce mois-ci » plutôt que « Bravo champion !!! ». Pas d'emojis systématiques. Les célébrations sont réservées aux vrais jalons (PR, record, série de séances) — pas à chaque action.
3. **Gamification dosée.** Streak, badges et confettis existent mais n'apparaissent qu'aux jalons. Les écrans de données (séance, stats) restent « dashboard » : mono tabulaire, hiérarchie claire — conforme à la philosophie « clarté en 1 seconde » déjà actée.

## Tokens de référence (maquette source, inchangés)

| Token | Valeur | Rôle |
|---|---|---|
| `--canvas` | #FDFEFB | fond app |
| `--surface` / `--surface-2` | #FFFFFF / #F2F7EC | cartes |
| `--ink` / `--ink-2` / `--muted` / `--subtle` | #35414B / #52616D / #8395A1 / #ADBCC6 | textes |
| `--line` / `--line-2` | #E6EEF2 / #D5E2E9 | bordures |
| `--pre` / `--pre-deep` / `--pre-soft` | #4FB81F / #3D9414 / #EAF7E2 | vert marque + muscu |
| `--ciel` / `--ciel-deep` / `--ciel-soft` | #27A4E0 / #1E86B8 / #E4F4FC | sélections interactives |
| `--flamme` / `--flamme-deep` / `--flamme-soft` | #FFA216 / #E08200 / #FFF2DC | athlé + streak |
| `--display` | Baloo 2 | titres, boutons |
| `--font` | Nunito Sans | corps |
| `--mono` | JetBrains Mono | data, tabular-nums |

Boutons : radius 12-18, ombre dure 3D (`box-shadow: 0 5px 0 <deep>`). Cartes : radius 20, bordure 2 px.

**Amendement unique aux tokens :** ajout d'un rôle `--pre-text` #2E6D12 pour le texte vert petit corps (cf. acquis n° 1). Aucun autre token ne change.

## Variations explorées et écartées (archive)

Mockups conservés dans `.superpowers/brainstorm/508-1780726474/content/`.

- **Round 1 — timbres français de référence :** A cobalt Decathlon #3643BA · B orange Leboncoin #EC5A13 · C beige + violet Basic-Fit #592BB2.
- **Round 2 — timbres français hors référence :** D terracotta artisanale #9A3412 · E marine héritage #1E3A8A (rejeté : froid) · F vert bouteille club #15803D.
- **Round 3 — chaleur maximale :** G terracotta pleine · H ocre soleil #B45309 · I framboise #9D174D. Retour utilisateur : « j'aimais bien vert duolingo ».
- **Round 4 — vert conservé, contexte réchauffé :** J vert sur crème · K vert gazon #3F9E1B · L vert + terracotta. Synthèse finale (vert + terracotta + blanc chaud #FFF9F0 façon Google/Fitbit + illus 2D Coziya) présentée puis écartée au profit de l'originale.

Enseignement principal conservé : si un jour le rendu paraît enfantin en conditions réelles, le levier n'est **pas** de changer le vert mais de réchauffer le canvas (crème #FAF3E7) et d'aplatir les boutons — la piste L reste la meilleure issue de secours documentée.

## Prochaine étape

Réécrire `DESIGN.md` (racine du repo) pour remplacer les conventions du prototype actuel (violet chrome, full-dark #000) par les conventions du Compagnon — c'est le chantier d'implémentation qui suit ce spec, conformément à la décision du 04/06 (« l'UI actuelle = prototype, la logique/API survit »).

Points de vigilance pour ce chantier :
- La convention couleurs existante (muscu = vert, athlé = ambre) est conservée par la maquette (`--pre` / `--flamme`) — pas de migration sémantique, seulement de nouvelles valeurs.
- Le passage full-dark → clair touche tous les écrans : skeletons, halos, glass — à traiter dans le plan d'implémentation.
- Mascotte Gus : assets à produire (au minimum : neutre, encouragement, célébration) — hors scope de ce spec.
