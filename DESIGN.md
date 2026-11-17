# Manuver — Design System

Glossy orange, black & white. Sporty, confident, uncluttered. Layout patterns follow familiar
swipe-app conventions (floating tab pill, full-bleed photo card, grouped settings) so the
interface feels known on day one; the brand lives in the orange gloss, Poppins headings and
sports-first content.

Source of truth in code: `lib/theme/tokens.ts`. Components: `components/ui/`.

## Principles

1. **Orange means "go".** The glossy orange is reserved for the action that moves the user
   forward: primary buttons, the like/invite button, the active tab, selected chips, toggles
   and progress. Never decoration, never body text.
2. **Black & white carry everything else.** Surfaces are warm off-white (light) or near-black
   (dark). Secondary actions are solid ink — black in light mode, white in dark mode.
3. **Photos lead.** On Discover the athlete's photo fills the card; the UI floats over it.
4. **Honest content.** Empty states say "Add" or "Not set yet" instead of inventing data.
   Premium is presentation only ("Coming soon · Notify me") — no prices, no purchase.

## Color

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#F3F2F0` | `#0A0A0A` | Screen background |
| `surface` | `#FFFFFF` | `#161616` | Cards, list groups, inputs |
| `surfaceMuted` | `#E6E4E1` | `#232323` | Empty slots, unselected chips, tracks |
| `border` / `hairline` | `#E0DDD9` / 8% ink | `#2A2A2A` / 8% white | Dividers |
| `text` | `#111111` | `#F5F5F4` | Primary text |
| `textSecondary` | `#5C5955` | `#A8A29E` | Supporting text |
| `textMuted` | `#75716C` | `#8C8782` | Placeholders, meta |
| `ink` / `onInk` | `#111` / `#FFF` | `#F5F5F4` / `#0A0A0A` | Secondary button |
| `primary` | `#FF5A1F` | `#FF5A1F` | Brand orange (fills) |
| `primaryText` | `#C2410C` | `#FF7A3D` | Orange used as text (AA contrast) |
| `primarySoft` | 12% orange | 16% orange | Tinted icon wells, sport chips |
| `danger` | `#D92D20` | `#FF5A4E` | Destructive |
| `success` | `#12805C` | `#3DD68C` | Confirmation |
| `onPhoto` | `#FFFFFF` | `#FFFFFF` | Text/icons over photos, black glass and gloss |
| `photoScrim` | 55% black | 55% black | Pills and badges sitting on photos |

`#FFFFFF` written directly is only allowed on gloss, black glass, danger buttons or photos. On any surface use `text`.

**Gloss** (`gloss`): vertical gradient `#FF8F52 → #FF5A1F → #E2400B` plus a soft white
specular band over the top half (`GlossFill`). Large surfaces (tier cards, paywall hero,
progress fills) use `GlossFill highlight={false}` so the band doesn't read as a pale dome.
**Black glass** (`glass` tokens, `GlassBackground`, `GlassButton`): the backdrop for welcome, sign-in, register, password screens and the loading overlay, in every theme. A deep gradient (`#101012 → #000`) plus one diagonal sheen; controls are translucent white (8%) with a 1px rim that is brighter on top. No blur and no looping animation, so it stays cheap on low-end phones. Orange appears only on the primary action and on the logo.

Light/dark follows the system. **Discover and the match celebration are always dark**
(`<ThemeScope scheme="dark">`); the tab bar follows Discover into dark.

## Typography

| Style | Font | Size / line | Use |
|---|---|---|---|
| `hero` | Poppins Bold | 34 / 40, −0.8 | Screen titles on flows |
| `title` | Poppins Bold | 28 / 34, −0.6 | Tab screen titles, section titles |
| `heading` | Poppins SemiBold | 20 / 26 | Card & section headings |
| `subheading` | Poppins SemiBold | 17 / 22 | Row titles, names in lists |
| `body` | Lato Regular | 16 / 23 | Body copy |
| `bodyStrong` / `label` | Lato Bold | 16 / 15 | Emphasis, chip labels |
| `callout` | Lato Regular | 15 / 21 | Secondary lines |
| `caption` | Lato Regular | 13 / 18 | Meta |
| `button` | Poppins SemiBold | 18 / 22 | Buttons |

Sentence case everywhere; no all-caps labels.

## Space, radius, elevation

- Spacing scale: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 44. Screen gutter 16.
- Radius: 10 (small) · 14 (inputs) · 16–24 (cards) · 28 (sheets, hero cards) · pill.
- Shadows: soft and low. Glossy elements get the orange-tinted `glossShadow`.
- Frosted glass (`Glass`) only on floating chrome: the tab bar. iOS blurs; Android uses a
  near-opaque fallback.

## Components (`components/ui`)

- **Button** — `primary` (gloss), `secondary` (ink), `tertiary` (surface + border), `ghost`,
  `danger`. Heights 58 / 50 / 38. One primary per screen.
- **Chip / ChipGroup** — selected = gloss with white label. Groups collapse with "Show more".
- **Toggle** — 56×32 glossy switch; replaces native `Switch`.
- **IconButton** — 44pt circle: `surface`, `plain`, `ink`.
- **ProgressHeader** — back, glossy progress track, Skip.
- **ListSection / ListRow** — grouped settings rows with value, chevron, check or toggle.
- **TextField** — large underline field; orange underline on focus.
- **RangeSlider** — two thumbs, glossy active track.
- **LanguageSwitcher** — EN | ID pill (`onDark` = translucent glass variant for the black brand screens).
- **FloatingTabBar** — frosted pill floating 8pt above the safe area; existing icons; active
  tab on a gloss capsule. Screens reserve `useTabBarInset()` at the bottom.
- **ProBadge** — Pro = gloss; Elite = black with orange edge.
- **SplashBurst** — short ring + speed-slash burst. `like` (orange), `pass` (white X-slash), `super` (upward streaks), `match` (large, behind the avatars). Plays once per key; skipped when the OS asks for reduced motion.

## Screens

- **Welcome / sign-in** — black glass; the orange logo eases in (`BrandMark`) and then breathes (2.5% scale, 3.4 s, UI thread only, off under reduced motion). `BrandStage` fixes the logo to one spot, so Welcome, sign-in and the loading overlay cross-fade with the logo staying put. Primary action = orange gloss, secondary = glass pill.
- **Auth forms & onboarding** — white/black surfaces, hero title, underline fields,
  progress header, chips for sports (grouped by category) and experience.
- **Discover** — dark; full-height photo card with name, distance and sport chips over a
  bottom gradient; pass (dark ring), super invite (small), invite-to-play (gloss, runner icon)
  float above the tab bar. Scroll the card for prompts, schedule and more photos. A splash
  plays the moment a swipe is committed. Missing data is hidden, never invented.
  Super invite is recorded as a normal like on the server for now.
- **Full profile sheet** — opened with ↑ on the card; always dark, same three actions in a
  fixed bottom bar.
- **Match** — both players slide in and collide, the spark pops, a large splash bursts behind
  them; "Send a message" (gloss) and "Keep discovering" (ghost).
- **Explore** — segmented Events | Open sparring. Open sparring shows the SOS "one player
  short" board above the session list.
- **Profile** — tilted photo stack + name, "Complete your profile" banner, info chips, photo
  strip, prompt tiles, sports tiles (Add badges on empty ones), floating upsell card + counters.
- **Settings** — Pro and Elite tier cards first, then grouped lists; Language checklist.
- **Paywall** — Pro/Elite segment, gloss or black hero, feature list, "Coming soon · Notify me".

## Language

English is the default on first launch; Indonesian is one tap away (welcome/sign-in pill or
Settings → Language) and persists on device. Strings live in `lib/i18n/en.ts` (source of
truth for keys) and `lib/i18n/id.ts`. Stored database values (sports, experience ids,
gender values) are never translated.
