# REPLIQE — Top 10 design & UI-konsistens

Kort living-liste: hvad der er **gjort**, og hvad der **naturligt kommer efter** (typografi, tilstande, bevægelse, osv.).

---

## Gennemført (1–6)

| # | Emne | Status | Hvor det lever |
|---|------|--------|----------------|
| **1** | **Fælles modal / bottom sheet** — backdrop + panel + valgfri handle, ens mønster på tværs | ✅ | `BottomSheet.jsx` |
| **2** | **Knap-hierarki** — primær / sekundær / tertiær (+ success, danger, outline-success, muted) | ✅ | `ActionButton.jsx` |
| **3** | **Z-index-skala** — bundmenu under, overlays over; standard `zClass` dokumenteret | ✅ | `zLayers.js`, kommentarer i `BottomSheet.jsx` |
| **4** | **Spacing-system** — 4px-base, tokens til sheets/modaler (`spacingTokens.js`), CSS-variabler som reference | ✅ | `spacingTokens.js`, `index.css` |
| **5** | **Én fælles “card”-flade** — radius, border, baggrund, valgfri hover; samlet i tokens og rullet ud i skærme | ✅ imported og brugt i bl.a. `cardTokens.js`, `App.jsx`, `ProgressOverview.jsx`, `ExerciseCard.jsx`, `PricingSheet.jsx`, `lib/AccountTab.jsx`, m.fl. |
| **6** | **Typografi-tokens** — roller (`TYPE_SHEET_TITLE`, `TYPE_DISPLAY`, `TYPE_OVERLINE`, …) i `typographyTokens.js`; udrullet; løse `text-[…px]` kun hvor nødvendigt (tokens, `!important`, responsive `sm:`) | ✅ | `typographyTokens.js` + stort set hele `src/` |

---

## Næste fokus: #7

**Tomme & fejltilstande** — ens måde at vise *ingen data*, *offline*, *noget gik galt* + *prøv igen*, med samme visuelle ramme som card-tokens (ikke tilfældige tomme `<div>`s). Formål: færre “døde” skærme og tydeligere *hvad brugeren kan gøre nu*.

**Låste valg:** tom/fejl i kort-stil; knap kun når det giver mening; tydelig forskel tom vs. fejl; **app copy på engelsk** (dansk brugertekst rettes løbende). **Første skridt (lavthængende):** `ProgressRecovery` + `ProgressStrength` tomme tilstande; relevante foto-fejlstrings i `PhotosModal` / `ProgressPhotoEditor` er oversat til engelsk.

---

## Næste bølge (7–10) — forslag

| # | Emne | Formål |
|---|------|--------|
| **7** | **Tomme & fejltilstande** — ensillustration af “ingen data”, offline, gentag; samme tom-kort som card-tokens | Mindre “døde” skærme, klarere næste skridt for brugeren |
| **8** | **Focus & tilgængelighed** — synlig `:focus-visible`, kontrast på primærknapper, meningsfulde `aria-label` på ikon-knapper | Bedre keyboard og skærmlæsere uden at ændre visuelt “look” for mus |
| **9** | **Bevægelse / transition** — korte, varme varigheder (fx 150–200 ms) og én “ease”-kurve for hover, sheets, små UI-skift | Mindre “hakket” eller for langsomt; matcher eksisterende `transition-colors` hvor det allerede bruges |
| **10** | **Theme / farve** — semantiske navne (success, danger, surface, border) samlet ét sted; evt. audit af hårdkodede hex der stadig findes i JSX/CSS | Nemmere Bone/Dark og fremtidige temaer uden jagt i hele kodebasen |

---

*Opdater listen når et punkt lukkes (skift ✅ / fjern række i “Næste bølge” hvis det absorberes i 1–5).*
