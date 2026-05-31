# Design System — t-aspriscombien

> **Source de vérité visuelle de l'app.** Ce fichier décrit le design **réel** tel
> qu'implémenté, sous forme de **conventions à respecter**. Toute nouvelle UI s'y
> conforme. Tokens = `app/globals.css`. Motion = `app/seance/_lib/motion.ts`.
> Primitives = `app/seance/_components/primitives.tsx`.

## Principe directeur

**La fluidité prime sur la puissance** (logique Apple) : un écran qui glisse sans
friction bat un outil riche mais rugueux. Et le **but central de l'app** : produire le
texte parfait à coller dans un LLM (« mon coach »). Toute feature s'évalue à ces deux
aunes.

---

## 0. Les 6 lois (non négociables)

1. **Couleur = sens, jamais décoration.** Violet = marque/chrome. Vert = data muscu.
   Orange = data athlé. Vert-`ok` = succès. Rouge = erreur. Neutre = global. (cf. §1)
2. **Full-dark.** Canvas = vrai noir `#000000`. Les cartes vivent en **verre dépoli**
   sur un **fond ambiant violet**, jamais sur du noir plat. (cf. §4)
3. **Élévation sans ombre.** Profondeur = luminance de surface + hairline. Pas de
   drop-shadow sur les cartes (seule exception : un glow violet diffus sur LE CTA).
4. **Tout en pilule.** Bouton/chip/badge → `radius-full`. Carte → `radius-lg`. Input →
   `radius-md`.
5. **La donnée est en mono, tabulaire.** Tout chiffre mesuré → `--mono` +
   `font-variant-numeric: tabular-nums`. (cf. §3)
6. **Rien n'apparaît brutalement.** Chargement → skeleton **en forme**. Chiffre →
   count-up. Graphe → se dessine. Carte → `Reveal` staggeré. Jamais de `…`. (cf. §6)

---

## 1. Couleurs — la règle data / chrome

C'est LA convention centrale. Avant de poser une couleur, applique le **litmus** :

> *Est-ce une donnée mesurée (volume, chrono, charge, courbe) ?* → **vert** (muscu) ou
> **orange** (athlé).
> *Est-ce un contrôle, une action, une nav, une sélection, un élément de marque ?* →
> **violet**.
> *Un état ?* → **`ok`** (succès) / **`danger`** (erreur).
> *Rien de tout ça (structure, label, séparateur) ?* → **neutre** (`--ink` / `--muted`).

### Marque & chrome — VIOLET
| Token | Valeur | Rôle |
|---|---|---|
| `--brand` | `#7C3AED` | Marque + **tout le chrome** : CTA, focus, toggles ON, steps, sélections, icônes d'action, features globales (hero, export coach, réglages, poids, onboarding, Config, ExerciseSelect). |
| `--brand-bright` | `#A78BFA` | Glyphes/accents violet sur fond sombre (texte sur `--brand-soft`, « ? » du hero). |
| `--brand-deep` | `#6D28D9` | État pressé. |
| `--brand-ink` | `#ffffff` | Texte/icône **sur** une surface violette pleine. |
| `--brand-soft` | `mix(brand 20%, black)` | Fond de pastille/chip violet discret. |
| `--brand-line` | `mix(brand 46%, black)` | Anneau 1px d'un bloc violet soft. |

`--primary*` = alias historiques de `--brand*` (même valeur). Préférer `--brand*`.

### Data — VERT (muscu) & ORANGE (athlé)
| Token | Valeur | Rôle |
|---|---|---|
| `--accent` | `#BEF264` | **Data muscu** : volume, séries, charges, courbes muscu, `WeekRhythm`, icône muscu en Historique. NE PAS l'utiliser pour du chrome. |
| `--accent-strong` | `#84CC16` | Pressé/hover du vert. |
| `--accent-ink` | `#0A0A0B` | Texte sur surface verte pleine. |
| `--accent-soft` | `mix(accent 14%, bg)` | Fond de pastille data muscu (ex. pesée du hero). |
| `--accent-line` | `mix(accent 38%, bg)` | Anneau d'un bloc vert soft. |
| `--warn` | `#FBBF24` | **Data athlé** : chronos, distances, allure, courbes athlé. |

### États & neutres
| Token | Valeur | Rôle |
|---|---|---|
| `--ok` | `#4ADE80` | **Succès** : pastilles `+%`, confirmation « noté », check de validation. |
| `--danger` | `#F87171` | **Erreur** / action destructrice. |
| `--ink` | `#FAFAFA` | Texte primaire / scope **global** neutre. |
| `--ink-2` | `#E4E4E7` | Corps, valeurs secondaires. |
| `--muted` | `#A1A1AA` | Labels, texte support. |
| `--subtle` | `#71717A` | Métadonnées, captions, disabled, jours sans entraînement. |

### Surfaces & lignes
| Token | Valeur | Rôle |
|---|---|---|
| `--bg` / `--canvas` | `#000000` | Canvas (vrai noir). Le fond app. |
| `--surface` | `#16181a` | Surface de base (panneaux opaques, modales). |
| `--surface-elevated` | `#16181a` | Cartes non-glass / skeletons. |
| `--surface-2` | `#27272A` | Contrôles, inputs, chips neutres, badges décoratifs neutralisés. |
| `--line` / `--line-2` | `#27272A` / `#1F1F22` | Diviseurs structurels. |
| `--hairline` | `rgba(255,255,255,0.12)` | Diviseur 1px / contour sur verre. |

---

## 2. Glass & fond ambiant (le rendu signature)

- **`Card` est en verre dépoli par défaut** (`glass=true`) : fond `--glass` /
  `--glass-strong`, `backdrop-filter: blur(22px) saturate(1.5)`, highlight haut
  (`--glass-highlight`), anneau `--hairline` / `--glass-border`. **Aucun liseré teinté**
  sur le bord (« cheap »).
- Le verre n'est visible que sur de la matière : `AmbientBackground` (halos violets
  diffus, `position: fixed`, largeur colonne, posé dans `SessionClient`) remplace le noir
  plat. **Tout écran est rendu `background: transparent`** au-dessus.
- **Opt-out `glass={false}`** uniquement pour une carte posée sur un panneau opaque
  (ex. corps de la modale poids).
- Ne PAS mettre de glass sur les petits chips/pills (coût `backdrop-filter`) : surface
  opaque pour eux. Limiter le nombre de surfaces floutées par écran.
- **Barre CTA basse** (Idle) = overlay verre (`--glass-strong` + blur 24px) ; le contenu
  défile dessous et se floute. Jamais de dégradé noir plat.

| Token | Valeur |
|---|---|
| `--glass` | `rgba(255,255,255,0.045)` |
| `--glass-strong` | `rgba(255,255,255,0.07)` |
| `--glass-border` | `rgba(255,255,255,0.10)` |
| `--glass-highlight` | `rgba(255,255,255,0.06)` |

---

## 3. Typographie

Trois familles, rôles stricts :
- **`--display`** (Space Grotesk) → **gros titres uniquement** (hero d'écran). Poids 700,
  `line-height ~0.96`, `letter-spacing` négatif (≈ -2px à grande taille).
- **`--font`** (Inter) → **toute l'UI texte** (labels, boutons, corps). Poids 400 / 600 /
  700. Boutons en 700.
- **`--mono`** (JetBrains Mono) → **toute donnée chiffrée** (volume, chrono, charge,
  dates de séance, %), **toujours** avec `font-variant-numeric: tabular-nums`.

Tailles de référence réellement utilisées :
| Usage | Taille | Famille / poids |
|---|---|---|
| Hero d'écran | 52px | display 700 |
| Gros chiffre stat (Stats hero) | 44px | mono 600 |
| Chiffre de carte | 25–28px | mono 600 |
| Titre de carte | 14–17px | font 600/700 |
| **Label de section** | 11px **UPPERCASE**, `letter-spacing 0.4`, `--muted` 600 |
| Corps / valeur 2ndaire | 12–13px | font/mono 400–600 |
| Caption / méta | 10–11px | `--subtle` |

**Clarté en 1 seconde :** Stats & Historique = un gros chiffre + une phrase humaine.
Compréhensible par un enfant. Pas de jargon dans l'UI (jamais « LLM », « ChatGPT »,
« coach IA » à l'écran — on dit « mon coach »).

---

## 4. Rayons & espacement

| Token | Valeur | Usage |
|---|---|---|
| `--radius-sm` | 8px | tags, chips d'exo |
| `--radius-md` | 12px | **inputs**, tuiles, badges d'icône |
| `--radius-lg` | 20px | **cartes** |
| `--radius-xl` | 28px | conteneurs immersifs, sheets |
| `--radius-full` | 9999px | **boutons, pills, badges, tabs, toggles** |

Espacement sur une **trame de 4px**. En pratique : padding de carte **16–18px** ;
gouttière d'écran horizontale **20px** (constante — ne pas panacher 20/22) ; padding
bas de zone scrollable = `calc(96px + safe-area)` pour dégager la barre CTA.
Respecter les safe-areas (`env(safe-area-inset-*)`) sur hero, barre basse, modales.

---

## 5. Composants (primitives)

- **`Button`** — `radius-full`, hauteur `lg` ≥ 48px, label `--font` 700. Primaire = fond
  **`--brand`** plein, texte `--brand-ink`, hover `mix(brand 86%, white)`, press
  `scale 0.97`. C'est le seul CTA « loud » : **un primaire par écran** (le reste subordonné).
- **`Card`** — glass par défaut (cf. §2), `radius-lg`, padding 16–18. `interactive` →
  `whileTap scale ~0.985`.
- **`Pill`** — `radius-full`. Tons : `ok` (vert succès), `warn` (orange athlé),
  `outline` (neutre), `accent` (→ `--brand-soft` / `--brand-bright`, chrome violet).
- **Input / `NumericInput`** — fond `--surface-2`, `radius-md`, **focus ring `--brand`**.
- **`Toggle`** — ON = `--brand`, pouce `--brand-ink`.
- **Steps / progress dots**, **FinishPill** — chrome → violet (`--brand*`).
- **Pastille de donnée** (ex. pesée du hero, dot de discipline) — point + valeur en
  couleur **data** (`--accent` muscu / `--warn` athlé), fond `*-soft`.
- **Badge d'icône décoratif** (avatar de séance, carré d'icône d'une stat) — **neutre**
  `--surface-2` / `--ink-2`. Le badge n'est pas de la data → pas de couleur.

---

## 6. Motion (`motion` v12 / framer-motion)

> Chaque animation exprime une cause → effet ; jamais décoratif ; toujours
> interruptible ; **transform/opacity uniquement** (60fps). Respecte
> `prefers-reduced-motion` (déjà géré globalement dans `globals.css`).

Tokens (`_lib/motion.ts`, source de vérité — ne pas redéfinir en dur) :
```ts
DUR   = { micro: 0.18, base: 0.28, screen: 0.36, exit: 0.20 } // exit ≈ 65% de l'entrée
EASE  = { out: [0.22,1,0.36,1] /*entrée*/, in: [0.4,0,1,1] /*sortie*/ }
SPRING= { type:'spring', stiffness:320, damping:32, mass:0.9 }
```
Règles :
- **Entrée** ease-out, **sortie** ease-in et plus courte.
- **Press** : `scale 0.97` (cartes/boutons tappables).
- **Écrans** (`StepSwitcher`) : slide directionnel + fade (`screenVariants`), avancer =
  entre par la droite, reculer = par la gauche (`stepDirection`).
- **Listes** : stagger 30–50ms/item (`staggerList`), jamais tout d'un coup.
- **Sheets/modals** : slide depuis le bas + fade, scrim 40–60% noir.
- **Graphes** : tracé `pathLength` 0→1 + remplissage fade-in.
- **Chiffres** : count-up via `AnimatedNumber` (saute direct à la valeur en reduced-motion).

Outils prêts à réutiliser : `Reveal` (fade-up staggerable), `AnimatedNumber` (count-up),
`Skeleton` + skeletons **en forme** (`SkeletonStat` / `SkeletonAction` / `SkeletonSession`
épousent la géométrie de la carte réelle — ne jamais retomber sur un bloc générique).

---

## 7. Patterns produit (conventions structurelles)

- **Une carte donne un aperçu honnête de ce qu'elle ouvre.** Si elle mène à un écran
  multi-facettes, elle prévisualise ces facettes. Ex. la carte « Ta semaine » (Idle)
  montre muscu **et** athlé car elle ouvre Stats (les deux disciplines).
- **Courbe représentative du travail réel**, pas une jolie ligne creuse. Ex. `WeekRhythm`
  = charge par jour Lun→Dim (on voit quels jours l'élève a bossé), pas un volume hebdo lointain.
- **Export coach** = artefact central. Deux portées : sur `/seance`, version **compacte
  hebdo** (pill discrète → `WeekReportSheet`) ; dans **Stats → Global**, version
  **période-consciente** (7/30/90/Tout) via `formatPeriodForLLM`. Contexte = profil DB seul.
- **Écran vide** : enrichir avec des stats propres au domaine, ne pas déplacer une carte
  d'un autre scope.
- **Athlé : batch save au « Finir »** — accumulation en mémoire, jamais de POST entre 2 courses.
- **Cache hooks** (`useExos`/`useProfile`/`useBodyweight`) : stale-while-revalidate + TTL
  + bump de clé pour purger ; toujours `invalidate*Cache()` après une écriture.

---

## 8. Do / Don't

**Do** — vrai noir canvas + cartes en verre sur halos violets · violet pour CTA/focus/
toggles · vert/orange réservés à la data mesurée · `radius-full` sur tout bouton ·
données en mono tabulaire · skeleton en forme + count-up · un seul CTA primaire/écran ·
respecter les safe-areas.

**Don't** — pas de vert/orange sur du chrome (boutons, focus, avatars décoratifs) · pas
de violet sur de la data · pas de drop-shadow sur les cartes · pas de carte sur du noir
plat (le glass doit avoir de la matière) · pas de `…` ni d'apparition brute · pas de
transition qui snap (0ms) ou traîne (>500ms) · pas de hover comme seule interaction
(tactile-first) · pas de « IA/ChatGPT/Claude » visible dans l'UI.
