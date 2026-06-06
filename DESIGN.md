# Design System — t-aspriscombien · DA « Le Compagnon »

> **Source de vérité visuelle de l'app.** Décrit le design **réel** sous forme de
> **conventions à respecter**. Tokens = `app/globals.css`. Motion =
> `app/seance/_lib/motion.ts`. Primitives = `app/seance/_components/primitives.tsx`.
> Maquette de référence : `docs/presentation-da/screens/05-le-compagnon.html`.
> Décision DA : `docs/superpowers/specs/2026-06-06-da-compagnon-decision-design.md`.

## Principe directeur

**La fluidité prime sur la puissance**, et le **but central** : produire le texte
parfait à coller dans un LLM (« mon coach »). S'y ajoute l'ADN Compagnon : **un
guide qui croit en toi** — chaleureux, énergique, jamais infantilisant.

---

## 0. Les 6 lois (non négociables)

1. **Couleur = sens, jamais décoration.** Vert pré = marque/chrome/CTA + data muscu.
   Flamme = data athlé. Ciel = sélections interactives. `ok`/`danger` = états.
   Neutre = structure. (cf. §1)
2. **Clair et vivant.** Canvas `#FDFEFB`, cartes **blanches opaques bordées 2px**.
   Plus de verre dépoli ni de fond noir. Halos ambiants très dilués (vert/ciel).
3. **Le relief est dans le bouton, pas la carte.** CTA = ombre dure dessous
   (`0 5px 0 --brand-deep`, descend au press). Cartes = bordure 2px, pas d'ombre.
4. **Rayons hiérarchisés.** Carte → `radius-lg` (20). Bouton → 18/16/12 selon taille
   (plus de pilule CTA). Chip/badge/tab → `radius-full`. Input → `radius-md`.
5. **La donnée est en mono, tabulaire.** Tout chiffre mesuré → `--mono` +
   `font-variant-numeric: tabular-nums`. (cf. §3)
6. **Rien n'apparaît brutalement.** Skeleton **en forme**, count-up, graphe qui se
   dessine, `Reveal` staggeré. Jamais de `…`. (cf. §6)

---

## 1. Couleurs — la règle data / chrome / sélection

Litmus avant de poser une couleur :

> *Donnée mesurée ?* → **vert** (muscu, `--accent` #3D9414) ou **flamme** (athlé,
> `--warn` #E08200, pastilles `--warn-bright` #FFA216).
> *Contrôle, action, CTA, marque ?* → **vert pré** (`--brand` #4FB81F).
> *Sélection interactive (RIR, amplitude, focus input, stepper) ?* → **ciel**
> (`--ciel` #27A4E0).
> *État ?* → `--ok` #16A34A / `--danger` #DC2626.
> *Structure/label ?* → neutre (`--ink` / `--muted`).

### Marque & chrome — VERT PRÉ
| Token | Valeur | Rôle |
|---|---|---|
| `--brand` | `#4FB81F` | Marque + CTA + toggles ON. **Surfaces uniquement, jamais en texte** (2,3:1 sur clair). |
| `--brand-bright` | `#2E6D12` | **Texte vert** sur fond clair (5,75:1 WCAG) : « ? » du hero, libellés, chiffres verts petits. |
| `--brand-deep` | `#3D9414` | Ombre 3D des boutons, état pressé, texte vert grande taille. |
| `--brand-ink` | `#ffffff` | Texte sur surface verte pleine. |
| `--brand-soft` | `#EAF7E2` | Fond de pastille/chip vert discret. |
| `--brand-line` | `mix(brand 32%, white)` | Anneau d'un bloc vert soft. |

`--primary*` = alias historiques de `--brand*`. Préférer `--brand*`.

### Data — VERT (muscu) & FLAMME (athlé)
| Token | Valeur | Rôle |
|---|---|---|
| `--accent` | `#3D9414` | Data muscu : volume, séries, charges, courbes, `WeekRhythm`. |
| `--accent-strong` | `#2E6D12` | Texte data muscu petit corps. |
| `--warn` | `#E08200` | Data athlé en **texte** : chronos, allures. |
| `--warn-bright` | `#FFA216` | Data athlé en **surface** : dots, barres, remplissages. |

### Sélections — CIEL
| Token | Valeur | Rôle |
|---|---|---|
| `--ciel` | `#27A4E0` | Chip sélectionnée (RIR, amplitude), focus ring des inputs, boutons +/- des steppers. |
| `--ciel-deep` | `#1E86B8` | État pressé d'une sélection. |
| `--ciel-soft` | `#E4F4FC` | Fond d'une chip ciel discrète. |

### États & neutres
| Token | Valeur | Rôle |
|---|---|---|
| `--ok` | `#16A34A` | Succès : pastilles `+%`, « noté », checks. |
| `--danger` | `#DC2626` | Erreur / destructif. |
| `--ink` / `--ink-2` | `#35414B` / `#52616D` | Texte primaire / corps. |
| `--muted` / `--subtle` | `#8395A1` / `#ADBCC6` | Labels / métadonnées, disabled. |

### Surfaces & lignes
| Token | Valeur | Rôle |
|---|---|---|
| `--bg` / `--canvas` | `#FDFEFB` | Canvas clair. |
| `--surface` / `--surface-elevated` | `#FFFFFF` | Cartes, modales. |
| `--surface-2` | `#F2F7EC` | Inputs, chips neutres, pistes de segmented. |
| `--line` / `--line-2` | `#E6EEF2` / `#D5E2E9` | **Bordures 2px des cartes** / hover. |
| `--hairline` | `rgba(53,65,75,0.12)` | Diviseur 1px. |
| `--glass*` | voiles blancs | **Barre CTA basse uniquement** (overlay translucide + blur). Plus de glass sur les cartes. |

---

## 2. Fond ambiant & relief

- `AmbientBackground` = canvas `--bg` + 2 halos très dilués (vert pré en haut,
  ciel en bas droite). Les écrans restent `background: transparent` au-dessus.
- **Cartes** : opaques blanches, bordure 2px `--line` (hover interactif → `--line-2`).
  Pas d'ombre, pas de blur. `Card glass` est ignoré (compat API).
- **Barre CTA basse** (Idle) : seul usage restant du verre — `--glass-strong` +
  blur, le contenu se floute dessous.
- **Relief 3D réservé aux boutons** : `0 5px 0 --brand-deep`, qui passe à
  `0 2px 0` + `translateY(3px)` au press. C'est LA signature Compagnon.

---

## 3. Typographie

Trois familles, rôles stricts :
- **`--display`** (Baloo 2) → gros titres (hero), **boutons**, labels de cartes.
  Poids 700-800, `letter-spacing` léger négatif sur les heros.
- **`--font`** (Nunito Sans) → toute l'UI texte (labels, corps). Poids 400/600/700/800.
- **`--mono`** (JetBrains Mono) → toute donnée chiffrée, toujours `tabular-nums`.

Tailles de référence : hero 42-52px display 800 · gros chiffre stat 44px mono ·
chiffre de carte 25-28px mono · titre de carte 14-17px font 700 · label de section
11px UPPERCASE `--muted` · caption 10-11px `--subtle`.

**Clarté en 1 seconde** (inchangé) : un gros chiffre + une phrase humaine. Jamais
« LLM/ChatGPT/coach IA » à l'écran — on dit « mon coach ».

**Micro-copie coach adulte** (spec, acquis n°2) : ton Gus chaleureux mais factuel
(« +8 % de volume ce mois-ci »), pas de « Bravo champion !!! », pas d'emojis
systématiques. Célébrations réservées aux vrais jalons (PR, record, série).

---

## 4. Rayons & espacement

| Token | Valeur | Usage |
|---|---|---|
| `--radius-sm` | 8px | tags |
| `--radius-md` | 12px | inputs, tuiles, badges d'icône, bouton `sm` |
| 16-18px | (en dur dans Button) | **boutons** md/lg |
| `--radius-lg` | 20px | cartes |
| `--radius-xl` | 28px | sheets |
| `--radius-full` | 9999px | chips, pills, badges, tabs, toggles |

Trame 4px. Padding carte 16-18px ; gouttière écran 20px ; padding bas scrollable
`calc(96px + safe-area)` ; safe-areas respectées partout (inchangé).

---

## 5. Composants (primitives)

- **`Button`** — primaire = fond `--brand` plein, texte blanc, **ombre dure
  `0 5px 0 --brand-deep`**, descend au press. Display 700. Un primaire par écran.
  Secondaire = blanc bordé 2px `--line`. Danger = blanc, texte/bord `--danger`.
- **`Card`** — blanche opaque, bordure 2px `--line`, `radius-lg`, padding 16-18.
- **`Pill`** — `radius-full`. `ok` vert succès · `warn` flamme · `outline` neutre ·
  `accent` → `--brand-soft` / `--brand-bright`.
- **Input / `NumericInput`** — fond `--surface-2`, `radius-md`, **focus ring
  `--ciel`**, boutons +/- en `--ciel`.
- **`Toggle`** — ON = `--brand`.
- **Pastille de donnée** — dot + valeur data (`--accent` muscu / `--warn-bright`
  athlé), fond soft.
- **Badge d'icône décoratif** — neutre `--surface-2` / `--ink-2`. Pas de couleur.
- **Gus (mascotte)** — avatar rond, présent aux moments utiles (conseil de charge,
  bilan, célébration de jalon) — **pas omniprésent** (spec, acquis n°3). Assets à
  produire (chantier séparé).

---

## 6. Motion (`motion` v12) — INCHANGÉ

Tokens `_lib/motion.ts` (DUR/EASE/SPRING), entrée ease-out / sortie ease-in plus
courte, press scale, slides directionnels `StepSwitcher`, stagger listes, sheets
depuis le bas (scrim 40-60% noir — toujours valable sur fond clair), graphes
`pathLength`, `AnimatedNumber`, skeletons **en forme**. Seule nuance : le press
d'un **Button primaire** = descente 3D (translateY) au lieu d'un scale.

---

## 7. Patterns produit (conventions structurelles) — INCHANGÉ

Aperçu honnête des cartes · courbes représentatives du travail réel · export coach
central (hebdo compact + période-conscient) · écrans vides enrichis par domaine ·
athlé batch save au « Finir » · cache hooks SWR + invalidation.

---

## 8. Do / Don't

**Do** — canvas clair + cartes blanches bordées 2px · vert pré pour CTA/toggles ·
`#4FB81F` en surface seulement, `#2E6D12`/`#3D9414` pour le texte vert · ciel pour
les sélections · flamme pour la data athlé · données en mono tabulaire · ombre 3D
sur les boutons uniquement · skeleton en forme + count-up · un CTA primaire/écran ·
safe-areas.

**Don't** — pas de violet (l'ancienne marque est morte) · pas de `#4FB81F` en texte
sur fond clair · pas de verre sur les cartes · pas d'ombre portée sur les cartes ·
pas de vert/flamme sur du chrome neutre · pas de `…` ni d'apparition brute · pas de
« Bravo champion » ni d'emojis systématiques · pas de « IA/ChatGPT/Claude » dans l'UI.
