# REPLIQE — Top 10 design & UI-konsistens

Kort living-liste: hvad der er **gjort**, og hvad der **naturligt kommer efter** (typografi, tilstande, bevægelse, osv.).

---

## Gennemført (1–6, 8–9)

| # | Emne | Status | Hvor det lever |
|---|------|--------|----------------|
| **1** | **Fælles modal / bottom sheet** — backdrop + panel + valgfri handle, ens mønster på tværs | ✅ | `BottomSheet.jsx` |
| **2** | **Knap-hierarki** — primær / sekundær / tertiær (+ success, danger, outline-success, muted) | ✅ | `ActionButton.jsx` |
| **3** | **Z-index-skala** — bundmenu under, overlays over; standard `zClass` dokumenteret | ✅ | `zLayers.js`, kommentarer i `BottomSheet.jsx` |
| **4** | **Spacing-system** — 4px-base, tokens til sheets/modaler (`spacingTokens.js`), CSS-variabler som reference | ✅ | `spacingTokens.js`, `index.css` |
| **5** | **Én fælles “card”-flade** — radius, border, baggrund, valgfri hover; samlet i tokens og rullet ud i skærme | ✅ imported og brugt i bl.a. `cardTokens.js`, `App.jsx`, `ProgressOverview.jsx`, `ExerciseCard.jsx`, `PricingSheet.jsx`, `lib/AccountTab.jsx`, m.fl. |
| **6** | **Typografi-tokens** — roller (`TYPE_SHEET_TITLE`, `TYPE_DISPLAY`, `TYPE_OVERLINE`, …) i `typographyTokens.js`; udrullet; løse `text-[…px]` kun hvor nødvendigt (tokens, `!important`, responsive `sm:`) | ✅ | `typographyTokens.js` + stort set hele `src/` |
| **8** | **Focus & tilgængelighed** — `:focus-visible`-outline/vars pr. tema; `ActionButton` med `data-action-button` + synlig `ring`; danger-tekst hvid; `aria-label` / `aria-current` / `role="switch"` udvalgte steder | ✅ | `index.css`, `ActionButton.jsx`, `App.jsx`, `ExerciseCard.jsx`, `ProgressStrength.jsx` |
| **9** | **Bevægelse / transition** — `--motion-duration` / `--motion-ease` i `index.css`; `prefers-reduced-motion` sætter 0ms; sheet/backdrop entrance (`BottomSheet`); interaktive kort + `ActionButton` bruger `motionTokens.js` | ✅ **klar** (1. udrulning) | `index.css`, `motionTokens.js`, `BottomSheet.jsx`, `cardTokens.js`, `ActionButton.jsx` |

**#9 — afklaring:** Punktet er **færdigt for den planlagte første udrulning** (fælles timing + sheet-indgang + primære knapper/kort). Ens `transition-*` på **hver** resterende manuel klasse i `src/` er valgfri polish, ikke betingelse for at kalde #9 lukket.

---

## #7 — Startet (ikke lukket) — status opdateret

**Tomme & fejltilstande** — ens måde at vise *ingen data*, *offline*, *noget gik galt* + *prøv igen*, med samme visuelle ramme som card-tokens.

**Låste valg:** tom/fejl i kort-stil; knap kun når det giver mening; tydelig forskel tom vs. fejl; **app copy på engelsk**.

**Første bølge ude (konkret i kode):**
- Tomme tilstande som **card** + typografi-tokens: `ProgressRecovery` (frequency), `ProgressStrength` (top movers + deep-dive chart).
- **Engelsk** brugertekst på centrale foto-fejltimeouts/decode (`PhotosModal`, `ProgressPhotoEditor`); løbende fjernelse af resterende dansk i synlig copy.
- **Bekræftelse i app-UI** (ikke `window.confirm`) ved discard af **kladde til nyt programme** (`App.jsx`).

**Fortsættes før #7 kan lukkes helt:**
- `window.confirm` der stadig findes (fx discard ved **redigering af programme/routine** — se `App.jsx`).
- Tom-/fejl- og retry-mønstre på flere flows: **Coach**, lister, **offline**/synk, øvrige modal-afbrydelser.
- Eventuelt kort-baserede fejlbanner i stedet for `alert` udvalgte steder (prioritér høj-trafik).

---

## Næste bølge (10) + rest af 7

| # | Emne | Formål |
|---|------|--------|
| **7** | (fortsat) Tomme & fejltilstande | Se afsnit ovenfor |
| **10** | **Theme / farve** — semantiske navne (success, danger, surface, border) samlet ét sted; evt. audit af hårdkodede hex der stadig findes i JSX/CSS | **Delvis (fase 1):** `--plan-*`, `--in-progress-*`, `--semantic-negative*` i `index.css` med `[data-theme="bone"]`-overrides + `@theme`-farver (`plan-text`, `plan-hover`, `in-progress`, `negative`); Plan/Start/tom workout og relaterede knapper i `App.jsx` bruger dem. Øvrige komponenter og chart-piller kan skiftes senere uden at ændre udseende. |

---

*Opdater listen når et punkt lukkes.*
