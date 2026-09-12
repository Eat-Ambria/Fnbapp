# MEMORY.md — Change log and reasoning

**Purpose.** A durable record of what was changed in this codebase, and *why*, so a
future session has the reasoning even if the chat history is gone. Read this
alongside `CLAUDE.md`. `CLAUDE.md` holds the project's standing rules; this file
holds decisions, root causes, and traps discovered while working.

**Convention.** When you change something non-obvious, add it here. Record the
*reasoning*, not just the diff — the diff is in git, the reasoning is not.

---

## 1. Design system

### Where things live

| File | Role |
|---|---|
| `src/utils/theme.js` | `K` tokens, `type` scale, `TONES`/`tone()`, and `KITCHEN_CSS` (the injected stylesheet). Single source of truth. |
| `src/components/KitchenUI.jsx` | Presentational primitives — `KTabs`, `KButton`, `KPanel`, `KStat`, `KPill`, `KProgress`, `KBanner`, `KContextBar`, `KColHead`, `KModal`, `KToast`. No state, no data fetching. |
| `src/components/Icons.jsx` | Inline stroke SVGs in a `PATHS` map + `Icon` component. |
| `src/utils/ripple.js` | Shared click-ripple handler. |
| `src/data/constants.js` | Legacy `C` palette. Screens not yet migrated still use it. |

### Colour system — two distinct roles

There are **two** accent families and they mean different things:

- **`K.accent` (blue `#2563EB`)** — the *data* accent. Charts, progress, links,
  informational emphasis.
- **`K.brand` (deep green `#1C3D2B`)** — the *brand plate*. Sidebar active pill,
  header badge, active tab, **dialogs**, primary confirm buttons.

Chrome belongs to the brand plate. Data belongs to the accent. Dialogs were
originally blue and looked foreign; they are brand green now.

`K.ok` (mint `#129A6C`) is a **status** tone, not a brand colour. Use it for small
success indicators. Do **not** use it to fill a large surface — flooding a card
with `K.okBg` washes the text out and a column of such cards reads as one flat
slab. The pattern for a "done" surface is: white body + solid 4px brand rail +
a tint that fades out to the right.

Hover shades are tokens (`brandHover`, `brandBgHover`, `dangerHover`) rather than
literals in the stylesheet, so a palette change cannot leave hovers behind.

### `.kh-scope`

Screens opt into the design system by wrapping their root in
`<div className="kh-scope">`. Most helper CSS is scoped to it.

**Exception:** anything rendered through a portal (`KModal`, `KToast`) sits
outside `.kh-scope` on `document.body`, so its CSS must be **unscoped**. This is
why `.kh-pickrow`, `.kh-maprow`, `.kh-modal-x`, `.kh-toast`, `.kh-rip` and the
`.kh-btn-*` hovers have no `.kh-scope` prefix.

---

## 2. Traps — read before editing

These each cost real debugging time. They will bite again.

### 2.1 `KITCHEN_CSS` is a JS template literal — no backticks inside

`KITCHEN_CSS` in `theme.js` is a backtick-delimited string. A backtick anywhere
inside it — **including in a CSS comment** — terminates the literal and breaks the
build with a confusing "Expected a semicolon" error pointing at the comment text.

This broke the build **three separate times** in one session. Write CSS comments
without backticks. Never write `` `position` `` in a comment there.

### 2.2 JSX comments in JavaScript slots

`{/* … */}` is only valid where JSX **children** go. It is invalid:

- inside a prop's expression slot — `right={ {/* … */} <div/> }` parses as an
  object literal and fails
- as a sibling inside a `.map()` callback that returns one element — the callback
  then returns two nodes without a fragment

Use `//` comments in both cases.

### 2.3 Inline styles beat CSS classes

Almost everything in this codebase styles inline. A plain class rule loses to an
inline style, so hover/focus rules that repaint need `!important`.

**But** be surgical about which property gets `!important` — see 2.4.

### 2.4 `.kh-rip` must not force `position`

The ripple needs `position: relative` + `overflow: hidden` on its host. The first
version used `position: relative !important`, which **overrode the inline
`position: absolute`** on modal close buttons and dropped them out of their
corner into normal flow.

`.kh-rip` now sets `overflow: hidden !important` but `position: relative` *without*
`!important`. A host that is already positioned keeps its own value; a host with
no inline position picks up `relative` from the class.

Do **not** put `.kh-rip` on anything that must overflow (a row containing a
dropdown, a card with a floating badge) — `overflow: hidden` will clip it.

### 2.5 `background` shorthand erases `background-image`

`.kh-cardart` / `.kh-cardart-sm` supply decorative artwork via `background-image`.
A host using the **shorthand** `background: <colour>` resets `background-image` and
silently erases the artwork. Hosts must use `backgroundColor`.

This is why `KPanel`, `Card`, `KStat` and the dish cards all use `backgroundColor`.

Related: an element's `background-image` always paints **beneath its own
descendants**. An earlier `.kh-cardart > * { position: relative }` rule was added
"to keep content above the artwork" — it was unnecessary and only risked
re-anchoring somebody's absolutely-positioned descendant across all 36 `<Card>`
usages. It was removed.

### 2.6 Container queries cannot query themselves

`@container` resolves against the nearest **ancestor** container. An element
cannot be both `container-type: inline-size` and the thing being queried.

Both grids use a wrapper/child split:

- `.kh-dishwrap` (container) > `.kh-dishgrid` (queried)
- `.kh-dispatchwrap` (container) > `.kh-dispatchgrid` (queried)

Container queries are used deliberately instead of viewport media queries: these
grids live inside panels whose width depends on the sidebar state, so a viewport
breakpoint would put three cramped columns in a half-width panel.

### 2.7 Never key a CSS selector on user-visible text

An attribute selector like `[title="Reset current"]` breaks the moment the label
is translated, and fails silently. Use a class. `KButton` accepts a `className`
prop for exactly this.

### 2.8 PowerShell `Set-Content -Encoding utf8` writes a BOM

Writing `package.json` this way produced a BOM that made every tool fail with
`Unexpected token '﻿'`. Use Node (`fs.writeFileSync`) for JSON files.

### 2.9 Vite dev-server staleness

HMR repeatedly served stale modules after edits — most visibly when a **new
export** was added (`mergeDishState is not defined` even though the export was
correct and the production build passed). If the browser disagrees with the
source, hard-refresh, then restart the dev server. Verify with:

```
curl -s "http://localhost:5173/Fnbapp/src/utils/helpers.js" | grep <symbol>
```

Note the `/Fnbapp/` prefix — `vite.config.js` sets `base: '/Fnbapp/'`.

---

## 3. Critical bugs fixed — root causes

### 3.1 "I press Done and it un-marks itself"

Reported as flaky and intermittent. **Three independent causes.**

**(a) Stale snapshot overwriting a live map.** Every handler built its update by
spreading the copy of a nested map it captured at render time:

```js
setDs(..., { manual: { ...d2d.manual, [stepKey]: true } })
```

`setDs` then *replaced* the whole `manual` map with that snapshot. Tap two steps
in quick succession — or tap one while a Supabase sync re-render is in flight —
and the second handler is still holding the pre-first-tap snapshot, erasing the
first tap. Nothing "undid" it; the write was overwritten.

**(b) Realtime echo replacing local state.** The Supabase `kitchen_tracking`
subscription replaced the local row wholesale. An echo carrying a snapshot older
than what the chef had just tapped erased that tap.

**(c) The collect-from-store list** had the identical pattern in *two* places —
`ssWrite` (Event Day) and `ssWriteD1` (Prep Day). The Prep Day one was missed on
the first pass and found later during an audit.

**Fix:** `mergeDishState(prev, upd)` in `src/utils/helpers.js`. It merges the
known step maps one level deep instead of replacing them:

```js
const DISH_STEP_MAPS = ['manual','manualAt','starts','doneElapsed','stepTm','items_done'];
```

A stale snapshot is now harmless — keys it does not know about survive, and the
key it does carry still wins, so an explicit `false` from Undo still applies.
Handlers were also changed to send **only the keys that changed**.

`mergeDishState` passes **non-object values straight through**. The same store
holds `__dispatch_ready` (boolean) and `__dispatch_time` (string); spreading
those would turn them into `{}`, which is truthy — an un-dispatched function
would have read as dispatched.

Covered by tests in `src/utils/helpers.test.js`.

### 3.2 "Undo puts it straight back to Done"

Different cause from 3.1, and simpler: **Done and Undo wrote different keys.**

```js
markManual → manual[3]        = true    // numeric index
Undo       → manual["step_3"] = false   // prefixed
```

`stepDone()` checks **three shapes** for one step — `manual[si]`,
`manual["step_"+si]`, `manual[String(si)]` — because different versions wrote
different ones. Undo cleared `step_3` while `manual[3]` stayed `true`, so the
step re-marked itself on the next render.

**Fix:** `clearManual(evId, idx, si, dishInfo)` — a proper inverse of
`markManual` that clears **all three** shapes plus `manualAt`, `doneElapsed` and
`starts`. `StepRow` now takes an `onUndo` prop (mirroring `onDone`) so the parent
owns the key shape. The old `setDsFn` path remains as a fallback.

**Known limitation:** `stepDone` also returns true for `d.mesaDone && si <= 1`.
Undo on steps 0–1 will therefore appear to do nothing when D-1 prep is marked
done. This is pre-existing and may be intentional — confirm before changing.

### 3.3 Collect-from-store ticks lost on refresh

**Two causes, both had to be fixed.**

**(a) The Supabase sync skipped them.** The sync effect had:

```js
if (dishKey.startsWith("__")) return; // skip meta keys
```

But those keys hold real state:

| Key | Holds |
|---|---|
| `__sec_<catId>` | the collect-from-store list (`items_done`) |
| `__dispatch_ready` | whether a function has gone out |
| `__dispatch_time` | when it went out |

None of it was ever written to Supabase. The guard was removed — the `data`
column is JSON and holds objects, booleans and strings alike.

**(b) There was no local copy at all.** `kitchenTracking` lived only in memory and
in Supabase, unlike `transportQueue` which already mirrored to localStorage. A
failed or in-flight write meant a refresh discarded everything.

**Fix:** `kitchenTracking` is seeded from `localStorage` (`ambria_kitchen_tracking`)
in the `useState` initializer and written back on every change. The Supabase boot
load now **merges over** the local seed instead of replacing it, so unsynced work
is not clobbered; the synced ref is set to the server object so local-only keys
are detected as a diff and pushed up.

Also: the load path uses `row.data ?? {}`, not `|| {}` — a stored `false` would
otherwise become `{}`, which is truthy.

### 3.4 Blank black screen

**Three compounding problems.**

1. **Network I/O inside a React state updater.** `setKitchenTracking` ran
   `dbUpsert` inside the updater function. Updaters run during render and may run
   more than once per update, so this fired duplicate writes and put a network
   call on the render path — where a throw escapes every error boundary. Moved to
   a `useEffect` with a try/catch.
2. **`ErrorBoundary` only wrapped the active screen.** A throw in `App`'s own
   render escaped it entirely. The boundary now wraps `<App>` in `main.jsx`.
3. **`body { background: #0A0908 }`** in `index.html` — a leftover from the old
   dark theme. Any failed render therefore presented as a dead black page with no
   clue. Changed to the light shell colour.

### 3.5 Other fixes

- **Dispatch list showed blank dish names.** `byDish` is keyed *by* dish name and
  its entries carry no `name` property; the code read `dd.name` (undefined). Use
  `Object.entries(byDish)` and read the key.
- **Dispatch panel never appeared in Combined view.** The gate required
  `allDishesReady` — *every* dish of the day — while single-function view showed
  it at the first ready dish. Now both use `readyDishes > 0`, and readiness is
  judged **per function** by the button inside each card.
- **No way to sign a dish off.** The gate required the "Go Collect" timer to be
  stopped even when every ingredient was ticked, leaving no route to finish and
  nothing on screen explaining why. `secStoreDone` now also accepts "all items
  ticked" or "station has no ingredient list", and an explanatory panel appears
  when steps are done but collection is not.
- **Ingredient sections were discarded.** `getIngrForDish` emitted section rows as
  ordinary zero-quantity ingredients without the `_isSection` flag its sibling
  `getIngrForYield` sets, so every consumer filtering on `q > 0` threw them away.
  A five-part golgappa recipe read as one flat list with "Water" in it five times.
- **Three pre-existing crashes** (not introduced by this work, found by lint):
  `KitchenHub` not imported in `DeptView.jsx`; `setAttStep` called in
  `StaffView.jsx` but the state had been removed in an earlier refactor;
  `SectionHeader` not imported in `StaffView.jsx`. All three took down a whole
  screen.

---

## 4. Features added

### 4.1 Dispatch load list

Dispatch cards state **what** goes on the van and **how much** of each.

The yield captured at sign-off previously went only to Supabase
(`ingredient_usage_log`) and could not be read back on screen. It now also
persists on the dish as `madeQty` / `madeUnit`, threaded back through
`onBeforeDishDone`'s `onConfirm(extra)`.

Quantity is ranked, and the UI is honest about which it is showing:

| Shown | Source |
|---|---|
| `8.5 kg` (brand green, bold) | weighed by the chef at sign-off |
| `~6.2 kg` (muted, tilde) | derived from the recipe's `base_yield`, scaled to pax |
| `—` (faint) | neither available |

Never print a per-dish pax count as a quantity — it repeats the same number down
the whole list and says nothing about what to load. Quantified dishes sort first.

### 4.2 Send to transport

When a station's ingredients are all collected, a **Send to transport** button
appears beside "Go Collect". It opens a **matrix**: guests across the top,
dishes down the side, an editable quantity in each cell.

Design decisions worth keeping:

- **Dishes, not ingredients.** What goes on the van is cooked food.
- **Grouped by function.** A transport row carries a guest, venue and pax.
  Sending a Combined batch as one nameless lot lost the very thing the driver
  needs. Each filled cell becomes one queue row with *its own* function's details.
- **The quantity is the selection.** No separate checkbox — a blank or zero cell
  is simply not sent. A tick plus a number can disagree with each other; one
  control cannot. The Send count is derived with `useMemo` so the count, the
  disabled state and the queued rows can never drift apart.
- **Cells rebalance.** Typing into one cell adjusts the others so the row still
  totals what was cooked — the remainder for two functions, split by pax for
  three or more, with the last cell absorbing the rounding. Skipped when the
  batch size is unknown, or when a field is *cleared* (clearing is how you remove
  a function, not a cue to reshuffle).
- **A `Made` column** shows the total batch with a live `N left` / `N over`
  counter — the number the chef is actually working against.
- **Uncooked dishes are listed but disabled**, so the station reads complete but
  raw food cannot be dispatched.

Rows are pushed in the shape `TransportDispatch` **already** renders — no parallel
data structure:

```js
{ id, dishName, event, pax, venue, eventDate, preparedBy, markedAt, status:"Ready", fromVenue, station }
```

`dishName` carries the quantity (`"Bruschetta — 8.4 kg"`) because that is the
field the transport screen shows as the row title.

### 4.2b When "Send to transport" appears

Gated on `secAllDone` — **every** dish in the station cooked. A station travels
as one lot, so a partial load is not offered.

Two earlier gates were wrong and should not come back:

- `secStoreAll` (every ingredient ticked off the store list) put the button at
  the wrong end of the workflow entirely — collecting raw material is the stage
  *before* cooking, so it was offering to load uncooked ingredients onto the van.
  The two stages are tracked separately; see the note above `secPct`.
- `secReady > 0` (first dish ready) invited half-empty loads.

### 4.3 Toasts vs modals

`KToast` was added. The rule:

> A dialog that **asks a question** stays a `KModal`. A dialog that only
> **reports a result** (its one button says "Done") becomes a toast.

Implemented by branching on whether `onConfirm` exists, so every existing call
site was routed correctly **without being touched**.

`KToast` holds `onClose` in a ref and keys its timer on the message content.
Depending on `onClose` directly meant the effect re-ran on every render — and
this screen re-renders every second to drive step timers — so the toast never
survived long enough to dismiss itself.

---

### 4.4 "Done" on a collect run ticks the whole list

`Done` on a Collect-from-store card used to write only `{ end: Date.now() }`. The
run was over but the list underneath still read *"0 of 26 collected — 0%"*, which
also made the station row above it report `0/26 collected` next to a cooked-dish
bar at 0% — two separate stages both looking stalled. It now writes
`{ end, items_done: markAllCollected(agg.items) }`, on **both** Event Day
(`EventDayTab.jsx`) and Prep Day (`KitchenHub.jsx`). `mergeDishState` merges the
delta, so rows ticked by hand beforehand stay ticked.

The key rule for `items_done` lived as **four copy-pasted inline copies**. One
drifting copy would have silently orphaned every tick on a screen. It is now a
single `storeItemKey()` in `utils/helpers.js`, used everywhere, with tests
covering the case-insensitivity and the kg↔gm family rule.

---

## 5. Section-tablet shell

The `section_tablet` role has its own shell (an early return in `App.jsx`). It
was running older styling and looked like a different product. It now matches the
admin shell: same `K.sbWidth`, same logo and artwork, same collapse control
pattern, same brand plate, same user chip and sign-out menu, same content padding
and scroll fade.

Two behaviour changes worth remembering:

- **The chrome no longer tints per station.** It used to take its colour from the
  tablet's first assigned category, so two tablets looked like two apps. Category
  colour now appears only where it denotes data — station rows, dish cards.
- **Navigating no longer closes the sidebar**, and the sidebar **starts open**.
  Both were holdovers from when it was a full-screen overlay with no collapse
  control of its own.

---

## 5b. Fixed page chrome — why the tab strip is NOT sticky

The page header plate and the Kitchen Hub tab strip must stay put while only the
content below them moves. Five attempts to do this with `position: sticky` on the
strip were all rejected, and the reason is geometric, not cosmetic: **a pinned
card narrower than the content column always lets the page slide past in the
margins beside it.** Hiding that needs either an opaque band behind the card or a
full-bleed bar — both were explicitly rejected, as was the bare overlap.

The working shape has no trade-off, because nothing scrolls behind the strip at
all:

- `KTabs` (`KitchenUI.jsx`) does **no positioning**. It is a plain strip with a
  bottom margin. Do not reintroduce a `sticky` prop.
- `KitchenHub`'s root is `display:flex; flexDirection:column; height:100%`. The
  banners and the tab strip are fixed children of that column; **everything below
  the strip lives in its own `flex:1; minHeight:0; overflowY:auto` box.** The
  shell's outer scroller therefore never scrolls on this screen.
- `height:100%` resolves because the shell's content box is a flex item with
  `flex:1; minHeight:0` (a definite height). Where it is not — `DeptView`'s ODC
  embed — it falls back to `auto` and the page scrolls as one, the old behaviour.
- **That scroll box carries `borderRadius: K.rXl`.** Cards scrolling out at its
  top edge are clipped by it, and a square clip reads as a hard white bar across
  the page. Radius is safe to add; mask and filter are not (see next point).
- **No `mask-image` or `filter` on that scroll box.** Either would make it the
  containing block for the `position: fixed` modals nested inside it and trap
  them inside the scroll area. This is why there is no top fade any more; the
  dead `topFade` / `onContentScroll` state in `App.jsx` was removed with it.

Same rule for the header plate: it sits **outside** the scroll container in both
shells. If a header element starts scrolling away, check that it has not been
moved back inside the `overflowY:auto` div.

**Do not cap the column width.** The header plate and the content below it must
be exactly the same width — both are `padding: "10px 32px 0"` / `"18px 32px
32px"` with no `max-width`, in both shells. Two attempts at a `MAX_COL` cap were
rejected: capping everything left dead margins down both sides of the page, and
capping the plate alone made it visibly narrower than the tab strip under it.
If the long gap between the title and the status chips needs closing, change the
plate's internal layout, not its width.

---

## 6. Testing

Vitest is configured. Scripts: `npm test`, `npm run test:watch`, `npm run test:ui`.

17 tests in two files, each written against a specific defect:

- `src/utils/helpers.test.js` — `mergeDishState`. The important cases are the
  stale-snapshot scenario, the stale realtime echo, explicit `false` from Undo
  still applying, and non-object values passing through.
- `src/data/recipeData.test.js` — ingredient section handling. Note the fixture
  must be registered in `RECIPE_DB.cats` / `RECIPE_DB.recipes`, **not** in
  `RECIPE_INGREDIENTS`, or `findRecipeForDish` will not resolve it and the legacy
  path returns a raw object instead of a list.

**Run the suite after touching `mergeDishState` or the recipe helpers.**

---

## 7. Open items

| Item | Detail |
|---|---|
| **Dish Map modal is unreachable** | Its only entry point (a toolbar button) was removed on request. ~270 lines sit behind `showDishMap`, which can no longer be set true. Delete it or add a new entry point. |
| **~54 mojibake `?` characters** | In `KitchenHub.jsx` — the SOP editor and Prep Day step rows. Arrows, checkmarks and similar glyphs were mangled to literal `?` at some point. Only the screens raised during the session were corrected. Prefer `<Icon>` over unicode glyphs when fixing. |
| **~135 `alert()` / `confirm()` calls** | Concentrated in `MenuPackagesView`, `DishSectionsEditor`, `DishLibrary`, `DishMappingModal`. Convert to `KModal` / `KToast` per the rule in 4.3. |
| **`kitchenTracking` localStorage has no prune** | It grows every day. On quota exhaustion the write fails silently (it is caught) and persistence quietly stops. `transportQueue` already prunes by date; this should too. |
| **`mesaDone` forces steps 0–1 done** | See 3.2. Confirm whether intended before changing. |
