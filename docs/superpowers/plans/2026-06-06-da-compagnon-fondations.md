# DA « Le Compagnon » — Fondations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Basculer les fondations visuelles de l'app du thème full-dark violet vers la DA « Le Compagnon » (clair, vert #4FB81F, Baloo 2, boutons 3D) — spec : `docs/superpowers/specs/2026-06-06-da-compagnon-decision-design.md`.

**Architecture:** Migration pilotée par les tokens. La base est disciplinée (quasi tout consomme `var(--*)` de `app/globals.css`) : on retourne les valeurs des tokens (sombre→clair, violet→vert), on adapte les 4 fichiers structurants (layout/polices, primitives, AmbientBackground, DESIGN.md), et ~90 % de l'UI suit mécaniquement. Les retouches d'écrans (scrims, glass résiduels, couleurs sémantiques par écran, micro-copie) feront l'objet d'un **second plan** après visualisation du résultat.

**Tech Stack:** Next.js (App Router), React inline styles, next/font/google, motion v12, vitest.

**Maquette de référence :** `docs/presentation-da/screens/05-le-compagnon.html` (ouvrir dans un navigateur pour comparer pendant l'exécution).

**Hors scope (plans suivants) :** passe écran par écran, assets mascotte Gus, micro-copie coach, gamification aux jalons, `app/_components/Toast.tsx`/`FloatingUserButton.tsx`.

---

## Sémantique des couleurs (décision verrouillée)

L'app garde **les mêmes noms de tokens** (aucun renommage → aucun consommateur à toucher), seuls les **valeurs et rôles** changent :

| Token existant | Ancien rôle (dark) | Nouveau rôle (Compagnon) | Nouvelle valeur |
|---|---|---|---|
| `--brand*` | violet chrome | **vert pré chrome/CTA** | #4FB81F / deep #3D9414 / bright **#2E6D12 (texte vert WCAG)** |
| `--accent*` | lime data muscu | vert profond data muscu (lisible sur clair) | #3D9414 |
| `--warn` | ambre data athlé | flamme data athlé (lisible sur clair) | #E08200 (+ `--warn-bright` #FFA216 pour les pastilles/remplissages) |
| `--ciel*` | *(nouveau)* | sélections interactives (RIR, amplitude, focus inputs, steppers) | #27A4E0 / deep #1E86B8 / soft #E4F4FC |
| `--bg`/`--surface*` | noir/anthracite | canvas clair / cartes blanches | #FDFEFB / #FFFFFF / #F2F7EC |
| `--glass*` | verre sombre | voile blanc translucide (barre CTA basse uniquement) | rgba blancs |

---

### Task 1: Polices + chrome navigateur (layout.tsx)

**Files:**
- Modify: `app/layout.tsx:1-29` (imports + déclarations de polices)
- Modify: `app/layout.tsx:31-50` (metadata/viewport)
- Modify: `app/layout.tsx:58-82` (className html + ClerkProvider)

- [ ] **Step 1: Remplacer les polices Google**

Dans `app/layout.tsx`, remplacer les lignes 2-29 (imports Clerk/fonts + déclarations) par :

```tsx
import { ClerkProvider } from '@clerk/nextjs'
import { Nunito_Sans, Baloo_2, JetBrains_Mono } from 'next/font/google'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/next'

import { ServiceWorkerRegister } from './_components/ServiceWorkerRegister'
import { ToastProvider } from './_components/Toast'
import { FloatingUserButton } from './_components/FloatingUserButton'
import './globals.css'

const nunitoSans = Nunito_Sans({
  variable: '--font-nunito-sans',
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
})

const baloo2 = Baloo_2({
  variable: '--font-baloo-2',
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})
```

Note : l'import `import { dark } from '@clerk/themes'` (ligne 3) **disparaît**. Si `@clerk/themes` n'est plus importé nulle part ailleurs (`grep -rn "@clerk/themes" app/`), c'est attendu — ne pas désinstaller le paquet pour autant (surgical).

- [ ] **Step 2: Mettre à jour le chrome PWA (metadata + viewport)**

Dans le même fichier :
- `appleWebApp.statusBarStyle: 'black-translucent'` → `'default'`
- `viewport.themeColor: '#000000'` → `'#FDFEFB'`

- [ ] **Step 3: Mettre à jour className html et l'apparence Clerk**

Remplacer `className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}` par :

```tsx
className={`${nunitoSans.variable} ${baloo2.variable} ${jetbrainsMono.variable}`}
```

Remplacer le bloc `appearance` du `ClerkProvider` (baseTheme dark + variables sombres) par :

```tsx
appearance={{
  variables: {
    colorPrimary: '#4FB81F',
    colorBackground: '#FDFEFB',
    colorInputBackground: '#F2F7EC',
    colorText: '#35414B',
    colorTextSecondary: '#52616D',
    colorInputText: '#35414B',
    borderRadius: '12px',
    fontFamily: 'var(--font-nunito-sans)',
  },
  elements: {
    card: { background: '#FFFFFF', border: '2px solid #E6EEF2' },
  },
}}
```

- [ ] **Step 4: Vérifier la compilation TypeScript**

Run: `npx tsc --noEmit`
Expected: aucune erreur (s'il y en avait déjà avant la modif, ne corriger que celles introduites par la modif).

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(da): polices Compagnon (Baloo 2 + Nunito Sans) + chrome clair (Clerk, PWA)"
```

---

### Task 2: Tokens Compagnon (globals.css)

**Files:**
- Modify: `app/globals.css:3-74` (bloc `:root` complet)

- [ ] **Step 1: Remplacer le bloc `:root` (lignes 3-74) par les tokens Compagnon**

```css
:root {
  --bg: #FDFEFB;
  --surface: #FFFFFF;
  --surface-2: #F2F7EC;
  --ink: #35414B;
  --ink-2: #52616D;
  --muted: #8395A1;
  --subtle: #ADBCC6;
  --line: #E6EEF2;
  --line-2: #D5E2E9;
  --accent: #3D9414;
  --accent-strong: #2E6D12;
  --accent-ink: #FFFFFF;
  --accent-soft: color-mix(in oklch, var(--accent) 12%, var(--bg));
  --accent-line: color-mix(in oklch, var(--accent) 30%, var(--bg));
  --warn: #E08200;
  --warn-bright: #FFA216;
  --ok: #16A34A;
  --danger: #DC2626;

  /* --- DA « Le Compagnon » (cf. DESIGN.md + spec 2026-06-06) ------------- */
  /* Canvas clair chaud-vert, cartes blanches bordées. Le verre dépoli et le
     fond ambiant violet du prototype sont retirés. */
  --canvas: #FDFEFB;
  --surface-deep: #F7FAF2;
  --surface-elevated: #FFFFFF;

  /* Vert pré = couleur de MARQUE (CTA, chrome). #4FB81F est réservé aux
     SURFACES ; tout TEXTE vert utilise --brand-bright #2E6D12 (WCAG 5,75:1)
     ou --brand-deep #3D9414 minimum. cf. spec, acquis n°1. */
  --primary: #4FB81F;
  --primary-bright: #2E6D12;
  --primary-deep: #3D9414;
  --on-primary: #ffffff;
  --brand: #4FB81F;
  --brand-bright: #2E6D12;
  --brand-deep: #3D9414;
  --brand-ink: #ffffff;
  --brand-soft: #EAF7E2;
  --brand-line: color-mix(in oklch, var(--brand) 32%, white);

  /* Ciel = sélections interactives (RIR, amplitude, focus input, steppers). */
  --ciel: #27A4E0;
  --ciel-deep: #1E86B8;
  --ciel-soft: #E4F4FC;

  /* Verre : sur canvas clair = voile blanc translucide. Usage restreint à la
     barre CTA basse (overlay) — plus de glass sur les cartes. */
  --glass: rgba(255, 255, 255, 0.72);
  --glass-strong: rgba(255, 255, 255, 0.86);
  --glass-border: rgba(53, 65, 75, 0.10);
  --glass-highlight: rgba(255, 255, 255, 0.95);

  /* Hairlines sombres sur fond clair. */
  --hairline: rgba(53, 65, 75, 0.12);
  --hairline-strong: #D5E2E9;
  --on-dark-mute: rgba(255, 255, 255, 0.85);

  /* Rayons : carte 20 / bouton 18-12 (3D, plus de pilule CTA) / input 12. */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 20px;
  --radius-xl: 28px;
  --radius-full: 9999px;

  --radius: 14px;
  --shadow-sm: 0 1px 2px rgba(53, 65, 75, 0.10);
  --shadow-md: 0 4px 14px rgba(53, 65, 75, 0.10);
  --shadow-pop: 0 10px 30px -10px rgba(79, 184, 31, 0.25), 0 8px 24px rgba(53, 65, 75, 0.12);
  --font: var(--font-nunito-sans), -apple-system, system-ui, sans-serif;
  --mono: var(--font-jetbrains-mono), ui-monospace, "SF Mono", Menlo, monospace;
  --display: var(--font-baloo-2), -apple-system, sans-serif;

  /* CTA bas : ajustable selon le mode (site vs web app). */
  --cta-pad-bottom: 12px;

  color-scheme: light;
}
```

Points d'attention :
- Conserver tels quels les blocs suivants du fichier (`@media (display-mode: standalone)`, `html/body`, inputs date, keyframes, `[data-seance-anim]`, reduced-motion). Le `background: var(--bg)` de `html` devient clair automatiquement.
- Le commentaire des lignes 83-86 (« Peint TOUT l'écran en sombre… ») peut rester — il décrit le mécanisme safe-areas, toujours valable.

- [ ] **Step 2: Vérifier qu'aucun violet ne subsiste dans les tokens**

Run: `grep -n "7C3AED\|A78BFA\|6D28D9\|BEF264\|FBBF24\|#000000\|#16181a" app/globals.css`
Expected: **aucun résultat**.

- [ ] **Step 3: Lancer les tests existants**

Run: `npx vitest run`
Expected: même résultat qu'avant la modif (les tests sont de la logique, pas du style). En cas d'échec préexistant, le noter sans le corriger.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat(da): tokens Compagnon — canvas clair, vert pré, ciel, flamme (spec 2026-06-06)"
```

---

### Task 3: Primitives — bouton 3D, carte opaque bordée, focus ciel

**Files:**
- Modify: `app/seance/_components/primitives.tsx:48-110` (Button)
- Modify: `app/seance/_components/primitives.tsx:148-162` (Card)
- Modify: `app/seance/_components/primitives.tsx:311-313` (focus NumericInput)
- Modify: `app/seance/_components/primitives.tsx:324` et `:391` (couleur boutons +/-)

- [ ] **Step 1: Button — passer le primaire en 3D Compagnon**

Dans `Button`, remplacer la ligne `const scale = pressed ? 0.97 : 1` et le `transform` de `base` (lignes 48 et 70) pour que le press **descende** le bouton (3D) au lieu de le compresser :

```tsx
  const scale = pressed ? 0.99 : 1
  const lift = pressed ? 'translateY(3px)' : 'translateY(0)'
```

et dans `base` :

```tsx
    transform: gpu ? `translateZ(${z}px) ${lift} scale(${scale})` : `${lift} scale(${scale})`,
```

Toujours dans `base`, passer les boutons en Baloo 700 (maquette : boutons en display) :

```tsx
    fontWeight: 700,
    /* … */
    fontFamily: 'var(--display)',
```

Remplacer `sizes` (le CTA n'est plus une pilule — maquette : radius 18) :

```tsx
  const sizes: Record<ButtonSize, CSSProperties> = {
    lg: { height: 52, padding: '0 22px', borderRadius: 18, fontSize: 16 },
    md: { height: 44, padding: '0 18px', borderRadius: 16, fontSize: 15 },
    sm: { height: 34, padding: '0 14px', borderRadius: 12, fontSize: 13 },
  }
```

Remplacer `variants` (ombre dure dessous = signature Compagnon ; elle se réduit au press pendant que le bouton descend) :

```tsx
  const variants: Record<ButtonVariant, CSSProperties> = {
    primary: {
      // Marque = vert pré (cf. DESIGN.md §1). Ombre dure dessous : signature 3D.
      background: hover
        ? 'color-mix(in oklch, var(--brand) 92%, white)'
        : 'var(--brand)',
      color: 'var(--brand-ink)',
      boxShadow: pressed ? '0 2px 0 var(--brand-deep)' : '0 5px 0 var(--brand-deep)',
    },
    secondary: {
      background: hover ? 'var(--surface-2)' : 'var(--surface)',
      color: 'var(--ink)',
      boxShadow: '0 0 0 2px var(--line) inset',
    },
    ghost: {
      background: hover ? 'var(--surface-2)' : 'transparent',
      color: 'var(--ink-2)',
    },
    danger: {
      background: hover
        ? 'color-mix(in oklch, var(--danger) 8%, var(--surface))'
        : 'var(--surface)',
      color: 'var(--danger)',
      boxShadow: '0 0 0 2px color-mix(in oklch, var(--danger) 30%, var(--line)) inset',
    },
  }
```

- [ ] **Step 2: Card — opaque blanche, bordure 2px, plus de verre**

Remplacer les lignes 148-162 (calcul `ring` + `glassStyle`) par :

```tsx
  const [hover, setHover] = useState(false)
  // Compagnon : carte opaque blanche, bordure 2px. La prop `glass` est conservée
  // pour compat API mais n'a plus d'effet (plus de verre sur les cartes).
  void glass
  const ring = hover && interactive ? 'var(--line-2)' : 'var(--line)'
  const glassStyle: CSSProperties = {
    background: 'var(--surface)',
    boxShadow: `0 0 0 2px ${ring} inset`,
  }
```

(La ligne `const [hover, setHover] = useState(false)` existe déjà — la conserver, ne pas la dupliquer. Le `backdropFilter` disparaît : gain de perf, le hack `[data-seance-anim]` de globals.css devient inerte mais inoffensif.)

- [ ] **Step 3: NumericInput — focus et steppers en ciel**

Ligne 311-313, remplacer le ring de focus :

```tsx
          boxShadow: focus
            ? '0 0 0 1.5px var(--ciel) inset, 0 0 0 4px color-mix(in oklch, var(--ciel) 22%, transparent)'
            : '0 0 0 1px var(--hairline) inset',
```

Lignes 324 et 391, les deux boutons `-`/`+` passent de `color: 'var(--muted)'` à :

```tsx
            color: 'var(--ciel)',
```

- [ ] **Step 4: Vérifier compilation + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: aucune erreur nouvelle.

- [ ] **Step 5: Commit**

```bash
git add app/seance/_components/primitives.tsx
git commit -m "feat(da): primitives Compagnon — bouton 3D vert, carte blanche bordée, focus ciel"
```

---

### Task 4: AmbientBackground — halos clairs

**Files:**
- Modify: `app/seance/_components/AmbientBackground.tsx` (fichier entier, 71 lignes)

- [ ] **Step 1: Remplacer le contenu du fichier**

```tsx
'use client'

// Fond ambiant Compagnon — canvas clair + deux halos très doux (vert pré en
// haut, ciel en bas droite) qui donnent de la vie au fond sans le teinter.
// Statique (perf + reduced-motion). cf. DESIGN.md.
export function AmbientBackground() {
  return (
    <div
      aria-hidden
      style={{
        // Fixé au viewport + largeur de la colonne (480) → les halos restent
        // toujours visibles, sur tous les écrans (pas seulement l'Idle borné).
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 480,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        background: 'var(--bg)',
      }}
    >
      {/* Halo principal — haut, large, vert pré très dilué */}
      <div
        style={{
          position: 'absolute',
          top: '-14%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '120%',
          height: 480,
          background:
            'radial-gradient(50% 50% at 50% 50%, color-mix(in oklch, var(--brand) 16%, transparent) 0%, transparent 70%)',
          filter: 'blur(60px)',
          opacity: 0.5,
        }}
      />
      {/* Halo secondaire — bas droite, ciel très dilué */}
      <div
        style={{
          position: 'absolute',
          bottom: '-10%',
          right: '-20%',
          width: 420,
          height: 420,
          background:
            'radial-gradient(50% 50% at 50% 50%, color-mix(in oklch, var(--ciel) 14%, transparent) 0%, transparent 70%)',
          filter: 'blur(70px)',
          opacity: 0.4,
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Vérifier compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add app/seance/_components/AmbientBackground.tsx
git commit -m "feat(da): fond ambiant Compagnon — halos clairs vert/ciel"
```

---

### Task 5: DESIGN.md v2

**Files:**
- Modify: `DESIGN.md` (réécriture complète)

- [ ] **Step 1: Remplacer le contenu de DESIGN.md**

Réécrire le fichier en conservant sa **structure** (principe directeur, lois, §1-§8) mais avec les conventions Compagnon. Contenu complet :

```markdown
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
```

- [ ] **Step 2: Relire le fichier en regard de `app/globals.css`**

Vérifier que chaque valeur hex citée dans DESIGN.md existe à l'identique dans `globals.css` (Task 2). En cas d'écart, corriger DESIGN.md (globals.css fait foi).

- [ ] **Step 3: Commit**

```bash
git add DESIGN.md
git commit -m "docs(da): DESIGN.md v2 — conventions Compagnon (clair, vert pré, ciel, 3D)"
```

---

### Task 6: Vérification d'ensemble

**Files:** aucun nouveau — vérification.

- [ ] **Step 1: Build complet**

Run: `npm run build`
Expected: build OK, zéro erreur.

- [ ] **Step 2: Tests**

Run: `npx vitest run`
Expected: identique à l'état pré-migration.

- [ ] **Step 3: Garde-fous grep**

```bash
grep -rn "Space_Grotesk\|font-inter\|font-space-grotesk" app/ --include="*.tsx" --include="*.css"
grep -n "baseTheme" app/layout.tsx
```
Expected: **aucun résultat** pour les deux commandes.

- [ ] **Step 4: Contrôle visuel**

Run: `npm run dev` puis ouvrir `http://localhost:3000/seance` et comparer avec `docs/presentation-da/screens/05-le-compagnon.html` :
- canvas clair (#FDFEFB), plus aucun fond noir ni halo violet ;
- CTA vert #4FB81F avec ombre dure dessous, qui **descend** au press ;
- cartes blanches bordées 2px (plus de verre) ;
- titres en Baloo 2, corps en Nunito Sans, chiffres en mono ;
- focus d'un input = ring ciel.

Noter (sans corriger) toute zone encore « cassée » visuellement — scrims, couleurs en dur, contrastes — dans un fichier `docs/superpowers/plans/2026-06-06-da-compagnon-sweep-NOTES.md` : c'est l'intrant du plan 2 (passe écran par écran).

- [ ] **Step 5: Commit final**

```bash
git add docs/superpowers/plans/2026-06-06-da-compagnon-sweep-NOTES.md
git commit -m "docs(da): notes de la passe écran par écran à venir"
```

---

## Auto-review du plan (fait à l'écriture)

- **Couverture spec :** tokens + amendement `--brand-bright` #2E6D12 (acquis n°1) ✓ · micro-copie et gamification = documentés dans DESIGN.md v2, application concrète = plan 2 ✓ · Gus assets = hors scope explicite ✓.
- **Placeholders :** aucun — chaque step contient le code ou la commande exacte.
- **Cohérence types :** `lift`/`scale` introduits dans Task 3 step 1 cohérents avec le `transform` montré ; tokens cités dans primitives (`--ciel`, `--line-2`, `--warn-bright`) tous définis en Task 2.
- **Risque connu :** les écrans avec scrims noirs/glass locaux (18 occurrences `rgba(0,0,0,…)`, 8 `rgba(255,255,255,…)`, listées dans l'exploration) resteront sombres-stylés jusqu'au plan 2 — c'est accepté, l'app reste fonctionnelle.
