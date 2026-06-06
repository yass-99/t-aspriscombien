# Notes pour le plan 2 — passe écran par écran (DA Compagnon)

Intrants collectés pendant l'exécution du plan fondations (revues qualité Task 2 + exploration initiale). À traiter dans le plan « sweep ».

## Contraste — texte vert/flamme (spec, acquis n°1)

`--brand` #4FB81F utilisé comme **couleur de texte** sur fond clair (~3,8:1, sous le seuil 4,5:1) → remplacer par `--brand-bright` #2E6D12 ou `--brand-deep` #3D9414 :
- `WeeklyCheckIn.tsx:156` · `WeekReportSheet.tsx:155` · `WeightDetailModal.tsx:318` · `WeightModal.tsx:160`
- `ConfigScreen.tsx:175,396` · `ExerciseSelectScreen.tsx:241` · `AthleticsScreen.tsx:609`
- `OnboardingProfileModal.tsx:126` · `settings/ProfileSettings.tsx:287`

`--warn` #E08200 en **texte petit corps** (10-14px, ~3,5:1) dans `AthleticsScreen.tsx` (10+), `AthleticsSummaryScreen.tsx`, `StatsScreen.tsx`, `HistoryScreen.tsx:499` → décider : assombrir le token texte athlé (ex. #B36800) ou passer ces libellés en taille/graisse « large text ».

**Accepté (ne pas « corriger ») :** blanc sur `--brand` #4FB81F dans les **boutons/chips bold** (LoggingScreen:464, SummaryScreen:774/833, PlanWeekModal:337, WeeklyCheckIn:178/276, HistoryScreen:192) — texte large bold ≥ 3:1 ✓, signature DA validée (cf. spec).

## Fondus de scroll & glass résiduels

`linear-gradient(to top, var(--glass-strong) 40%, transparent)` — maintenant voile blanc 86 % :
- `ConfigScreen.tsx:559` · `ExerciseSelectScreen.tsx:556` · `IdleScreen.tsx:589`
→ Vérifier visuellement : si le voile est trop opaque, fondre vers `var(--bg)` plutôt que `--glass-strong`, hauteur réduite.

`IdleScreen.tsx:712` — carte avec `background: var(--glass-strong)` : quasi indistincte du canvas clair → passer en `Card` standard (blanche bordée).

## Relief 3D neutralisé sur les CTA principaux (revue Task 3)

Trois call-sites passent `style={{ boxShadow: 'none' }}` à `<Button>` (héritage de l'ère « glow diffus ») — l'override écrase l'ombre dure 3D, signature de la DA, sur les boutons les plus visibles de l'app :
- `IdleScreen.tsx:619` (« Commencer une séance ») · `IdleScreen.tsx:649` (SplitStartButton) · `ConfigScreen.tsx:580` (CTA footer)
→ Retirer ces overrides au sweep.

Mineur : `scale(0.99)` au press n'apporte rien par-dessus `translateY(3px)` — envisager translateY pur.

## Scrims & couleurs en dur (exploration initiale)

- 18 occurrences `rgba(0,0,0,…)` (scrims de modales/sheets — 40-60 % noir reste valable sur clair, vérifier au cas par cas) : BodyHeatmap, OnboardingProfileModal, PlanWeekModal, primitives (ConfirmDialog), WeekReportSheet, WeightDetailModal, WeightModal, athletisme_detail, IdleScreen, LoggingScreen, SessionDetailScreen.
- 8 occurrences `rgba(255,255,255,…)`/`#000` en dur : icons.tsx, ConfigScreen, ExerciseSelectScreen, IdleScreen.
- `app/_components/Toast.tsx` et `FloatingUserButton.tsx` (hors périmètre fondations) à rethémer.
- `StatsScreen.tsx:58-65` — palette `TYPE_COLOR` des types de split codée en dur : contient `#A78BFA` (**dernier violet survivant de l'app**), `#FBBF24` (ancien ambre), `#67E8F9`, `#F472B6` → re-mapper sur la palette Compagnon (revue finale).

## Divers

- `--on-dark-mute` : token mort (aucun consommateur), sémantique contradictoire avec le thème clair → supprimer ou renommer lors du sweep.
- Hack `[data-seance-anim]` (gel des backdrop-filter) devenu inerte après la dé-glassification des cartes → supprimable si plus aucun backdrop-filter hors barre CTA.
- Micro-copie coach adulte + gamification aux jalons (spec, acquis n°2 et n°3) : passer les écrans Summary/Stats en revue.

## Constat visuel (Task 6)

- **Cache Turbopack empoisonné :** au premier lancement (serveur déjà actif, `/.next/dev` datant de l'ancien thème sombre), le CSS compilé servait encore `--bg: #000` et `colorScheme: dark` — le canvas apparaissait noir, le CTA violet. Résolu en supprimant `.next/dev` et en relançant `npm run dev`.
- **Après purge du cache** : canvas chaud off-white (`#fdfefb`) affiché correctement sur `/` et `/seance`.
- **Homepage (`/`)** : fond clair, halo vert ambiant visible en haut de page, titre « T'asPrisCombien? » en Baloo 2, CTA vert « Commencer une séance » avec relief 3D — conforme DA Compagnon.
- **Écran `/seance` (idle, utilisateur connecté)** : fond light-canvas, cartes blanches bordées, titres en Baloo 2, données en Nunito Sans mono, labels vert (MUSCU) et ambre (ATHLÉ) corrects, bouton footer vert plein — aucun violet, aucun fond noir.
- **Aucun résidu visible** de l'ancienne DA (pas de glass sombre, pas de halos violets) dans les deux écrans vérifiés.
- **Point d'attention (non bloquant)** : le cache Turbopack dev ne se purge pas automatiquement lors de changements de tokens CSS — à mentionner dans le README dev si d'autres contributeurs rencontrent le même artefact.
