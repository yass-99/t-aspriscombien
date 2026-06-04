# Repositionnement produit — « La nouvelle génération d'athlètes complets »

> Décision du 04/06/2026, à présenter au collaborateur le 05/06.
> Sources : 7 études Perplexity (concurrence muscu, marché hybride, grand public,
> tendances design, salles françaises, culture produit FR, DA française inclusive).

## 1. La décision

**Positionnement retenu :** l'app française et chaleureuse qui vit dans les salles de
musculation, couvre aussi l'athlétisme/course pour former des **athlètes complets**, et
qui **guide activement la séance** (flux assisté du prototype : config → exercices →
logging guidé → résumé).

Quatre piliers non négociables :

1. **France d'abord** — conquérir le marché français avant de penser global.
2. **Ancrage salles** — l'app se vit dans les Basic-Fit / Fitness Park / boxes, pas dans
   l'abstrait. Distribution par le terrain (pilotes boxes CrossFit/Hyrox IDF →
   franchisés dynamiques → sièges).
3. **Athlète complet** — muscu + athlé dans une seule app : la double discipline
   devient le positionnement (« nouvelle génération »), plus une bizarrerie.
4. **Guidage actif** — l'app assiste pendant la séance, elle ne se contente pas de
   logger. Le coach (export LLM aujourd'hui, plus intégré demain) reste le game changer,
   mais l'app doit être excellente sans lui.

**Contrainte transverse : chaleureux.** Tous les choix design partent de là.

## 2. Pourquoi (synthèse des recherches)

### Le créneau hybride est ouvert
- Hyrox : ~500k → 1M participations/an d'ici 2026, +1081 % en 5 ans, 70 % de
  first-timers, Europe en tête.
- Confirmé par la recherche : *aucune app grand public dominante ne fait du logging
  unifié force + course avec analyse croisée* — espace ouvert en 2026.
- Frustration n°1 des hybrides (Reddit) : jongler entre 3-5 apps + un tableur.
- Concurrents (Edge, HYBRD, ROXFIT, HyTrack) : tous jeunes, petits, personne n'a gagné.

### La France est un terrain praticable et sous-servi
- Les apps maison des salles (Basic-Fit ~875 clubs FR, Fitness Park ~300, Orange
  Bleue 400) sont des apps de badge/résa, pas des loggers : le gap est documenté.
- Les pratiquants sérieux utilisent déjà Hevy/Strong en parallèle dans ces salles.
- Canal partenariats : grandes chaînes verrouillées au siège → commencer par des POC
  avec franchisés influents et les ~430 boxes CrossFit indépendantes (terrain le plus
  ouvert, owners habitués à tester des apps).
- Motivations des Français : santé 57 %, se sentir bien 48 %, forme 44 % — la
  performance arrive loin derrière. 61 % font du sport 1×/semaine (+7 pts vs 2018,
  effet JO). Le ton doit être bien-être/encouragement, pas que data/perf.

### La DA actuelle envoie un code social excluant
- Codes perçus « premium excluant » en France : full dark glossy, néons, éclairage
  dramatique, anglais — le langage des studios parisiens CSP+ (Dynamo, Punch).
- Codes « accessible chaleureux » : fonds clairs, couleurs franches lumineuses,
  sans-serif lisible, photos de vraies gens, français partout — le langage
  Decathlon/Leboncoin (qualitatif ET populaire, transversal aux classes sociales).
- Le full-dark #000 + glass + halos violets actuel = colonne « excluant ». Le feedback
  « trop sombre, ne donne pas envie » était un signal de code social, pas de goût.
- Pattern marché validé : dual-theme standard 2025-26, écrans de séance sombres OK
  (focus), écrans de vie clairs.

## 3. Le brief DA commun (s'applique aux 5 pistes)

- **Chaleureux** : dominante claire, couleurs franches mais pas criardes, zéro
  noir+or, zéro ambiance club privé.
- **Français** : UI 100 % en français, tutoiement de coach bienveillant (modèle
  Decathlon Coach), micro-copy concrète, pas de jargon anglo-saxon.
- **Inclusif** : l'étudiant, l'ouvrier et le cadre se sentent également chez eux.
  Pas de codes de classe (ni luxe parisien, ni streetwear clivant).
- **Guidant** : la séance est un parcours assisté, pas un formulaire.
- **Honnête** : transparence données (réflexe RGPD français), pas de promesses
  « miracle en 30 jours », chiffres sourcés.

## 4. Les 5 identités de marque (deck `docs/presentation-da/index.html`)

Chaque proposition est une **identité complète** (valeurs → personnalité → langage
visuel propre), pas un skin. Les écrans haute fidélité (`docs/presentation-da/screens/`)
reprennent la structure réelle du prototype (IdleScreen, LoggingScreen, StatsScreen).
Tokens de référence extraits des sites officiels : `docs/presentation-da/RECHERCHE-TOKENS.md`.

| # | Identité | Valeurs | Personnalité | Risque principal |
|---|----------|---------|--------------|------------------|
| 1 | **Le Club** | Accueil · Régularité · Fierté simple | Le pote de salle fiable qui te connaît | Sage, peu mémorable |
| 2 | **La Salle** | Effort · Terrain · Authenticité | Le coach direct, exigeant mais chaleureux (lime hérité sur grège) | Froideur « perf » si mal dosée |
| 3 | **Le Terrain** | Jeu · Inclusion · France populaire | L'animateur de quartier qui fédère (cobalt/soleil/menthe, bordures) | Lisibilité/sérieux à doser |
| 4 | **Jour & Nuit** | Focus · Maturité · Continuité | L'entraîneur calme (héritage violet/lime ; vie claire, séance nuit) | La moins « nouvelle génération » |
| 5 | **Le Compagnon** | Encouragement · Constance · Joie | « Gus », la mascotte qui croit en toi (boutons 3D, chemin, streak) | Infantilisme ; production d'assets |

Hybridations naturelles : **2+5** (énergie + Gus discret), **1+4** (chaleur + séance nuit).
Chaque identité est maquettée sur 3 écrans : **Accueil**, **Séance guidée**, **Stats**.

## 5. Ce que la décision implique sur l'existant

- La logique métier, les API, le modèle de données et le flux SessionClient
  **survivent intégralement** (cf. mémoire : l'UI actuelle = prototype, ne pas
  sur-investir).
- DESIGN.md sera réécrit après le choix de la piste DA (les 6 lois actuelles —
  full-dark, glass, élévation sans ombre — sont remises en jeu).
- Le « bilan pour mon coach » est conservé et reste central ; son ton suivra la DA.
- Athlé : conservée et promue au rang de pilier du positionnement (athlète complet).
- À instruire ensuite : programme de pilotes salles (boxes IDF), onboarding < 60 s,
  progressive disclosure (mode simple par défaut).

## 6. Prochaines étapes

1. Présentation au collaborateur (05/06) : ce doc + le deck DA.
2. Choix de la piste DA (ou hybridation de 2 pistes).
3. Rédaction du nouveau DESIGN.md v2 à partir de la piste retenue.
4. Plan d'implémentation de la refonte UI (writing-plans), écran par écran.
5. En parallèle : liste de 10 boxes/salles IDF à démarcher pour pilotes.
