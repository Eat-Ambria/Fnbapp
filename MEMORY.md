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

**Fix:** `kitchenTracking` is seeded from `localStorage` (`ambria_kt_state_v2`)
in the `useState` initializer and written back on every change. The Supabase boot
load now **merges over** the local seed instead of replacing it, so unsynced work
is not clobbered.

**Correction (2026-11-16): the line above about "local-only keys are detected as
a diff and pushed up" was never actually true, and is NOT what fixes a failed
sync — see the next section for what actually recovers a failed tick, and why
re-deriving "pushed up" from `ktSyncedRef` is the wrong place to fix it at all.**

Also: the load path uses `row.data ?? {}`, not `|| {}` — a stored `false` would
otherwise become `{}`, which is truthy.

### 3.3b A failed kitchen_tracking write (session expired mid-shift) was silently lost forever (fixed 2026-11-16)

`ktSyncedRef` (the "what has this tablet already confirmed as synced" baseline
the sync effect diffs against) is seeded `useRef(kitchenTracking)` — i.e. to
whatever `kitchenTracking` already is, which itself comes straight from
`localStorage` at mount. The sync effect ALSO sets `ktSyncedRef.current = next`
synchronously, before the `kt_set_paths` RPC it's about to fire has even been
sent, let alone confirmed. **Both of these are correct and must stay as they
are** — an Opus-drafted plan initially proposed changing them (seed to `{}`,
or have the boot-load merge only mark server-confirmed keys as synced) and an
adversarial-style investigation during planning found that would make things
WORSE, not better: every key restored from localStorage (weeks of tick
history, since this table is never pruned) would get re-sent with a FRESH
`Date.now()` as its write timestamp on every single page load forever, and
since `kt_set_paths` applies each path only if the incoming timestamp is `>=`
the server's, a stale locally-cached value with a fresh timestamp would beat
and silently revert a genuinely newer write from another tablet. This was
already confirmed as a real production incident once before (a tablet idle
since 6pm, reopened the next morning, overwrote another tablet's 11pm work) —
do not reintroduce it by "fixing" the seeding or the boot merge.

**The real bug was narrower**: `dbRpc` (`src/lib/db.js`) classifies any error
carrying a `.code` as "reached the server, not retryable" and throws instead
of queuing it — correct for a real constraint/payload error, but wrong for
exactly one class: an expired or lapsed-to-anon session (`PGRST301`/`302`/`303`,
or `42501` under this app's RLS), which IS recoverable, just not by retrying
immediately — it needs the user to log in again first. The sync effect's own
`.catch` had nowhere durable to put a tick that failed only for this reason,
so it just logged+alerted once per session and the tick was gone the moment
the tab reloaded (since `ktSyncedRef` was already marked past it, correctly,
per the explanation above — nothing was differentiating "this specific write
never reached the server" from "this is just what we have locally").

**Fix**: `isSessionAuthError()` (`src/utils/helpers.js`) classifies this one
error class; the sync effect's `.catch` (`src/App.jsx`) now enqueues the
EXACT original RPC call (same `p_ts`/`p_client_id` — never regenerated) into
the existing offline-write queue (`src/lib/offlineQueue.js`) when it fires,
instead of just logging it. **The queue is the ONLY retry path for this
tick — not the sync effect, during this session or after a reload.** The
effect sets `ktSyncedRef.current = next` at its own top, synchronously,
BEFORE the RPC is even sent — so by the time `.catch` runs, this exact tick
already reads as "synced" to every later diff, and the sync effect will
never see it as changed again on its own (confirmed by adversarial review —
an earlier draft of this note wrongly claimed the effect would "pick it up
and re-attempt" too; it does not, and never will unless that seeding/timing
is also changed, which §3.3b's first paragraph explains is NOT safe to do).
The queued entry is the sole mechanism that survives both the rest of this
session and a reload.
- **A second bug was required to make this safe**: `replayQueue` deletes any
  queued entry whose replay fails with a `.code`-bearing error (correct for a
  genuinely permanent failure). Without a guard, replaying a session-expired
  tick's queue entry WHILE STILL LOGGED OUT (e.g. the automatic 2-minute ping
  firing before a human re-logs-in) would get back `42501` from RLS — which
  has a `.code` — and the entry would be deleted forever on that very first
  attempt. `replayQueue` now checks `supabase.auth.getSession()` first and
  returns immediately if there's no session, before ever touching the queue.
- `offlineQueue.js`'s own `isOfflineError` (now exported) deliberately
  diverges from `db.js`'s copy of the same name: it treats `PGRST301/302/303`
  as retryable (so a queued entry survives a replay attempt against an
  already-expired-but-not-yet-refreshed token instead of being dropped), but
  NOT `42501` (a real RLS denial with a valid session IS permanent and must
  not block the queue forever). `db.js`'s copy governs whether a FRESH write
  gets queued at all and was left unchanged on purpose — changing it would
  make every table's writes silently queue forever on any session hiccup,
  a much broader behavior change than this fix's actual scope.

**Found but out of scope for this fix (low severity, none block correctness or cause data loss):**
- Replay only runs on the 2-minute `ping()` interval or an `online` event — nothing triggers it immediately on a `SIGNED_IN` auth event, so a queued tick can take up to 2 minutes to actually leave the device after logging back in, even though the alert says to watch the counter go to 0.
- ~~`replayQueue` discards the RPC result...~~ **Fixed 2026-11-16, see §3.3c below** — `replayQueue` now surfaces every replayed call's own return value, and a replayed `kt_set_paths` call is reconciled the same way a live one already is.
- `isSessionAuthError` also fires for a logged-in but DEACTIVATED staff account (`is_active_staff()` RLS check also returns `42501`) — bounded (queued once, dropped as permanently-failing on the next replay, no loop), but the alert text wrongly says "session expired" for that case.
- A device with a behind clock can make `getSession()` think a token is still valid when the server has already expired it — the IndexedDB replay loop then stops at the queue head every attempt instead of dropping it. Blocking is strictly better than the pre-fix behavior (silent permanent loss), just not optimal.

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
| **`KitchenHub.jsx`'s `markReady`/ready-modal path is dead** | Nothing calls `markReady` anywhere in `src/` — `readyModal` can never be set, so the whole modal + its `setDs(...,{ready:true,...},readyModal)` call (line ~2711) never runs. Found 2026-11-22. `EventDayTab.jsx`'s own sign-off button is the one live `ready`-writer. Either wire a real entry point to this modal or delete the dead path. |
| **Per-dish pickup tracking (`dispatchReady`/`dispatchAt`) has no writer** | `DeptView.jsx`'s Kitchen Pickup/ODC tabs read a per-DISH `dispatchReady`/`dispatchAt` (distinct from the real, written whole-event `__dispatch_ready`) that nothing anywhere ever sets — confirmed via grep, reads only. Found 2026-11-22 while fixing the `ready`-key bug (see that section above). A human should decide: build a real "mark this dish picked up" control, or remove the "🚛 Picked Up" badge that can currently only ever be reached via the whole-event flag folded in as a stand-in. |
| **`kitchenTracking` localStorage has no prune** | It grows every day. On quota exhaustion the write fails silently (it is caught) and persistence quietly stops. `transportQueue` already prunes by date; this should too. |
| **`ProposalsView.jsx`'s `doConvertToBooking` builds its own `dishNameToPkgDept`** | (~line 290-305) Skips subsection dishes and ignores `menu_section_overrides` entirely when filtering the newly-converted event's initial Kitchen menu — a proposal dish tagged to a non-kitchen subsection/section could land in the Kitchen menu at conversion time. Found during item 10's adversarial review (2026-11-17), not caused by it. Unknown whether boot-time `syncAllKitchenMenuMirrors` later corrects it — needs its own investigation. |
| **`mesaDone` forces steps 0–1 done** | See 3.2. Confirm whether intended before changing. |

## Planning/Closing/Analytics layout pass
- Planning, Closing and Analytics share the grid classes .kh-an / .kh-an-row / .kh-an-cal / .kh-an-rail / .kh-an-below (theme.js). Cards under the calendar go in .kh-an-below so they match its width; do not give the rail a flex-basis (it is a column on narrow panels).
- Trap: src/components/KitchenHub.jsx has CRLF line endings. Node/sed scripts that match multi-line strings need 
; the Edit tool handles it.

## src/data/translations.js — HI dict is one flat, non-namespaced object
- `T(key, lang)` does a plain `HI[key]` lookup with no scoping by feature/screen. If the exact same English string is used as a key in two unrelated places in the file (e.g. a Dish Library section name and a Recipe SOPs category name both happening to be "Indian Main Course"), whichever literal `"key":"value"` pair appears LATER in the file wins for both call sites — a JS object literal silently drops the earlier duplicate, no warning, no error.
- Trap this actually caused (2026-11-16, Print Menu Hindi expansion): a ~160-entry block of dish_catalogue_sections/venue/session/package-tier Hindi translations was added, but two of those keys ("Indian Main Course", "Indian Desserts") already existed later in the file as an untranslated identity placeholder for Recipe SOPs' category list (`RECIPE_DB.cats` in recipeData.js) — that later entry was winning and silently keeping the Print Menu's section headers in English despite a correct translation existing earlier in the file. Fixed by removing the two colliding keys from the Recipe SOPs identity block (same words, same correct Hindi applies to both, so no regression there).
- Before adding a new key to HI, grep the whole file for that exact string first. Don't assume a key is "yours" just because you're only editing one feature.

## EventMenuBuilderView.jsx — package section id vs. catalogue section id are two different id spaces
- A package section's own `id` (`MENU_PACKAGE_SECTIONS[pkg][i].id`, `sec_…`/`sub_…` — `genSecId()`/`genSubId()` in MenuPackagesView.jsx) can NEVER equal a `dish_catalogue_sections.id`. A dish tag (`sectionOverrides[dishName]` / `events.menu_section_overrides`) is always a catalogue id, never a package-local one.
- Trap this actually caused (2026-11-16): the FP print view's "ad hoc new section" check (`newSectionsByDept` in EventMenuBuilderView.jsx) compared a dish's catalogue-id tag against a Set of package-local ids (`pkgSectionIds`). That comparison could never match, so EVERY catalogue-tagged, non-baseline dish printed as "Kitchen (New <section>)" on the FP — even when added to a long-established catalogue section that was genuinely linked to the current package. Fixed by resolving each package section's real catalogue link (`sec.catalogue_section_id` / a subsection's own, or an exact name match for an unlinked top-level section only) into `pkgCatalogueSectionIds`, expanded to that seed's catalogue DESCENDANTS only.
- Two widenings were tried and DISPROVEN by an adversarial review against real production package data before landing on "descendants only": (1) also including the seed's catalogue ANCESTORS — wrong, because the builder's own "is this dish already part of the package" check (`useMenuItemGrouping.js`'s override-matching pass, ~line 748-766, used to decide whether a tagged dish joins an existing package group or becomes its own ad-hoc 📚 pill) has no such fallback; a dish tagged to the bare parent of a linked child still shows as its own ad-hoc pill on screen. (2) widening to the seed's whole TOP-LEVEL ancestor subtree (reasoning that `pillTree`/`catalogueTree.resolveTop` visually merge sibling sections into one display pill) — also wrong: that merge is purely a DISPLAY clustering of separate child pills, not a "same group" determination; each sibling still renders as its own ad-hoc pill inside the merged visual container. Against real packages (e.g. Double Magnum Veg 2027 linking "Pre Dining Live"'s Dimsum/Galouti children but not its Sushi Counter sibling), this widening would have silently suppressed genuine "(New X)" labels for a real ad-hoc addition.
- If this needs touching again: the authoritative "is this tag already part of the package" answer lives in `useMenuItemGrouping.js`'s override pass (~line 748-766) and `resolveOwnDishes` (~line 581-594) — verify any change against THAT code, not against the visual pill grouping (`pillTree`/`catalogueTree`), which answers a different question (how many tabs to show), not this one.

## A new custom dish never got dishes_master.section_id written (fixed 2026-11-16)
- No "add a new dish" path anywhere persisted the shared `dishes_master.section_id` — only a per-event/per-proposal override (`menu_section_overrides`) was saved. Load-bearing fallout: Dish Library's Sections tab showed it "Unassigned" forever, add-on pricing (`deptAddonTotal`, reads `section_id` only, ignores overrides) silently charged ₹0 for it, and it fell to Extras/`DEFAULT_DEPT` on every subsequent event/package that didn't re-pick a section. Found by a Fable audit, this session.
- `dishes_master.section_id` is a real FK to `dish_catalogue_sections(id)` (confirmed via `information_schema`) — a wrong id doesn't silently corrupt the column, it makes the WHOLE upsert fail. `createCustomDishInLibrary` (recipeData.js) now retries once without `section_id` on an FK-violation code (23503/22P02) so the dish is still created rather than lost, and never overwrites an EXISTING dish's section (`isNewLocally = !DISH_MASTER[name]` guard — safe even if that cache is stale, since the upsert itself uses `ignoreDuplicates: true`/ON CONFLICT DO NOTHING).
- The id a user picks in the Add-dish modal is NOT always a catalogue id — it can be a package-local section id, a package subsection id, an `<id>__unplaced` id, a SOP-category id, or `'__extras__'`. `src/lib/catalogueSection.js`'s `resolveOverrideToCatalogueSectionId` is the one shared translation to a verified real catalogue id (or null) — it MUST stay identical to `EventMenuBuilderView.jsx`'s `effectiveSectionIdByDish` override-resolution branch (what already decides a dish's displayed/printed section everywhere else). Neither one resolves a NESTED package subsection (one living in `pkgSection.subsections[]`, not flattened to the top level) — a known, consistent gap in all three add-dish entry points, not something to silently "fix" in only one of them.
- Three real, independent entry points needed this (there is no single choke point): `EventMenuBuilderView.jsx`'s `addCustomDish` (Booked Functions), `MenuBuilderView.jsx`'s own `addCustomDish` (Proposals), and `MenuEditor.jsx`'s `confirmCustom` (Build Menu) — the last one had its OWN independent inline duplicate of the three dishes_master/dish_categories/recipes writes, not calling the shared helper at all, and has no catalogue-sections list loaded (unlike the other two), so it verifies just its one candidate id with a targeted single-row query instead.
- A brand-new dish's Kitchen-mirror check (`isKitchenTrackedDish`/`mirrorKitchenMenu` in `EventMenuBuilderView.jsx`) can't run synchronously inside the same handler that just created it — `allDishesByName` predates the `dishLibBump` re-render that makes the new dish resolvable at all, and `effectiveDeptForDish` predates the `sectionOverrides` tag just saved. Deferred via a `pendingKitchenMirror` state + `useEffect` (fresh object each add, so it re-fires every time) — same self-heal shape as the existing V79 effect, just per-add instead of per-load.

## getAllDishes's hasRecipe was stricter than findRecipeForDish (fixed 2026-11-16)
- `getAllDishes()` (recipeData.js) computed `hasRecipe` as a STRICT, case/whitespace-SENSITIVE exact-string match — stricter than `findRecipeForDish`, the function actually used everywhere a recipe's steps get displayed, which also accepts a case/whitespace-insensitive exact match (its Tier 1) and a case/whitespace-insensitive `DISH_NAME_MAP` lookup (its Tier 0). `hasRecipe` gates `isKitchenTrackedDish`/`syncAllKitchenMenuMirrors`/`getEventItemsByDept` — a `false` here means the dish NEVER enters `events.menu`, so it's invisible to Kitchen Hub (Prep Day, Event Day, kitchen_tracking) with no error, and not even caught by Planning's "Unmapped" list (that list is itself built FROM `events.menu`, so a dish never mirrored in can't appear there either). A dish whose `dishes_master` name differed from its `recipes.dish_name` by case/whitespace ONLY silently vanished from Kitchen while printing fine everywhere else. Found by a Fable audit; a production-data simulation (881 dishes, 423 recipes, 262 map rows) confirmed exactly 26 real dishes were affected, all genuine correct matches.
- Fixed by adding `findRecipeForDish`'s Tier 0 (`DISH_NAME_MAP`, case/whitespace-insensitive) and Tier 1 (exact name, case/whitespace-insensitive) to `hasRecipe` too, via lookup tables built ONCE per call (not cached at module scope — `RECIPE_DB`/`DISH_NAME_MAP` are live-patched by realtime/`hydrateRecipeData`, and not per-dish either — this function iterates hundreds of dishes).
- Tier 2 (substring) and Tier 3 (normalized) were deliberately NOT added here, even though `findRecipeForDish` itself uses them for display — `findRecipeForDish`'s own comment warns Tier 2 "can false-match short names as substrings of unrelated recipes" (e.g. "Tea" ⊂ "S-tea-med Chicken Dimsum"), which is an acceptable risk for showing a plausible-if-imperfect recipe's steps but NOT for gating whether a dish enters Kitchen's live production pipeline — a false positive here would sweep a dish with no real intended recipe into Prep Day/Event Day under someone else's steps. The simulation confirmed this: Tier 2/3 would additionally "match" 115 dishes, many clearly wrong (e.g. "Mineral Water 200ml" → "Water").
- A known, deliberately-preserved quirk: a couple of real dishes have BOTH an exact-name recipe match AND an explicit `__none__` `DISH_NAME_MAP` entry — `recipeNameSet.has(name)` (the original exact check) is left unguarded by the `__none__` check on purpose, matching pre-fix behavior; changing that would be a separate, out-of-scope behavior change.
- Kitchen tracking is NOT at risk from the resulting `events.menu` reordering/insertions this fix causes on next sync — verified directly (not just assumed) that the real, live Prep Day/Event Day tick state is keyed by dish NAME (`dk(evId, dishName)` in both `KitchenHub.jsx` and `EventDayTab.jsx`), not list position. A `d_${idx}` position-keyed read pattern exists in `DeptView.jsx` (Transport & Dispatch's ready/dispatched counts), but has zero writers anywhere in the codebase — confirmed by grep — so it's permanently empty/dead, unaffected either way.

## EventMenuBuilderView.jsx — a dish-tag change can flip kitchen-tracked status for dishes already on the menu, with nothing to re-mirror it (fixed 2026-11-16)
- `isKitchenTrackedDish` depends on `effectiveDeptForDish`, which reads `sectionOverrides` — so ANY action that retags a dish's section can change whether it belongs in Kitchen's `events.menu` mirror, not just a brand-new add (`addCustomDish`, already fixed earlier this session with a deferred `pendingKitchenMirror` effect). Three more call sites had the same gap, found by re-checking every `sectionOverrides` writer in this file after that first fix, not just the one originally reported:
  - `addExistingDish` — identical synchronous-stale-check bug as the original `addCustomDish` bug (ran the kitchen check before the tag it just saved had taken effect).
  - `removeAdHocSection` — clears a tag from potentially MANY dishes at once (every dish pointing at the removed ad-hoc section or its subsections) and never re-mirrored at all.
  - `addSectionFromLibrary` — its own comment says "nothing is auto-picked," which is only true for SELECTION; it still unconditionally retags `sectionOverrides` for every active dish in the chosen catalogue section via `menuItemOps.js`'s own `.in('section_id', ids)` query, with NO exclusion for a dish already selected from earlier for an unrelated reason. Confirmed via direct read of `menuItemOps.addSectionFromLibrary` — not assumed from the function's own "nothing auto-picked" comment, which doesn't cover this case.
- `pendingKitchenMirror`'s shape was widened from always `{ name }` (single dish, gates the re-mirror on whether THAT dish is itself kitchen-tracked — skips a pointless write for e.g. a plain beverage add) to also accept `{ all: true }` (always re-mirrors, used by the three bulk/multi-dish cases above, since there's no single dish to gate on).
- `addSectionFromLibrary` was NOT the only remaining instance checked — `toggleDish`'s own existing mirror call was confirmed fine (the override it reads was already saved by a PRIOR, separate action, not concurrently in the same handler, so no staleness). Don't assume every `sectionOverrides` writer needs this pattern without checking whether it's genuinely racing its own tag write.

## kitchen_tracking has THREE dish_key shapes, and a dish rename has to know all three (fixed 2026-11-16)
- `kitchen_tracking` rows are keyed `(ev_id, dish_key)` — a real PRIMARY KEY, confirmed via `pg_indexes` (`information_schema.table_constraints` came back empty on this table for some reason — don't trust that view here, use `pg_indexes`/`pg_trigger` instead; confirmed zero triggers too). Three `dish_key` shapes exist, built by the kitchen screens themselves, not stored as a schema-enforced format:
  - **Per-event** (live, rename-sensitive): `ev_id = <eventId>`, `dish_key = <eventId> + "|" + <dishName>` — `dk()` in `EventDayTab.jsx`/`KitchenHub.jsx`.
  - **Combined-day bucket** (live, rename-sensitive): `ev_id = "__combined_" + YYYY-MM-DD`, `dish_key = "dish|" + <dishName>` — `ck()` in the same two files. Every per-event write is ALSO mirrored here.
  - **Legacy, position-based** (dead for rename purposes): `dish_key = <eventId> + "|" + <index>` — name-independent, `dkLegacy()`. This is why a dish-rename skips any source/target name that's purely digits (`/^\d+$/`) — a digit-named dish's key would be indistinguishable from this legacy shape.
- `DishLibrary.jsx`'s rename/merge (`applyRenameToBookings`) used to rename a dish across `event_items`/`proposal_items`/`events.menu` but left `events.menu_section_overrides`, `proposals.menu_section_overrides`, `events.outsourced_dishes`, AND every `kitchen_tracking` row for that dish permanently orphaned under the old name — including, for kitchen_tracking, any chef's real recorded prep/done progress, now unreachable since the event's menu shows a name with no tracking row at all. Fixed by extending `applyRenameToBookings` with three new steps using a new pure-helper module `src/lib/dishRenameOps.js` (kept separate so the conflict-decision logic is unit-testable without Supabase).
- **The conflict rule, everywhere in this fix**: when BOTH the source and target names already have independent state for the same event (two different section tags, two different kitchen_tracking rows), NEVER auto-merge or auto-pick a winner — leave both alone and record a warning for manual review. Exception: when only ONE side has state and the OTHER has none, that one wins (no real ambiguity). This mirrors `applyRenameToBookings`'s own pre-existing precedent for `event_items`/`proposal_items` (a parent that already has the target dish selected keeps that row, the source duplicate is just dropped) and this repo's LMS-sync "never guess on ambiguity" rule (`LMS_SYNC_SAFETY_PATTERNS.md`).
- **kitchen_tracking moves are INSERT-new-row + guarded-DELETE-old-row, NEVER an in-place `UPDATE ... SET dish_key = ...`.** The realtime handler already deployed on every tablet (`App.jsx`) only knows how to apply an INSERT/UPDATE under the row's EXISTING key or a DELETE of it — an UPDATE that silently changes the primary key would apply the row under its new key everywhere but never remove the stale entry at the old key on an already-open tablet, leaving a ghost. INSERT+DELETE is already handled correctly by that same existing code, so no tablet needs a new app bundle for this to work right.
- **Never copy `client_id` from the source row into the new target-keyed row.** The tablet that originally wrote the source row treats a realtime echo bearing its OWN `client_id` as itself and skips applying it — so copying the real `client_id` would make that exact tablet silently fail to see its own dish's progress reappear under the new name until a reload. Use a distinct sentinel (`'dish-merge'`).
- **The guarded delete matters.** `kt_set_paths` (the RPC every real tap goes through) stamps `client_write_ts` on every change it applies. Deleting the source row conditioned on `client_write_ts` still matching what was just read means a chef's tap landing in the exact window between the read and the delete makes the delete silently match zero rows (reported as `kt-source-changed`, both copies kept) instead of racing away a real tap.
- **Step order inside `applyRenameToBookings` matters and was corrected by adversarial review**: kitchen_tracking (Step C) must run as soon as possible after `events.menu` is rewritten — NOT after the unrelated `menu_section_overrides`/`outsourced_dishes` scans (Steps A/B), which only widen the window where a stale-menu tablet could tap under the old name while Kitchen already shows the new one. A does-this-affect-Kitchen check is the deciding factor for where a new step belongs in this sequence, not just "does it also touch dish names."
- Running an actual merge/rename should still happen outside active kitchen service — not because the code can corrupt anything (every move is idempotent and safe to re-run; a genuine conflict is reported, never silently resolved), but because many sequential per-row kitchen_tracking moves each send their own realtime INSERT+DELETE to every open tablet, and a tablet with stale menu state tapping mid-merge just produces an orphaned row and a review warning rather than lost data.

## kt_set_paths clamps a client's clock to server time + 10s (fixed 2026-11-16, DB migration — not deployed via git push)
- Every per-path write in `kt_set_paths` was guarded by `p_ts >= key_ts[path]`, where `p_ts` is the CLIENT's own `Date.now()` with NO server-side correction at all. A tablet whose clock ran fast (confirmed: minutes, not just seconds — this is a real device-misconfiguration failure mode, not theoretical) could stamp a path with a timestamp in the future and permanently out-rank every later, correctly-timed write from another tablet to that exact path — the losing tablet's RPC still returned success, and the existing sync-effect reconciliation (added earlier this session) just silently reverted its tap with no error shown anywhere.
- **Fix** (`supabase/migrations/20261116000000_kt_set_paths_clamp_client_ts.sql`): the timestamp actually compared AND stored per path is `eff_ts := least(p_ts, floor(extract(epoch from clock_timestamp())*1000)::bigint + 10000)`, computed once per call, right after the row lock (`clock_timestamp()`, not `now()`, which is frozen at transaction start). A fast clock can now bank at most 10 seconds of unearned advantage, and since `key_ts` only ever stores `eff_ts`, the skew cannot persist forward — the next correctly-timed write from anyone else wins once real time passes that 10s window.
- **`client_write_ts` deliberately keeps the RAW, unclamped `p_ts`** — it plays no ordering role anywhere (the dish-rename fix's guarded-delete only ever tests it for equality, never for ordering) and keeping it raw preserves after-the-fact evidence of a skewed device: compare a row's `client_write_ts` against its own `key_ts` — a large gap means that tablet's clock is wrong.
- **This does NOT disturb the offline-replay/session-expiry-queue guarantee** (see the section above and "A kitchen_tracking write lost to session expiry") for a CORRECTLY-clocked device: a replayed tap's `p_ts` is always in the past by replay time, so `least()` returns it completely unchanged, however long the replay was delayed. The one case this does NOT fully cover: a queued replay from a device that was ALSO clock-skewed — its `p_ts` can still be in the future at replay time and gets clamped to roughly replay-time + 10s, which could still beat a genuinely newer write made in the meantime. This is strictly better than before (previously unbounded), just not the same "exactly as before" guarantee a correctly-clocked replay gets — don't claim otherwise in a future comment without re-checking this.
- **Known, accepted limits, not fixed here:** a SLOW-clock tablet is still unaffected by this fix (its genuinely-real taps can still lose to an already-written later timestamp from a correctly-clocked tablet) — this can't be fixed by clamping from below without breaking legitimate old offline replays, which also look like "an old p_ts." A device running more than 10s fast also gets its own back-to-back same-path RPCs (the sync effect doesn't wait for one to finish before sending the next) ordered by arrival-at-server instead of by its own tap order, which could rarely leave a quick tick-then-undo on the same path in the wrong final state — a minor trade-off against the much larger original bug, not a regression.
- **Deployment is NOT part of the normal `git push` flow for this repo** — confirmed `.github/workflows/deploy.yml` only runs `npm ci`/`npm run build`/the GitHub Pages upload, nothing touches the database. This migration was applied directly via `npx supabase db query --remote -f <file> --yes` against the live project, with explicit user sign-off first, and verified with a self-rolling-back `DO $$ ... RAISE EXCEPTION 'ZZTEST PASS...' $$` test block (everything inside it rolls back automatically, so no `ZZTEST-` cleanup was needed) run both against a `pg_temp` copy of the new body AND against the real function after deploying, plus a read-only check that zero existing `key_ts` values were already stored in the future (there weren't, so no one-off data cleanup was needed either).
- **Do NOT run `supabase db push` in this repo** — confirmed the remote `supabase_migrations.schema_migrations` tracking table is stuck at an old migration (`20261024000000`); roughly 29 later migration files, including the original `kt_set_paths` migration itself, were all applied by hand and never recorded there. Running `db push` would try to re-apply all of them. Reconciling that history is separate housekeeping, not something to do incidentally while shipping an unrelated fix.

## §3.3c — a replayed kt_set_paths tick never reconciled its own server response (fixed 2026-11-16, client-only, no DB change)
- The LIVE write path already reconciles a `kt_set_paths` call's own returned `{data, key_ts}` back into state — because the RPC can REJECT one or more paths in a patch (a genuinely newer write already landed for that exact path server-side), and a rejected path runs no UPDATE and triggers NO realtime broadcast, so that response is the only signal a tablet ever gets that its own optimistic guess for that path is wrong.
- `offlineQueue.js`'s `replayQueue` never did this for a REPLAYED call — it called `supabase.rpc(entry.fn, entry.args)` and only checked `{error}`, discarding `data` entirely. A tick made offline (or queued via the session-expiry path, §3.3b) that LOST to a newer write while the device was offline/logged-out still had its queue entry correctly deleted as "replayed successfully" (the RPC call itself didn't error, it just silently rejected that one path) — but the tablet's local state kept showing its own stale, now-wrong value for that path, with nothing to correct it short of a reload or an unrelated future write to the same path.
- **Fix, no duplicated logic**: the live path's own reconciliation was extracted verbatim into `ktReconcileOwnWrite(evId, dishKey, patchPaths, result)` inside `App.jsx` (shared by both callers — a fix applied to only one would silently drift from the other, the exact class of bug this codebase has been bitten by before). `replayQueue` now returns `{ replayed, results, pending }` instead of a bare count — `results` is one `{entry, data}` per successfully-replayed entry (ANY action/table, kept fully generic — `data` is `null` for a plain table write, since none of those call `.select()`), `pending` is every entry still left in the queue after this run. A new pure, unit-tested helper (`ktReplayReconcileJobs` in `helpers.js`) picks out the `kt_set_paths` entries from `results` and turns each into a reconciliation job for `App.jsx`'s `ping()` to run through `ktReconcileOwnWrite`.
- **The one replay-only difference from the live path**: a path that a STILL-PENDING entry (one that didn't replay this run, still queued) will write again is skipped — that later entry owns the path and will reconcile itself once it replays. Without this, a replay run that stops partway through the queue (e.g. hits an offline/retryable entry and `break`s) would revert the screen from the user's LATEST still-queued tap back to an earlier already-replayed one, for as long as the device stays offline.
- **A rejected "skip if the local value already differs from this write" alternative**: after a reload, the boot-load's server snapshot can legitimately differ from what a since-accepted replayed write sent, if the replay's own realtime echo hasn't arrived yet — that guard would wrongly leave the screen stuck on the pre-replay boot snapshot in that window. The pending-path-skip approach above has no such failure mode; don't reintroduce the local-value-diff guard without re-checking this.
- **No staleness risk from replay timing**: `kt_set_paths` always reads the row fresh (under its own row lock) at the END of the function, so `result.key_ts` reflects the row as of THIS call's own commit, not anything captured earlier — the exact same per-path `ts < knownTs → skip` guard the live path already uses handles every arrival order (a foreign write that committed before vs. after the replay, its echo arriving before vs. after this response) correctly, with no special-casing needed for "this was queued a while ago."
- This does not change or contradict §3.3b (session-expiry queuing) or the clock-skew clamp migration — `ktSyncedRef`'s own seeding/update timing is untouched, the queue is still the only retry path for a session-auth failure, and a past `p_ts` still passes through the server's clamp unchanged on replay.

## §3.3d — a dropped realtime connection never backfilled what it missed (fixed 2026-11-16, client-only, no DB change)
- Supabase Realtime (Phoenix websocket under `postgres_changes`) does NOT replay missed events after a reconnect. A tablet whose websocket drops for any reason (backgrounded tab, flaky wifi, a laptop lid closed) and later reconnects had NO mechanism to notice anything was missed — it just silently resumed receiving NEW broadcasts, with whatever other devices wrote during the gap never arriving at all, no error, no stale-indicator, nothing short of a manual reload (which re-runs the boot-time `dbLoad('kitchen_tracking', ...)` fetch and gets everything correctly).
- **Fix has three pieces, all client-side:**
  1. `src/lib/db.js` — `kitchenTrackingWindowQuery()` is the SAME 3-day-window query `dbLoad`'s own boot fetch already used, now exported and shared so the catch-up fetch below can reuse it without the two silently drifting apart. `dbSubscribe(table, callback, onStatus)` gained an optional 3rd param passed straight to realtime-js's own `.subscribe(statusCb)` — Phoenix re-fires `'SUBSCRIBED'` on EVERY rejoin, not just the first ever connect, which is exactly the signal needed to tell "just reconnected after a drop" apart from "first ever connect." Every other existing caller is unaffected (the param is optional, `undefined` behaves exactly as before).
  2. `src/utils/helpers.js` — two new PURE, unit-tested functions carry all the actual decision logic, kept out of `App.jsx` on purpose (same reasoning as `ktReplayReconcileJobs` in §3.3c — a bug in pure, tested logic is far cheaper to catch than one buried in a `useEffect` closure). `ktCatchUpOnStatus(state, status)` is a tiny state machine (`{everSubscribed, live, gapGen}`) that returns `{next, fire, markOwed}` — `fire` is true ONLY on a `'SUBSCRIBED'` that follows at least one prior `'SUBSCRIBED'` (a genuine reconnect, not the first connect); `markOwed` is set as soon as a drop is first detected (not deferred to the reconnect) so the own-echo problem below (piece 3) is guarded from the moment the gap actually starts, not just once it ends. `ktCatchUpWaitMs(now, lastStartAt, minIntervalMs)` throttles repeated reconnects (a flapping connection re-triggering `'SUBSCRIBED'` over and over) to at most one fetch per `KT_CATCHUP_MIN_INTERVAL_MS` (15s).
  3. `src/App.jsx` — the kitchen_tracking realtime handler's own INSERT/UPDATE body (previously inline in the `dbSubscribe('kitchen_tracking', ...)` callback) was extracted VERBATIM into a new component-scope function, `ktApplyServerRow(row, opts)`, so there is exactly ONE copy of the per-path merge/strict-newer-than logic for BOTH the live realtime callback and the new catch-up fetch to call — a fix to one path could otherwise silently drift from the other, the same class of bug §3.3c's `ktReconcileOwnWrite` extraction already guards against. `onKtStatus` (passed as `dbSubscribe`'s new 3rd arg) runs every status through `ktCatchUpOnStatus` and, on `fire`, calls `ktRequestCatchUp()` → (after `ktCatchUpWaitMs`'s throttle) `ktRunCatchUp()`, which re-fetches the same 3-day window via `kitchenTrackingWindowQuery` and feeds every row through `ktApplyServerRow(row, {skipOwnEcho:false})`.
- **Why `skipOwnEcho:false` for the catch-up fetch, when the live path skips a row whose `client_id` is this tablet's own**: `client_id`/`client_write_ts` on a `kitchen_tracking` row only record that row's LAST writer — not "every path in this row was last written by this tablet." A row this tablet itself wrote moments before the gap can still carry a FOREIGN path that a different device wrote WHILE this tablet was disconnected and the row happened not to change writer again afterward. Trusting `client_id` during catch-up would silently skip exactly the data the catch-up exists to recover. The existing per-path strict-greater-than guard (`ktPathTsRef`, unchanged) is what actually decides each path correctly regardless of who wrote the row — `client_id` was never the real authority, just a shortcut that's safe on the live path (where the own-write's OWN response already reconciled every path it touched, via §3.3c's `ktReconcileOwnWrite`) and unsafe here.
- **Why the own-echo branch needed its own gate (`ktCatchUpOwedRef`)**: the live handler's own-echo branch unconditionally raised `ktPathTsRef` for every path in an echoed row, on the theory that "we already have this value, just record its timestamp." During a gap, that's no longer safe — an echo for THIS tablet's own last write to the row can still carry a FOREIGN path's key_ts that this tablet never actually received the value for. Raising `ktPathTsRef` for that path from the echo alone (without ever applying the value) would make the later catch-up fetch see that path as "not strictly newer than what's already known" and skip it FOREVER, even though the tablet never actually got the data. `ktCatchUpOwedRef` (a ref, not state — cleared from inside `ktRunCatchUp`'s own promise resolution, not synchronously) gates that raise off for exactly the window between a detected drop and a successfully-completed catch-up; `ktCatchUpOnStatus`'s `markOwed` is what sets it, as early as the drop itself (not deferred to the reconnect), and `ktRunCatchUp` clears it once its fetch's rows have all been applied.
- **Caught by adversarial review, fixed before push: a SLOW catch-up fetch could clear the owed-ref for a NEWER gap it knew nothing about.** On a flapping connection (drop → reconnect → drop again → reconnect, each bumping `gapGen`), a first catch-up fetch that happens to be slow (bad network) can still be in flight when a second drop+reconnect cycle starts its own (separately throttled) catch-up. The first fetch's `.then`/`.catch` originally cleared `ktCatchUpOwedRef` unconditionally on completion — if that completion lands AFTER the second gap has already opened, it wrongly un-gates the own-echo raise for a gap the first fetch's stale snapshot never covered, letting a foreign path's timestamp get raised (and then permanently skipped by the second, real catch-up) exactly the way this whole mechanism exists to prevent. Fixed by capturing `ktCatchUpStateRef.current.gapGen` at the START of each `ktRunCatchUp` call and only clearing the owed ref (on success OR on giving up) if the generation is still the same AND the connection is still live — otherwise a newer gap's own catch-up is left to clear it instead. Also fixed in the same pass: the failure-retry `setTimeout` now clears any previously-scheduled `ktCatchUpTimerRef` first instead of silently overwriting it (that stale timer firing later was harmless — `ktRunCatchUp` re-checks `ktDisposed`/state regardless — but was still an orphaned timer worth not leaving around).
- **Giving up, not retrying forever**: a catch-up fetch that fails (network blip right as it reconnects, etc.) retries up to `KT_CATCHUP_MAX_FAILURES` (3) times at the same throttle interval; after that it explicitly clears `ktCatchUpOwedRef` anyway and logs an error, accepting that this particular gap's data may stay missing until the NEXT genuine reconnect — leaving the ref stuck on `true` forever would block the own-echo raise for every future write this tablet ever makes, which is strictly worse than the gap it exists to protect against.
- **`ktDisposed`** (a plain closure `let`, not a ref) guards every async continuation this effect starts (the catch-up fetch's `.then`/`.catch`, its retry `setTimeout`) against firing after the effect's own cleanup has already run — set to `true` as the very first line of the cleanup, before `u5()` tears down the subscription itself, and the pending timer is explicitly cleared there too.
- Covered by ~10 new unit tests for `ktCatchUpOnStatus`/`ktCatchUpWaitMs` in `helpers.test.js` (pure functions, no mocking needed) — see "Testing" section for the current total.

## A placement tag pointing at a package SUBSECTION or "<id>__unplaced" fell through to Extras/Other (fixed 2026-11-16, client-only, no DB change)
- A per-event `sectionOverrides`/`menu_section_overrides` tag can point at any of: a real `dish_catalogue_sections` id, a package section's own id, a package SUBSECTION's own id, or an `"<id>__unplaced"` synthetic id. The resolution step that turns this into "which real catalogue section does this dish belong to" (used for FP print grouping/headings, and for writing a new custom dish's `dishes_master.section_id`) only ever looked at TOP-LEVEL package sections — a tag on a subsection, or an `__unplaced` bucket, resolved to nothing and silently printed under "Extras"/"Other" even though the builder's own Items-tab UI (`useMenuItemGrouping.js`) already showed that same dish correctly placed.
- This had THREE separate near-duplicate implementations of the same lookup, all missing subsections identically: `EventMenuBuilderView.jsx`'s `effectiveSectionIdByDish` memo, the shared `src/lib/catalogueSection.js`'s `resolveOverrideToCatalogueSectionId` (whose own header comment admitted "Package subsections are deliberately NOT resolved here... extending that is a separate decision" — this fix IS that decision), and `MenuEditor.jsx`'s own inline `pkgSections.find(s => s.id === rawSec)` (a third copy the first two investigations missed entirely, found only by re-reading every call site before planning this fix).
- **Fix, one shared implementation**: `catalogueSection.js` now exports `buildOverrideResolver(catalogueSections, pkgSections)` — builds a flattened `{id -> catalogue_section_id}` map over BOTH top-level package sections and their `subsections[]` in one pass, then returns a `resolve(rawId)` closure. `resolveOverrideToCatalogueSectionId` is now a one-line wrapper around it. `EventMenuBuilderView.jsx`'s `effectiveSectionIdByDish` was rewritten to CALL `buildOverrideResolver` instead of keeping its own separate inline copy — the "must stay identical" comment that used to be the only thing keeping the two in sync is gone because there is only one implementation left to drift. `MenuEditor.jsx`'s custom-dish flow now calls the new `packageCatalogueLinkFor(rawId, pkgSections)` (same flattening, but returns the raw unverified link — this file verifies candidates against the DB one at a time rather than holding a full catalogue list) instead of its own inline `.find()`.
- **Subsection fallback precedence**: a subsection resolves through its OWN `catalogue_section_id` link when it has one, else falls back to its PARENT top-level section's link — the SAME precedence `src/lib/eventItems.js`'s `buildEventDeptContext` already uses for `sales_dept` (`sub.sales_dept || dept`). A subsection's own link is trusted as-is: if it points at a catalogue id that no longer exists, this resolves to `null` rather than trying the parent's link instead (an invalid link is a data problem to surface, not paper over — and `MenuEditor.jsx` only ever verifies ONE candidate against the DB, so trying a second would need restructuring that file too).
- **`"<id>__unplaced"` always strips back to a TOP-LEVEL id** (a package section's own id, or a catalogue section id) — confirmed by reading every place `useMenuItemGrouping.js` constructs one (`labelSec.id+'__unplaced'`, `targetId+'__unplaced'`); it's never built from a subsection's id. It means "doesn't belong to any more specific subsection," not "belongs to no section," so it resolves exactly like the bare id with the suffix stripped (same `indexOf('__unplaced')`/`slice` pattern already used in `eventItems.js` and `useMenuItemGrouping.js`).
- **No id collision risk**: package section ids (`genSecId()`) and subsection ids (`genSubId()`) in `MenuPackagesView.jsx` are generated with disjoint `sec_`/`sub_` prefixes (plus timestamp+random), and catalogue ids are a completely separate id space — flattening subsection ids into the same lookup map as top-level section ids can't collide with either.
- `FunctionPlanPrintView.jsx` needed NO change — it only ever consumes `effectiveSectionIdByDish`'s output (`dishSectionOrder`/`dishSectionName`), so it's fixed automatically once that memo resolves correctly; it was never a second place carrying its own copy of this bug.
- `catalogueSection.test.js` rewritten: a bare subsection id and `"<id>__unplaced"` used to assert `null` (documenting the gap as "known, consistent," not a bug) — those now assert the correct resolved value, plus new cases for a subsection with its own link beating its parent's, a subsection falling back to an unlinked-vs-linked parent, and `buildOverrideResolver`/`packageCatalogueLinkFor` directly.
- **Caught by adversarial review, fixed before push: the parent-link fallback ignored department, and `"<id>__unplaced"` CAN be built from a subsection's own id, not only a top-level one.** (1) `useMenuItemGrouping.js`'s own department-routing logic (`matchingSubs`/`ownMatches`, ~line 632-634) deliberately refuses to inherit a parent's catalogue link for a subsection routed to a DIFFERENT `sales_dept` — the first version of this fix didn't carry that same guard into `buildPkgLink`, so a subsection explicitly routed to a different department (e.g. a bev-dept "Fresh Juice" subsection under an otherwise kit-dept parent) could inherit its kit-dept parent's catalogue link, which then gets written PERMANENTLY into `dishes_master.section_id` for any custom dish tagged to it via `addCustomDish`/`MenuEditor`. Fixed by only inheriting the parent's link when `(sub.sales_dept || secDept) === secDept`. (2) The original comment claimed `"<id>__unplaced"` ids are only ever built from a TOP-LEVEL id — false: `useMenuItemGrouping.js`'s `resolveOwnDishes` is called with a SUBSECTION as `labelSec` too (~line 654, when that subsection's own catalogue link itself has further catalogue subsections), producing `sub.id+'__unplaced'`. The resolution logic already handled this correctly by construction (strip-then-lookup works the same for any id shape) — only the comment and the test coverage were wrong; added `sub_1__unplaced`/`sub_2__unplaced` test cases and corrected the comment.
- Also deduplicated: the pkgSections-flattening loop (top-level + subsections → `{id -> catalogue_section_id}`) now lives in one private `buildPkgLink`, called by both `buildOverrideResolver` and `packageCatalogueLinkFor`, instead of being copy-pasted in each.
- **Known, separate, pre-existing bug this review surfaced but did NOT fix at the time (same bug class, different code path)**: the DEPARTMENT-routing lookups (`useMenuItemGrouping.js`'s `sectionOverrideDept` ~line 210-223, and `src/lib/eventItems.js`'s `deptForOverrideTarget` ~line 36-47) ALSO only check top-level package sections for an override target, with no subsection flattening — a dish overridden directly to a subsection with its own distinct `sales_dept` gets counted and mirrored to Kitchen/Ops under the wrong department. **Fixed 2026-11-17, see the next section.**

## A placement tag on a package subsection routed dept-counting/mirroring to the wrong department (fixed 2026-11-17, client-only, no DB change)
- Same bug class as the item above, different code path: a `sectionOverrides`/`menu_section_overrides` tag pointing at a package SUBSECTION needs its sales_dept resolved (for dept-tab counts, for `events.menu`'s Kitchen mirror, for Ops screens like Beverages/Fruits) the same way a catalogue section's placement needed its CATALOGUE section id resolved (the fix shipped just before this one). This resolution existed in THREE near-identical copies, and TWO of the three had the top-level-only gap:
  1. `useMenuItemGrouping.js`'s `sectionOverrideDept` memo (~line 210) — buggy, top-level only.
  2. `useMenuItemGrouping.js`'s `groupedByPkgSection` memo's own inline `deptForTargetId` (~line 707) — already CORRECT (had a subsection-search loop with the right `sub.sales_dept || sec.sales_dept || 'kit'` fallback) — found by actually reading this file end to end before assuming the bug was uniform everywhere.
  3. `src/lib/eventItems.js`'s standalone `deptForOverrideTarget` (~line 36) — buggy, top-level only, used by `buildEventDeptContext` for every non-Kitchen Ops screen's dept-filtered dish list (see `eventItems.js`'s own header comment on why this file keeps a standalone copy of dept-resolution logic independent of React).
- **Fix**: extracted the one CORRECT version (copy #2 above) into a new shared `src/lib/sectionDept.js` → `resolveDeptForOverrideTarget(rawId, pkgSections, catalogueSections)`. All three call sites now call this one function instead of keeping their own copies — including copy #2, which was already right, specifically so there is nothing left in the codebase that could silently re-drift the next time someone touches one copy and not the others (the exact failure mode `catalogueSection.js`'s consolidation and this one both exist to close off).
- Precedence, unchanged from the one correct copy: a subsection resolves through its own `sales_dept` if set, else its parent top-level section's, else `'kit'`; a catalogue section (a different id space entirely, reached only when nothing in `pkgSections` matches) resolves through its own `sales_dept`, else its parent CATALOGUE section's, else `'kit'`; `"<id>__unplaced"` resolves exactly like the bare id (stripped the same `indexOf`/`slice` way as the catalogue-id fix).
- 13 new unit tests in `src/lib/sectionDept.test.js` (new 6th test file — see "Testing" section).

## Three separate per-dish "ready" readers were stuck permanently at zero (fixed 2026-11-22, client-only, no DB change)
- Every live write of a dish's `ready` flag keys its `kitchen_tracking` row by NAME — `dk(evId, dishName)` = `evId+"|"+dishName`, confirmed the only reachable writer: `KitchenHub.jsx`'s own `markReady`/ready-modal path has no caller anywhere (`readyModal` is never set — dead code, left alone, flagged in Open Items instead of resurrected), so `EventDayTab.jsx`'s "Final Cooking" sign-off button (~line 1714, `setDs(dish.fEvId, dish.fIdx, {ready:true,...}, dish)`, where `dish` always carries `.name`) is the ONLY place `ready` is ever actually set.
- Seven separate READ sites across `Dashboard.jsx` and `DeptView.jsx` built their own lookup key instead, each getting it wrong a different way — none of them ever matched a real row, so every one of these counters/badges showed 0/stuck-false regardless of real kitchen progress, with no error anywhere to notice it by:
  - `Dashboard.jsx` (Today's Events ready badge) and `DeptView.jsx`'s Kitchen Tasks tab: `evId+"|"+idx` — the OLD index-based key format nothing writes any more (per EventDayTab.jsx's own comment, new writes only ever use the name-keyed `dk()`). Dashboard.jsx's version was doubly wrong: `idx` was the index into a Beverages-FILTERED array, not even the real per-event index.
  - `DeptView.jsx`'s Kitchen Pickup tab, Loading Checklist tab, and ODC bookings tab (5 separate read sites across these three): `` `d_${idx}` `` — an entirely invented key shape that never matched any writer, ever, in any version of this codebase (confirmed via grep — these are READ-only, with zero write sites anywhere in `src/`).
- **Fix**: new shared `src/lib/kitchenDishKey.js` (`kitchenDishKey`/`kitchenDishState`/`isKitchenDishReady`) — the one place that knows the real key shape, same consolidation pattern as `catalogueSection.js`/`sectionDept.js` this session. All 7 read sites now go through it, reading by DISH NAME (the array element itself, in every one of these call sites — confirmed each iterates a plain array of dish-name strings) instead of array position, so filtering an array for display (Beverages/Fruits dropped) can never again break the lookup the way it did at 3 of these 7 sites. `EventDayTab.jsx`'s and `KitchenHub.jsx`'s own `dk()` now delegate to the same shared function, so there's only one implementation left for a future change to diverge from.
- **DeptView.jsx's Kitchen Tasks tab had a SECOND, independent bug** in the same block: its "done" percentage read `safeArr(tracked?.done)` — nothing anywhere writes a `.done` array either (real per-step progress lives in the `manual` map, keyed by step index, written by `markManual`). Fixed by reusing `stepDone` (moved from `EventDayTab.jsx` into `helpers.js` so `DeptView.jsx` can share the exact same check instead of reinventing a simpler one that would miss substeps and the 3 legacy `manual`-key shapes `stepDone` already handles) for a best-effort percent, short-circuited to 100% once `tracked.ready` is true.
- **DeptView.jsx's Kitchen Pickup tab's per-dish `isDispatched`** (`!!d.dispatchReady`) was ALSO folded with the real, written whole-event `__dispatch_ready` flag (`isDispatched = !!d.dispatchReady || fullDispatched`) — without this, now that `ready` correctly resolves, every dish would show a permanently-stuck "🔔 Ready for Pickup" pulsing badge even after the whole function had actually been dispatched, since nothing anywhere writes the per-dish `dispatchReady`/`dispatchAt` fields (confirmed: reads only, zero writers in `src/`). The dead, never-read-again `dispatchedItems` variable at the same site was deleted.
- **Deliberately NOT built**: a real "mark this one dish picked up" UI control. Per this project's own "never guess on ambiguity" rule, inventing that is a product decision, not a bug fix — flagged in Open Items (§7) instead, alongside the separately-dead `KitchenHub.jsx` `markReady`/ready-modal path, for a human to decide whether to build per-dish pickup tracking or remove the now-better-but-still-partly-decorative badge.
- 8 new unit tests in `src/lib/kitchenDishKey.test.js` (new file) plus 7 new `stepDone` tests in `helpers.test.js` (moved there from `EventDayTab.jsx`, now exported/shared) — see "Testing" section for the current total.
- **Caught by adversarial review, fixed before push: the key-shape fix was correct but still counted against the WRONG total.** All 7 readers' denominator was `ev.menu` filtered only by "not Beverages"/"not Beverages or Fruits" — but Kitchen's own "Final Cooking" sign-off screen (`EventDayTab.jsx`'s `menuArr`+`byDish` loop, the only place `ready` is ever written) ALSO never shows, and therefore can never sign off: a whole event with `external_caterer` set, any dish in `outsourced_dishes`, and any dish name pinned to a non-kitchen department (`pinnedDeptForDish` — ice cream/tea/coffee → bev, independent of its catalogue section). An event with any of those dishes could reach a correct `ready` flag on every dish Kitchen actually touches and STILL never show "all ready," since the denominator kept counting dishes Kitchen was never going to sign off in the first place. Before this fix everything read 0 anyway, so this didn't make anything worse than it already was — but it meant the newly "fixed" counters still wouldn't reach N/N for a large share of real events.
- **Fix**: new `kitchenTrackableDishes(ev)` in `kitchenDishKey.js`, extracted from (and now the single source of truth for) `EventDayTab.jsx`'s own `menuArr`+`byDish` filter — `EventDayTab.jsx`'s `menuArr` now delegates to it too, so the one screen that actually writes `ready` and the 7 screens that read it can never again disagree about which dishes are even in play. All 7 reader sites now build their dish list from this function instead of their own ad-hoc Beverages/Fruits-only filter.
- **Caught by a second adversarial review round: the first version of this fix wasn't quite a no-op for `EventDayTab.jsx` itself.** `kitchenTrackableDishes` folded the Beverages-category/fruit-selection filter together with the caterer/outsourced/pinned-dept filter into ONE function, and `menuArr` delegated straight to it — but `EventDayTab.jsx`'s `byDish` loop applies its Beverages/fruit filter AFTER indexing (`menuArr(ev).forEach((name, idx) => {... if (bev/fruit) return; ...})`), and that `idx` becomes `fIdx`/`fns[].idx`, which `ds()`/`setDs()` still use as a fallback key for any `kitchen_tracking` row written before the name-keyed `dk()` existed (`dkLegacy`, `evId|idx`). Pre-merging the filters meant every dish AFTER a Beverages/fruit dish in the menu got a smaller `idx` than before, so an old legacy-keyed row could resolve to the WRONG dish. Low real-world impact (legacy rows are all over a month old), but not a true no-op. **Fix**: split into `kitchenMenuArr(ev)` (caterer/outsourced/pinned-dept only — what `EventDayTab.jsx`'s `menuArr` now delegates to, keeping its `idx` assignment byte-for-byte identical to before) and `kitchenTrackableDishes(ev) = kitchenMenuArr(ev).filter(bev/fruit)` (what every OTHER reader uses). `EventDayTab.jsx`'s `byDish` loop keeps applying the Beverages/fruit `return` inline, exactly as before.
- **Known, accepted, NOT fixed — a one-day risk on deploy**: `DeptView.jsx`'s Loading Checklist keys its saved checkboxes by POSITION (`"food_"+i` against the filtered `menu` array, persisted via `persistCheck`), not by dish name. Since the filtered dish list is now shorter for any event with an outsourced/pinned-dept/external-caterer dish (dishes that used to be counted are now correctly excluded), a checkbox ticked before this deploys could show against a different dish's row for any event still mid-loading across the deploy. This was already a fragile, position-keyed design before this change; not addressed here (deploying outside active loading hours avoids it entirely for this one release).
- **Known, NOT touched — a second, much larger copy of this same menu-filtering logic**: `KitchenHub.jsx` has its own entirely separate `menuArr(ev)` (~line 337, with ~14 call sites across Planning/Closing/Analytics/LMS-sync features) and its own Beverages check (`getSectionForDish(name)==="Beverages"`). It is NOT part of this fix — `KitchenHub.jsx`'s own `ready`-writing path (`markReady`) is dead code (see the Open Items row above), so this duplicate doesn't affect the bug just fixed, and consolidating a ~9000-line file's own long-standing helper touching 14+ unrelated features was judged out of scope for this pass. Flagged for a future, dedicated look.

## A PARTIAL kitchen_tracking reset left the shared Combined-view bucket stale (fixed 2026-11-22, client-only, no DB change)
- `KitchenHub.jsx`'s reset picker deletes each selected function's own `kitchen_tracking` row, plus the day's shared `"__combined_"+day` bucket row — but ONLY when EVERY function that day is selected (`allSelected`). This is deliberate: wiping the combined bucket on a partial reset would also erase the OTHER, non-reset functions' own combined progress.
- The problem this left: `setDs()` (`EventDayTab.jsx`) mirrors every write BOTH ways — into the writing function's own per-event row AND into the shared combined bucket's per-dish-NAME entry, via `mergeDishState` (a deep, additive merge, never a replace). `ds()`'s own combined-view read then folds each CONTRIBUTING function's current row ON TOP of the combined row — it never subtracts a function that's gone. So resetting function A alone deleted `kt[A.id]` entirely, but the combined bucket kept showing whatever A had contributed before, FOREVER: Combined view for one of A's dishes folded `fnRow={}` (A's row, now gone) onto the UNCHANGED stale combined row, so any field only A had ever set survived there with nothing to ever clear it, while a field also legitimately set by a surviving function B got mixed in indistinguishably (a merge keeps no provenance of which function set what).
- **Fix**: new `combinedBucketAfterPartialReset(kt, combinedId, resetEvIds, survivingEvIds)` in `kitchenDishKey.js`, called from `runReset` (now taking an optional 4th `partial` arg, built by the picker's `onConfirm` whenever `!allSelected`) inside the SAME `setKitchenTracking` update that deletes the reset rows (so it reads the latest state, not a possibly-stale prop, and can't race a realtime echo landing mid-reset). For every dish name found in a RESET event's own existing row (never an event's `.menu`/`menuArr` — see below for why), it rebuilds that dish's combined-bucket entry from scratch by folding together ONLY the surviving functions' CURRENT per-event rows, via the same `mergeDishState` `setDs` already uses — replacing the stale entry outright rather than merging onto it, since merging onto known-stale data is the bug itself. If no surviving function has any real tracked data for that dish, the entry is dropped entirely instead (nothing legitimate is left to show) and its key is reported back via `orphanKeys`.
- **Why `null`, not just omission, for a field that needs clearing**: `diffDishState` (the function that turns a state change into the patch `kt_set_paths` actually uploads) only ever iterates keys PRESENT in the new value — a key silently absent from the recomputed row is never diffed, never uploaded, and the server-side row stays stale forever. A new `tombstoneAgainst(oldEntry, freshEntry)` helper explicitly writes `null` for every field the OLD combined entry had that the fresh fold doesn't (both top-level, and per sub-key inside each step-map — `manual`/`starts`/etc., the same `DISH_STEP_MAPS` list `mergeDishState` itself already merges one level deep, now exported from `helpers.js`) — `mergeDishState`'s own spread-based merge already treats an explicit `null` as a real overwrite at both levels, so this flows straight through the EXISTING sync effect with no extra code needed there. A dish the recompute drops ENTIRELY (no survivor at all) still needs its OWN explicit server-side delete though — the ordinary sync effect never uploads a key's outright disappearance — so `runReset` issues a second `kitchen_tracking` delete scoped to `(ev_id = combinedId) AND (dish_key IN orphanKeys)`, chained after the existing reset delete succeeds.
- **`mesaDone` is handled as its own case, not tombstoned**: confirmed by reading `setDs`'s own comments in both files — `mesaDone` is explicitly EXCLUDED from mirroring in either direction between the combined bucket and any per-event row (it only ever exists standalone, written directly to the combined bucket by the "Mark prep done" bulk action). Since no per-event row can ever contribute or echo it, the recompute explicitly carries over the OLD combined entry's `mesaDone` as-is (if it had one) rather than losing it to the fold/tombstone logic — resetting one function shouldn't silently cancel a whole day's bulk D-1 prep sign-off.
- **Deliberately does NOT use any event's `.menu`/`menuArr`/`kitchenMenuArr`/`kitchenTrackableDishes` to decide which dishes to recompute or who "shares" one** — a dish renamed, removed from a menu, or reclassified (pinned dept, outsourced, Prep Day vs. Final Cooking's own separate dish-filtering) since it was last tracked could otherwise make this miss a dish or wrongly treat a function as sharing/not-sharing one. It only ever asks two purely data-driven questions: "does the reset event's OWN existing row name this dish" and "does a surviving event's OWN existing row have real data for this exact name" — both answerable straight from `kt` with zero dependency on which menu-filtering convention is authoritative for which tracking mode. A legacy index-keyed row (`evId|<n>`, from before dishes were tracked by name) found in a reset event's own row is skipped rather than guessed at, for the same reason — matching this codebase's established "never guess on ambiguity" rule, and already low-impact (such rows are over a month old).
- **Caught by an unusually thorough adversarial review (this is the riskiest logic shipped this session — shared multi-function state, touched by a destructive admin action — reviewed accordingly), four real bugs in the first version, fixed before push:**
  1. **A combined-only `mesaDone` survived forever once the one function that ever tracked the dish was reset, with no surviving function to legitimately still mean it.** `mesaDone` has NO per-event echo at all (see above) — the original logic treated "old entry had mesaDone" as reason enough to keep the whole dish entry alive, even when NO surviving function had any real per-event data for it. Fixed: `mesaDone` is now preserved ONLY alongside real surviving per-event data for that same dish — if nobody survives with real data, the whole entry (mesaDone included) is orphaned instead.
  2. **Manufacturing a brand-new combined entry for a dish the bucket never had one for.** If a reset event's own row named a dish the combined bucket had NO prior entry for, the original logic still built a fresh entry purely from a surviving function's data — but a reset function's own per-event view falls back to the combined entry whenever its own row is empty, so this made a just-reset function's view show a DIFFERENT function's progress, which it never did before this fix existed. Fixed: skip a dish entirely (`if (!oldEntry) return;`) when the combined bucket never had an entry for it — nothing stale to correct means nothing to touch.
  3. **The correction could reach the server even if the underlying per-event delete FAILED.** The original `runReset` applied the combined-bucket correction to local state in the SAME optimistic update as the per-event delete, before the server had confirmed anything — if the Supabase delete then failed, the ordinary sync effect had already pushed the correction's null-patches to the server, leaving a worse state than before (server showing a function's contribution nulled out of the combined bucket, while that same function's own rows — the delete that just failed — still held its real data). Fixed: the correction is now COMPUTED early (it needs the reset events' own rows, which are about to be deleted) but only APPLIED to local state (a second `setKitchenTracking` call, plus the orphan-keys delete) after the primary per-event delete confirms success server-side.
  - **Known, accepted residual risks, NOT fixed (documented, not engineered around)**: (a) if the orphan-keys delete itself fails or the tab closes before it completes, the server keeps a stale orphaned `dish|X` row, which the boot-time merge (adds/overwrites, never removes — the same merge-only-adds pattern behind §3.3d) brings back on the next reload; re-running the reset afterward fixes it, since the reset event's row reappears and gets treated as touched again. This is the SAME class of risk the original (pre-this-fix) per-event delete already had — no retry/offline-queue exists for any part of `runReset`, by original design, and adding one here would be a much larger, separate undertaking than this fix's scope. (b) A null-valued `starts` entry left by this correction (or by Undo, which already writes `starts:{sk:null}` — pre-existing) can make a stats-tile reader that only checks `Object.keys(x).length>0` (e.g. Event Day's "Cooking" count) count a dish as in-progress when every value is actually null — pre-existing display bug, this fix just makes it somewhat more reachable; low severity, cosmetic only. (c) A narrow (millisecond-scale) race exists if a live tablet writes a genuine combined-bucket update for the SAME dish between this function reading `kt` and the correction being applied — low impact (the surviving function's own row is untouched and gets re-folded correctly at read time in Event Day; only Prep Day Combined's own non-folding read is affected, and only transiently).
- **Caught by a SECOND, focused review round on just these three fixes: fix 3 itself introduced a real race, with genuine data-loss potential.** The deferred `setKitchenTracking` call wrote `correction.row` — a snapshot computed from `p` BEFORE the primary per-event delete was even sent — wholesale into `kt[combinedId]` AFTER the delete's round-trip (hundreds of ms to seconds on slow wifi). Anything that changed the combined bucket in that gap (a realtime echo from another tablet, a local tap on an UNTOUCHED dish, a survivor starting a touched dish) was silently reverted by that stale overwrite, and in some cases (a value genuinely changed, e.g. an Undo flipping `true`→`false`) the REVERTED value then went back out through the ordinary sync effect with a fresh timestamp, winning last-write-wins and overwriting another tablet's newer, legitimate change on the SERVER too. `mesaDone` was the worst case (combined-only, never hidden by any per-event fold).
  - **Fix**: split the function in two. `dishesTrackedByEvents(kt, evIds)` — just the dish-NAME extraction from the reset events' own rows — is called EARLY (inside `runReset`'s first `setKitchenTracking`, before those rows are deleted, since it needs them to still exist). `combinedBucketAfterPartialReset(kt, combinedId, touchedNames, survivingEvIds)` now takes that frozen name list (not event ids) and is called LATE — inside a SECOND `setKitchenTracking`, only after the primary delete confirms success, against the LATEST state at that point. Its `nextRow` now starts as a full copy of the CURRENT combined row (`Object.assign({}, oldRow)`, not just non-dish keys), so anything not in `touchedNames` — including anything that changed during the round-trip — survives by construction; only the explicitly-touched dish names are recomputed/orphaned against whatever's actually current.
  - This is also why `runReset`'s own in-code comment now explicitly separates "what to correct" (frozen early) from "the correction itself" (computed late) — conflating the two was exactly the bug.
  - 6 more tests added, including one that directly simulates the two-step sequence with a deliberately LATER `kt` snapshot for the apply step, confirming a concurrent change to an untouched dish survives.
- 30 unit tests for `dishesTrackedByEvents`/`combinedBucketAfterPartialReset` in `kitchenDishKey.test.js` — see "Testing" section for the current total.
- **Caught by a THIRD review round, focused narrowly on the race fix above: the fix relies on a `setKitchenTracking` updater running synchronously the moment it's called, which React does NOT guarantee for a component's SECOND state update in one interaction — confirmed empirically (not just reasoned) against this project's actual installed react-dom build (19.2.6), by writing a real test harness: a fresh component's first `setState(fn)` runs its updater eagerly, but a second `setState(fn)` call (after that component has already re-rendered once from its own earlier update) does NOT, leaving a variable captured from inside it still `null` the very next line.** This hit BOTH `setKitchenTracking` calls in `runReset` — `touchedNames` (computed in the first call) only "happened to work" because it isn't actually read until after a network round-trip, by which point React has always already flushed it in practice (never guaranteed, just empirically reliable given the delay); `correction` (computed in the second call, inside a promise `.then()`) is read on the VERY NEXT LINE with no such delay, so it was reliably still `null` — meaning the orphan-keys delete after it never ran at all, silently reintroducing the exact "stale server row never cleaned up" failure mode this whole fix exists to close, specifically for the orphaned-dish case.
  - **Fix**: `import { flushSync } from "react-dom"`, wrap BOTH `setKitchenTracking(...)` calls in `runReset` in `flushSync(() => { ... })` — forces React to run the updater and commit synchronously regardless of pending-update state, removing the reliance on "usually happens to flush in time" for a guarantee instead. Re-confirmed empirically (same real-react-dom harness technique, extended to match the ACTUAL call shape — inside a promise `.then()` callback, not a synchronous click handler) that `flushSync` correctly fixes this in that exact context, with the updater seeing the latest state and no console warnings/errors.
  - General lesson for this codebase (both this file and any future one): never assume a `setState(updaterFn)` call's updater has run by the very next line unless either (a) it's demonstrably the FIRST state update in a fresh interaction, or (b) it's wrapped in `flushSync`. A delay before the captured value is read (a network round-trip, an `await`) is not a substitute for an actual guarantee.

## FunctionPlanPrintView.jsx's "New section"/"Section removed" blocks keyed React lists by section NAME, which can collide (fixed 2026-11-22, client-only, no DB change)
- `(diff.newSections || []).map(sec => <div key={sec.name}>...)` and `(diff.removedSections || []).map(sec => <div key={'rs-'+sec.name}>...)` — section display NAMES aren't guaranteed unique: a package section and a catalogue section (or two different package sections) can share a display name while being genuinely different sections. Two same-named entries in either list within one dept would collide on their React key, which can make React reuse/mismatch DOM nodes between re-renders (the live FP, not just a static print) instead of rendering both correctly.
- **Fix**: both producers of these lists (`EventMenuBuilderView.jsx`'s `newSectionsByDept` and `menuDiffByDept`'s `removedSections` construction) already had a genuinely unique id available but weren't carrying it through — `newSectionsByDept[dept]` is keyed by the target catalogue section id itself (`targetId`, unique by construction since it's the object's own key), just dropped when `Object.values()` flattens it into an array; `removedSections` is built from `pkgSecsAll` (`MENU_PACKAGE_SECTIONS`'s own package sections), each with its own unique `sec.id` (`genSecId()`-generated). Both now carry `id` through into the pushed/stored object, and `FunctionPlanPrintView.jsx` keys off `sec.id || sec.name` (keeping the name fallback only for safety, since every real entry now always has an id).
- Confirmed via grep this diff logic (`newSectionsByDept`/`menuDiffByDept`) has exactly one producer (`EventMenuBuilderView.jsx`) and `FunctionPlanPrintView.jsx` is its only consumer that renders these two lists — `MenuBuilderView.jsx` (Proposals) has no equivalent copy of this logic, and `FunctionPlanTab.jsx`/`MenuPrintView.jsx` only pass the print view through without building their own.

## menuDiffByDept's "whole section removed" check only looked at a section's OWN direct dishes, never its subsections (fixed 2026-11-22, client-only, no DB change)
- The same `removedSections` construction just touched above (`menuDiffByDept`'s per-dept loop over `pkgSecsAll`) decides whether a package section collapses to a single "Section removed: X" line by checking whether every one of that section's dishes is gone — but it only ever read `sec.dishes` (a section's own DIRECT dish list), never `sec.subsections[].dishes`. A package section with subsections (e.g. "Main Course" > "Hyderabadi Cuisine", the same nesting this session's earlier `catalogueSection.js`/`sectionDept.js` fixes dealt with) could fail this check in either direction: (a) few or no direct dishes of its own meant the section could never collapse at all, even once every one of its subsection dishes was removed — always printing a pile of individual "− dish" bullets instead of the intended one-line summary; (b) worse, if the section's few DIRECT dishes were all removed while a subsection's dishes were still being served, the check could wrongly report the WHOLE section as removed, telling Kitchen a subsection's dishes are gone when they're still on the menu.
- **Fix**: pool a section's own `dishes` together with every one of its `subsections[].dishes` BEFORE filtering/checking "is everything here gone" — one combined dish list per top-level section, matching how this nesting is already handled elsewhere in this file (e.g. `useMenuItemGrouping.js`'s own subsection pooling). Scoped to exactly the existing "is this whole section's dish list gone" check — does not add a new, separate "subsection removed" line item, which would be a bigger feature decision not asked for by this finding.
- **Caught by adversarial review, fixed before push: pooling without deduping could double-count a dish.** `MenuPackagesView.jsx`'s `addDishToSubsection`/`resyncSubsection` only check for an existing name WITHIN the one list they're adding to — never the parent section or a sibling subsection — so the same dish name can legitimately end up listed in both a section's own `dishes` and a subsection's (or in two subsections). Pooling them naively would inflate the print view's displayed "N dishes" count, and — worse — could let a section whose only REAL dish is double-listed this way slip past the existing "more than one dish" collapse threshold (`names.length <= 1`), printing "Section removed — 2 dishes" for what's actually a single dish. Fixed with a plain dedupe (`.filter((n,i,arr)=>arr.indexOf(n)===i)`) right after pooling, matching the same dedupe `flattenSectionsToDishes` (the function that builds this package's own canonical dish list) already does.
- **Known, NOT fixed, non-blocking**: a subsection with its OWN `sales_dept` different from its parent's (e.g. a bev-dept subsection under an otherwise kit-dept parent) is correctly excluded from the parent's dept bucket by this fix — but the loop itself only ever walks TOP-LEVEL sections filtered by `sec.sales_dept`, so that subsection can never collapse into ITS OWN "section removed" line in ITS OWN department either (pre-existing, not a regression — before this fix it could never collapse anywhere). Also reconfirmed: `ProposalsView.jsx`'s own `dishNameToPkgDept` builder has the exact same "only reads `sec.dishes`, ignores subsections" gap — already tracked in Open Items (§7) from item 10's review, not a new finding.

## DishSectionsEditor.jsx's realtime subscription never noticed a NEW dish (fixed 2026-11-22, client-only, no DB change)
- The Dish Library's Sections tab subscribes to `dishes_master` to auto-refresh while open — but with `{ event: 'UPDATE', ... }`, not `'*'` like its sibling `dish_catalogue_sections` subscription right above it in the same effect. A dish added elsewhere while this tab was already open (e.g. a custom dish created from the Build Menu/Items tab, via `createCustomDishInLibrary`) INSERTs a new `dishes_master` row — which this subscription never saw, leaving the Sections tab silently stale until a manual reload, with no indication anything was missing.
- **Fix**: `'UPDATE'` → `'*'`, matching the sibling subscription. `loadData()`'s own query already correctly filters `is_active=true`, so a deactivated dish disappearing on the next reload was already working — this gap was specifically about new dishes never triggering that reload at all.

## Switching an event's package stranded per-dish placement tags pointing at the OLD package's own section ids (fixed 2026-11-22, client-only, no DB change)
- `Dashboard.jsx`'s `syncEventItemsOnPackageChange` (runs whenever an event's menu package is switched) kept `event_items` in sync with the new package's dish list, but never touched `events.menu_section_overrides` — the per-dish placement tag map. A tag that happened to point at the OLD package's own (randomly-generated, package-local) section or subsection id is now pointing at an id that exists in NO other package, including whatever the event just switched to — `resolveOverrideToCatalogueSectionId`/`effectiveSectionIdByDish` (this session's earlier `catalogueSection.js` fix) find no match for it anywhere, so the dish silently strands as a mislabeled "Extras" pill on both the Items tab and the FP print view, with nothing to explain why.
- **Fix**: new `overridesWithoutOldPackageLocalIds(overrides, oldPkgSections)` in `src/lib/menuSectionOverrides.js` — drops exactly the overrides pointing at the OLD package's own top-level OR subsection ids, leaving every other kind of tag (a real catalogue section/subsection id, or the explicit `'__extras__'`) completely untouched, since those are deliberate, catalogue-level placements independent of which package is active and must survive a package switch. `syncEventItemsOnPackageChange` now reads the event's current `menu_section_overrides`, runs this, and writes the corrected map back only if something actually changed. Deliberately does NOT attempt to "migrate" a stale tag to an equivalent section in the new package — there's no reliable correspondence between two different packages' section ids even when they have similarly-named sections, and guessing one risks silently misplacing a dish instead of just leaving it to fall back to its own catalogue section (the same, already-correct behavior a dish with no tag at all gets).
- **Caught by adversarial review, fixed before push — two real bugs in the first version, plus a second code path with the same gap:**
  1. **Package-local ids are NOT always unique across packages, so the original "drop any id found in the old package" rule had false positives.** `MenuPackagesView.jsx`'s `duplicatePackage` regenerates a TOP-LEVEL section's id but keeps every one of its subsections' original ids unchanged (confirmed in `serializeSections`, which only generates a new id when one is missing) — a dish tagged to a subsection shared by both the original and a duplicate could get its STILL-VALID tag stripped on a switch between the two. Separately, a package whose sections were never edited away from their derived default (`getSectionsForPackage`) gets deterministic ids like `sec_0_main_course`, which a second, similarly-never-edited package can independently end up with too. **Fix**: `overridesWithoutOldPackageLocalIds` now takes the NEW package's sections too, and only drops an id that belonged to the OLD package and does NOT also exist in the new one.
  2. **A stale `"<id>__unplaced"` tag (see `catalogueSection.js`) was missed** — the cleanup compared the raw override value directly against the id set, without stripping the `__unplaced` suffix the way every other resolver in this codebase already does, so `sec_1__unplaced` pointing at the old package survived the switch and stranded the dish exactly as before. Fixed by stripping the suffix before matching, same `indexOf`/`slice` convention as `catalogueSection.js`/`sectionDept.js`.
  3. **A second place an event's package can change had the identical gap**: `MenuPackagesView.jsx`'s `commitMenu` ("Quick start from package", `delta.action==='package'`) sets `e.menuPackage`/`e.menu` via the same `setEvents` optimistic-update pattern `Dashboard.jsx` uses, but never touched `menu_section_overrides` either. Fixed the same way, but without an extra DB round-trip — this component already has the event's live `menu_section_overrides` in local state (`selEv`), so the cleanup runs inline and rides along in the same `setEvents` call (which `App.jsx`'s `buildEventRecord` already persists generically, same mechanism that already persists `menuPackage`/`menu` from this exact function).
  - Also fixed in the same pass: a null/undefined entry inside a package's `sections` array (e.g. from a malformed save) would have thrown trying to read `.subsections` off it — guarded.
  - **Known, NOT fixed, non-blocking** (per adversarial review): if `App.jsx`'s own background `menuPackage` write later fails and reverts the event's package locally, the overrides have already been stripped by then, leaving a dish that never actually changed package stranded in Extras — rare, and the pre-existing `event_items` sync had the same exposure already. Also: the cleanup writes straight to the DB (Dashboard.jsx path) or through `setEvents` (MenuPackagesView.jsx path) ahead of any realtime echo, so another already-open tab holding a stale in-memory override blob could briefly resurrect a just-dropped tag if it saves first — a short-window, pre-existing class of staleness, not specific to this fix. A SECOND review round confirmed both fixes are correct and found two more low-risk, non-blocking edge cases, neither new to this diff: a package switch during the brief window before `MENU_PACKAGE_SECTIONS` has finished loading sees an empty old-id set and silently cleans nothing (not worse than before this fix existed); and `MenuEditor.jsx`'s `selectPackage` doesn't block a switch while sections are still loading, which is the same narrow window.
- 13 unit tests in `src/lib/menuSectionOverrides.test.js` (new 8th test file) — see "Testing" section for the current total.

## Items tab (Build Menu) kept showing stale dish placement/price/recipe status for a dish changed elsewhere (fixed 2026-11-22, client-only, no DB change)
- `useMenuItemGrouping.js`'s `allDishes` useMemo (shared by both Proposals' and Booked Functions' Items tabs) only re-reads `getAllDishes()` when `dishLibBump` changes — a per-tab counter each caller bumps ONLY from its own `addCustomDish` path. `getAllDishes()` reads `DISH_MASTER`/`RECIPE_DB`, plain mutable objects — `recipeData.js`'s own `subscribeDishMetaRealtime`/`subscribeRecipeRealtime` already keep THOSE live, app-wide, the moment ANY dish is re-sectioned, reactivated, or given a recipe (from Dish Library, another tablet, even this same tab's own non-`addCustomDish` actions) — but mutating a plain object never triggers a React re-render on its own, so an already-open Items tab had no way to notice and kept serving its mount-time snapshot: wrong section/placement, wrong "has a recipe" status, stale veg/notes/image, until the tab happened to reopen or `dishLibBump` incremented for an unrelated reason.
- **Fix**: the hook now re-reads `getAllDishes()` (via its own internal `catalogueBump` counter, added to `allDishes`'s dependency array alongside `dishLibBump`) whenever any of `DISH_MASTER`/`RECIPE_DB`/`DISH_CAT_MAP`/`DISH_NAME_MAP`/`DISH_HINDI_MAP` changes. Fixed once, in the shared hook, rather than wiring the same thing into both `EventMenuBuilderView.jsx` and `MenuBuilderView.jsx` separately — this hook's own header comment already documents it was built specifically to stop that kind of duplicated-then-drifting logic.
- **Caught by adversarial review, redesigned before push — the first version was both racy and under-scoped.** It opened its own `dbSubscribe('dishes_master', ...)`/`dbSubscribe('recipes', ...)` realtime channels directly in the hook. Two real problems: (1) realtime-js gives NO ordering guarantee between two INDEPENDENT channels receiving the same underlying row change — this hook's own channel could fire and re-read `getAllDishes()` BEFORE `recipeData.js`'s own, separate `subscribeDishMetaRealtime`/`subscribeRecipeRealtime` channel had actually finished patching `DISH_MASTER`/`RECIPE_DB` for that same change, leaving the tab stuck showing the PREVIOUS state until some unrelated LATER change happened to trigger another re-read; (2) it only covered 2 of the 5 maps `allDishes` actually reads — `getCatIdForDish`'s `DISH_CAT_MAP` fallback and `isDishNoSopMarked`'s `DISH_NAME_MAP` check (both from `dish_categories`/`dish_name_map`), and `resolveDishHindi`'s `DISH_HINDI_MAP` (from `dish_hindi_map`) were all left just as stale as before — in particular, mapping a dish to an SOP recipe via DishMappingModal (writes only `dish_name_map`, not `recipes`) was exactly the "given a recipe" case this fix claimed to close, and it wasn't.
  - **Fix**: a new small pub-sub primitive in `recipeData.js` — `onDishDataChange(cb)` registers a listener, returns an unsubscribe function; a private `notifyDishDataChange()` is called from INSIDE every one of `subscribeRecipeRealtime`'s and `subscribeDishMetaRealtime`'s own realtime handlers (for `recipes`, `dish_categories`, `dish_name_map`, `dish_hindi_map`, `dishes_master` — NOT `dish_store_map`, which `allDishes` doesn't read), each call placed AFTER that handler finishes patching its own map. The hook now calls `onDishDataChange` instead of opening any realtime channel of its own, which removes the ordering race by construction (the map is always already patched by the time a listener runs, since the listener is invoked from inside the very code that just patched it) and automatically covers every table that feeds `allDishes`, for free, with zero extra realtime channels per open tab.
  - Also added a 150ms debounce on the hook's own side (clearing/resetting a pending `setTimeout` on each notification before actually bumping `catalogueBump`) — a bulk write (a section drag-reorder, a dish merge, a recipe import) fires one `postgres_changes` event PER ROW as a separate realtime frame; without this, every open Items tab would re-run the whole (non-trivial — it does a `getCatIdForDish`+`resolveDishHindi` lookup per dish) `allDishes` map once per row instead of once per batch.
  - A second review pass confirmed this redesign is correct and found one more small, pre-existing (not a regression) gap: `hydrateRecipeData` (the ONE-TIME boot hydration that first populates all these maps) never called `notifyDishDataChange()` either, so an Items tab mounted in the ~1-second window before boot config finishes loading could keep showing an empty/stale dish list until an unrelated later realtime change happened to notify it. Fixed with the same one-line call at the end of `hydrateRecipeData`.

## A dish's SOP category and its real department can disagree — checking the wrong one made it vanish from EVERY screen (fixed 2026-11-22, client-only, no DB change)
- A dish has TWO independent classifications: its real DEPARTMENT (kit/bev/frt/..., resolved via `src/lib/eventItems.js`'s `resolveDeptForDish` precedence chain — the mechanism `DeptView.jsx`'s Beverages/Fruits Ops screens actually use, via `getEventItemsByDept`), and its SOP/RECIPE CATEGORY (`RECIPE_DB.cats`, via `getCatIdForDish`/`getSectionForDish` in `recipeData.js` — which SOP binder its cooking instructions live under, nothing to do with which department serves it). These CAN legitimately disagree: a dish dept-routed to `'kit'` can have its SOP category filed as "Beverages" (a kitchen-prepared drink base, or just a mis-tagged SOP category).
- Several places across Kitchen/Transport screens decided "should Kitchen track/show this dish" by checking the SOP-category axis (`getCatIdForDish(name)==='beverages'`/`getSectionForDish(name)==='Beverages'`) instead of the real department. The key, previously-unnoticed consequence: `syncAllKitchenMenuMirrors`/`mirrorKitchenMenu` (`eventItems.js`) already write `events.menu` PRE-FILTERED by the REAL department (dropping bev/frt) the moment an event's Items tab has ever been opened (`event_items_initialized`) — so for such an event, re-applying the SOP-category check on top of an ALREADY department-filtered mirror double-filters it, silently dropping a genuinely kit-dept dish whose SOP category happens to be "Beverages." Since the dish is NOT actually bev-dept, Beverages Ops (correctly, via the real department) never shows it either — the dish vanishes from every screen, with nothing to explain why.
- **Fix**: new `isExcludedFromKitchenTracking(name, ev)` in `kitchenDishKey.js` — excludes a fruit-selection dish unconditionally (name-pattern rule, unrelated to either axis); tries to resolve the dish's REAL department synchronously first (see the next entry for why this step was added — a first version skipped straight to trusting `event_items_initialized`, which adversarial review found unsafe); only when that finds no signal either way does it fall back to trusting the department-filtered mirror (if the event is initialized) or the legacy SOP-category heuristic (if not), as a last resort. Wired into every site that was using the wrong check: `kitchenTrackableDishes` (kitchenDishKey.js), `EventDayTab.jsx`'s `byDish` loop, `KitchenHub.jsx`'s two Prep Day dish-list builders, `TransportDispatch.jsx`'s dish-count and per-station grouping, and `DeptView.jsx`'s "Kitchen: Menu" display tab — six call sites across five files, all converged onto one function instead of six independently-drifting copies of the wrong condition.
- **Did NOT touch**: `kitchenMenuArr`'s own index-assignment order (unchanged — the exclusion condition changed, not WHERE/WHEN it runs relative to indexing, preserving the exact legacy per-position `kitchen_tracking` fallback semantics three prior adversarial review rounds specifically protected in an earlier item this session). Did NOT consolidate `KitchenHub.jsx`'s/`TransportDispatch.jsx`'s own separate `menuArr` copies into the shared `kitchenMenuArr` — that's a bigger, separate decision already declined once this session for the same reasoning (a long-standing helper touching many unrelated features in a huge file); only the one-line exclusion CONDITION at each call site was changed.
- **Known, deliberately NOT fixed — a separate, inverse bug in Fruits Ops**: `DeptView.jsx`'s Fruits Ops tabs (multiple sites) select `sectionForDish(d)==="Fruits"` (the SOP-category axis again) OUT OF `ev.menu` — which, for an initialized event, is the KITCHEN mirror that's ALREADY had fruit-dept dishes removed from it. This is the mirror image of the bug just fixed, but in Fruits Ops's OWN screen rather than Kitchen's — flagged for its own separate pass, not fixed here (different root cause shape, reads from the wrong source array entirely rather than double-filtering the right one).
- **Known, accepted gap**: a genuinely-new dish added to an ALREADY-initialized event via certain paths (a package "quick start," `MenuPackagesView.jsx`'s `applyMenuDelta`) can briefly leave `events.menu` holding an unfiltered, every-department snapshot before the next boot-time/Items-tab-open heal re-derives the correct mirror — in that narrow window, a genuine bev-dept drink could transiently show in Kitchen. Self-healing (the next mirror sync corrects it), unlike the bug just fixed (which was invisible and permanent) — not addressed here.
- **Caught by adversarial review, fixed before push — `event_items_initialized` alone is NOT a reliable signal that `events.menu` has actually been re-mirrored to the real department yet.** The first version trusted `event_items_initialized` unconditionally (if true, never re-check department at all) — but several paths set that flag true while leaving `events.menu` as the raw, every-department package list for a while longer: `MenuPackagesView.jsx`'s "Quick start from package" / `Dashboard.jsx`'s package-switch both set the flag without re-mirroring immediately afterward; and an event whose REAL kit-dept menu is genuinely empty gets stuck in a tug-of-war where the UI's own package-list fallback (App.jsx) keeps re-populating `ev.menu` with the full, unfiltered package list even as the mirror sync keeps trying (and failing) to write `[]`. Trusting the flag blindly in those states would have let a genuine bev/frt dish LEAK INTO Kitchen tracking — trading the original bug for a real regression in the opposite direction.
  - **Fix**: `isExcludedFromKitchenTracking` now ALWAYS tries to resolve a dish's REAL department first, synchronously, from data already in memory — a name-pinned dept (`pinnedDeptForDish`), the package's own section/subsection `sales_dept` for that dish (walking `MENU_PACKAGE_SECTIONS[ev.menuPackage]`, subsection falling back to its parent's dept, same precedence as `sectionDept.js`/`eventItems.js`), and a per-event placement-tag override (`ev.menu_section_overrides`, resolved via the already-shared `resolveDeptForOverrideTarget`). This mirrors `resolveDeptForDish`'s own precedence minus the two layers that genuinely need an async fetch (a catalogue section's own `sales_dept`, `sales_items_meta`) — not available to a pure function given only a dish name and an event object. Only when NONE of these synchronous signals say anything does it fall back to trusting the mirror (if initialized) or the legacy SOP-category heuristic (if not) — exactly as before, now as the LAST resort rather than the only one.
  - 6 more unit tests added, covering a package-section bev dish, a package-subsection frt dish (inheriting dept from its own `sales_dept`, not its kit-dept parent), a package-section kit dish (correctly kept), an ad-hoc dish reachable only via a per-event override tag, confirmation the original SOP-category-only fix still holds when the real-department check finds no signal either way, and that a name-pin wins over a conflicting package placement.
- 13 new/changed unit tests in `kitchenDishKey.test.js` (`isExcludedFromKitchenTracking`'s synchronous real-department check, `kitchenMenuArr` index-stability, plus a `kitchenTrackableDishes` initialized-event case) — see "Testing" section for the current total.
- **Caught by a SECOND adversarial review round, fixed before push — `realDeptExcludesDish` itself checked its layers in the WRONG ORDER relative to `resolveDeptForDish`'s real precedence.** The first version of this new synchronous check scanned the package-section/subsection list BEFORE consulting `ev.menu_section_overrides`, and used first-match-wins when a dish name appeared in more than one section. Both are backwards: an override exists specifically to OVERRIDE the package's default placement, so checking the package first can (a) wrongly EXCLUDE a dish a staff member deliberately re-tagged OUT of a bev/frt package section into kit — reproducing the exact "vanishes from every screen" bug this whole fix exists to close, just reached a different way — or (b) wrongly KEEP a dish re-tagged INTO bev/frt from a kit package section, since the kit-section match would already have returned before the override was ever read, letting a real bev/frt dish leak into Kitchen during the stale-mirror windows the first round's fix was for.
  - **Fix**: reordered to `pinnedDeptForDish` → per-event override (`resolveDeptForOverrideTarget`, an unresolvable/`null` result treated as "no signal" — falls through to the package scan rather than being substituted as the dept itself or short-circuiting the result) → package section/subsection scan, now **last-match-wins** (matches `buildEventDeptContext`'s own forEach-overwrite behavior in `eventItems.js`, not "first match wins"). Also defensively reads `ev.menuPackage || ev.menu_package`.
  - 4 more unit tests added (now 17 in this describe block): an override moving a dish OUT of a bev package section into kit (kept, not excluded); an override moving a dish INTO bev from a kit package section (excluded, not kept) — the pair the first round's 6 tests never covered in either direction; a subsection with NO own `sales_dept` inheriting its bev-dept PARENT's dept (the existing subsection fixture had its own explicit `sales_dept`, so the inheritance fallback branch itself was untested); and an override resolving to `null` being treated as no signal for a dish with no package placement of its own either (not substituted as a department, not a crash).
  - **Noted, not addressed**: a package with no `MENU_PACKAGE_SECTIONS` overlay at all gives this synchronous check zero signal either way, so a bev/frt dish in such a package could still leak during the stale-mirror window from the first round's fix. Every package saved since the "V74" sections change has sections, so this is believed to be a non-issue in production today, but wasn't verified against live data — worth a DB check if this ever surfaces.
  - Given this one function needed fixing across two full adversarial review rounds (first the `event_items_initialized` premise, second the precedence order), treat `realDeptExcludesDish` as a stress point — any future change to it should get at least one more adversarial pass before shipping, the same scrutiny `combinedBucketAfterPartialReset`/`flushSync` got after its own two rounds each found real issues.
- **Caught by a THIRD adversarial review round, fixed before push — `realDeptExcludesDish` returned a plain boolean, which conflated "definitively resolved to kit" with "no synchronous signal at all" (both `false`).** `isExcludedFromKitchenTracking` couldn't tell the two apart, so a dish definitively placed in a `sales_dept:'kit'` package section (or override) could still fall through to `(ev && ev.event_items_initialized) ? false : getCatIdForDish(name)==='beverages'` on an UNINITIALIZED event — and if that same dish's RECIPE_DB SOP category happened to be "beverages" (the exact double-filing case this whole fix exists to close), it was wrongly excluded anyway, via the fallback path instead of the mirror-trusting one. All of round 1/2's new tests set `event_items_initialized: true`, so none caught it — the bug only surfaces on an uninitialized event, which is common (`menuPackage`/`menu_section_overrides` are populated independently of `event_items_initialized`, e.g. right after "Quick start from package," before the Items tab is ever opened).
  - **Fix**: `realDeptExcludesDish` now returns a TRI-STATE — `true` (exclude), `false` (definitely keep), or `null` (no signal) — and `isExcludedFromKitchenTracking` checks `if (realDept !== null) return realDept;` before ever consulting `event_items_initialized` or the SOP-category heuristic, so a definitive answer always short-circuits instead of being silently discardable.
  - Also hardened the package-section/subsection scan loop with the same `sec &&`/`sub &&` falsy-entry guards `resolveDeptForOverrideTarget` already had, for consistency (static in-memory data, low real risk, but a correctness gap right next to code that explicitly defends against it).
  - 2 more unit tests added (now 19 in this describe block, 49 in the file): a kit-section dish whose own SOP category is "beverages", on an uninitialized event, confirming the fix directly; and the literal same-dish-listed-in-two-conflicting-sections-with-no-override case for last-match-wins (previously only inferred from the override-vs-package precedence tests, never tested on the static package-list scan itself).
  - This function has now needed a real fix across THREE full adversarial review rounds (premise, precedence order, return-value conflation) — any FUTURE change to `realDeptExcludesDish`/`isExcludedFromKitchenTracking` should get at least one fresh adversarial pass before shipping; don't assume "it passed review before" still holds once the logic moves.
- 19 new/changed unit tests in `kitchenDishKey.test.js` total across all three rounds — see "Testing" section for the current total (213 tests, 8 files as of 2026-11-22).

## FP's ack-diff system only tracked WHICH dishes were on the menu at ack time, blind to a dish re-tagged to a different dept/section since (fixed 2026-11-22, client-only, no DB change)
- `FunctionPlanPrintView.jsx`'s highlight-since-acknowledged system (`event_function_plans.chef_ack_snapshot`, a jsonb `{fp: {...}, dishNames: [...]}`) only ever recorded WHICH dish names were on the menu at ack time. `dishChanged(name)` and `hasChangesSinceAck`'s dish-equality check both only compared name PRESENCE (`ackSnapDishes.has(name)` vs now) — a dish re-tagged to a different department or catalogue section since the chef last acknowledged (same name, same overall dish count, just now prints under a different dept heading / section sub-heading on the sheet) was invisible to both: no amber per-dish highlight, no "⚠ Changed since … last acknowledged" banner, even though the sheet in front of the chef genuinely differs from what they signed off on. Fable audit item #3 ("the ack snapshot ignores section tags").
- **Fix**: the snapshot now also captures `dishPlacement` — a map of dish name to a `"<deptId>|<sectionId>"` signature, built in the same loop that already builds `dishNames` from `itemsByDept`. `dishChanged`/`hasChangesSinceAck`'s `dishesEqual` both now also flag a dish whose placement signature differs from the snapshot's, in addition to the existing presence check. An OLD snapshot (taken before this fix) has no `dishPlacement` field at all — `name in ackSnapPlacement` is false for every name on one of those, so this never produces a false positive against a pre-existing ack; it just doesn't retroactively catch a re-tag that happened before the fix shipped (the next fresh Acknowledge starts tracking it normally).
- **Keyed by section ID, not name** — caught by adversarial review: the first version of this fix keyed the signature off the section's display NAME (`dishSectionName[n]`), but nothing in `DishSectionsEditor.jsx`'s add/rename flow enforces section-name uniqueness (a top-level section and an unrelated subsection can legitimately share a name). A dish re-tagged between two same-named sections would have produced an identical signature and silently missed the re-tag — the exact bug class this fix exists to close. Fixed by threading a new prop, `dishSectionId` (`EventMenuBuilderView.jsx`'s already-computed `effectiveSectionIdByDish`, dish name → real catalogue-section id or `null` for "Extras"), down to `FunctionPlanPrintView.jsx`, and keying the signature off that id (falling back to the section name only if the id map is missing an entry at all — the same transient one-render window `dishSectionName` itself already has for a just-added custom dish, pre-existing and self-correcting, not a new gap).
- **Did NOT touch**: the separate "Section removed" heuristic (`var changed = ackSnap && sec.dishes.some(...)`) — that's a different, pre-existing check for a whole package section collapsing because every one of its dishes is gone, unrelated to re-tagging; nor `ackFpChef` in `EventMenuBuilderView.jsx` (already shape-agnostic — just persists whatever snapshot object it's given into the jsonb column) or any other `chef_ack_snapshot` reader (`BookedFunctionsView.jsx`/`PublicFPHub.jsx` only read `chef_ack_by`/`chef_ack_at`, never the snapshot's contents).
- No new unit tests — this file (like the rest of the component layer) has no existing test harness (no `@testing-library/react` dependency in this project; every existing test file covers pure functions in `src/lib`/`src/data`/`src/utils` only), so this stays consistent with that existing pattern rather than introducing a one-off component-rendering test for a single fix.

## FP's whole-"Section removed" notice was less visually prominent than the heading next to it (fixed 2026-11-22, client-only, no DB change)
- Fable audit item #5 ("the removed-section highlight is weak"). The one-line "(Section removed: X — N dishes)" notice (`FunctionPlanPrintView.jsx`, right next to `SubHead`'s own bold (`fontWeight: 700`) dept heading) explicitly set `fontWeight: 400` on itself — DOWN-weighting the one thing on the sheet most needing emphasis (a whole catalogue section, several dishes, gone from the menu) relative to the plain heading text sitting right next to it, and far less prominent than an ordinary per-dish "− dish" removal bullet shown elsewhere on the same sheet (bold, red). A kitchen team member skimming the printed sheet could easily miss it.
- **Fix**: changed `fontWeight: 400` to `fontWeight: 700`, matching the boldness already used for every other removal/addition indicator on this sheet. Everything else about the notice (italic, red `#B3281F`, the conditional amber `CHANGED_HILITE` overlay when a now-removed section's dish was present at the chef's last acknowledgement) is unchanged — this was a single targeted visual-weight fix, not a redesign of the notice.

## FP's "Menu matches the package exactly" message could be FALSE for a package with an empty flat dishes[] column (fixed 2026-11-22, client-only, no DB change)
- Fable audit item #6. `menuDiffByDept` (`EventMenuBuilderView.jsx`) gated its ENTIRE per-dept diff computation on `templateInfo.dishes.length === 0` (`templateInfo.dishes` = `MENU_PACKAGES[name]`, the package's flat legacy `dishes[]` column) — returning `{}` whenever that flat column was empty, even when the package's SECTIONS overlay (`MENU_PACKAGE_SECTIONS[name]`, the real, authoritative structure since V74) had genuine, non-empty dishes nested in sections/subsections. An empty `menuDiffByDept` makes `FunctionPlanPrintView.jsx` print "Menu matches the package exactly — no swaps or add-ons" — false: the diff never even ran, so nothing could ever show as added/removed/swapped regardless of what was actually selected for the event. `flattenSectionsToDishes` is supposed to keep the flat column in sync with the sections overlay on every package save, but a package managed purely through the Sections editor before that sync existed, or one whose flat column simply never got backfilled, can have a genuinely non-empty sections overlay while the flat column alone reads empty.
- **Fix**: new `pkgBaselineDishList` memo — prefers `templateInfo.dishes` when non-empty, else falls back to `flattenSectionsToDishes(MENU_PACKAGE_SECTIONS[name] || [])` (same helper `setPackageSections` already uses to keep the two in sync on save). `pkgBaselineDishNames` (already shared by `newSectionsByDept`) now derives from this list instead of `templateInfo.dishes` directly, and `menuDiffByDept`'s early-return guard and its "removed" loop both switched to it too. `pkgVer` is in the memo's deps (same mechanism `pkgCatalogueSectionIds` already relies on — `MENU_PACKAGE_SECTIONS` is a module-level object mutated in place, not React state, so a plain dep on it wouldn't trigger a re-render; `pkgVer` bumps on the `ambria:menu-packages-refreshed` event instead).
- **"Prefer flat when non-empty" confirmed as the safe direction**: every package save path in `MenuPackagesView.jsx` writes `dishes[]` and `sections` together from the same `flattenSectionsToDishes` call, so going forward the flat column is always at least as fresh as the sections overlay — the only way flat reads empty while sections has real dishes is the legacy/never-backfilled case this fix targets. This also flows through to fix a related symptom in `newSectionsByDept` for free (same shared `pkgBaselineDishNames`): a package-sections-only dish no longer gets wrongly reported as a new/ad-hoc addition just because the flat column didn't know about it.
- **Known, deliberately NOT fixed — the same root-cause gap exists separately in `loadPackageDefaults()`** (the "Load package defaults" button), which still gates directly on `templateInfo.dishes.length === 0`: a sections-only package still can't auto-seed any dishes for a brand-new event via that button. Different user action, not the FP print diff this audit item named — flagged for a future pass, not fixed here.

## "Add dish" could offer two visually-identical, functionally-redundant placement chips for the same section (fixed 2026-11-22, client-only, no DB change)
- Fable audit item #8 ("duplicate-looking placement chips (the input side)"). `MenuBuilderView.jsx`'s shared `ItemsTab` (used by both Proposals and the event menu builder) builds `placementOptions` — the section picker shown when adding a custom/existing dish — by listing the package's own pills (`groupedByCat`) first, then appending every catalogue section routed to this dept NOT already represented, deduped only by **id** (`seen[o.id]`). An UNLINKED, hand-built package section sharing its display NAME (not its id) with a real, separate catalogue section slipped past that id-only check and got offered as a second, visually identical chip — even though `pkgCatalogueSectionIds`' own `seedFor` (the FP diff's dept-routing resolver) already treats an unlinked top-level section's name match as THE SAME catalogue section elsewhere in this app (the "S5: unlinked same-name section" case from this session's earlier new-section-dept-routing work). Picking either chip produced the same place on the printed sheet, so the two were redundant, not a real choice — just confusing, with no way to tell them apart.
- **Fix**: `placementOptions` now also tracks each TOP-LEVEL pill's normalized name (`seenTopNames`) and skips a catalogue option whose label matches one, in addition to the existing id check. Name-fallback applies ONLY at the top level, matching `seedFor`'s own precedent exactly — a subsection's catalogue option label is always prefixed (`"— Name"`), never a bare name, so it can never collide with a top-level pill's name and was never intended to merge on name anyway.

## `itemsByDept`/`menuDiffByDept` never recomputed when a dish's placement-tag override changed (fixed 2026-11-22, client-only, no DB change)
- Fable audit item #10 ("stale deps on `itemsByDept` / `menuDiffByDept`"). Both memos (`EventMenuBuilderView.jsx`) call `effectiveDeptForDish`, which resolves through `sectionOverrideDept` (a per-event placement-tag override) as part of its precedence chain — but neither memo's dependency array listed it. Re-tagging a dish's placement (which changes `sectionOverrideDept`) didn't recompute `itemsByDept`/`menuDiffByDept` until some UNRELATED dependency happened to change and force a recompute, so the FP print's dept groupings (and everything downstream, including this session's own ack-diff placement signature) could silently keep showing a re-tagged dish under its OLD department for a while. `newSectionsByDept` (a third, sibling memo in the same file) already listed `sectionOverrideDept` correctly — this exact omission is also a repeat of a bug this codebase hit once before in a different function (`deptDishes`, see `useMenuItemGrouping.js`'s own header comment).
- **Fix**: added `sectionOverrideDept` to both memos' dependency arrays — a one-line addition each, no logic change. `menuDiffByDept`'s `removed` bucket doesn't itself call `effectiveDeptForDish` (a never-selected dish was never re-tagged via an event-specific override to begin with), but the memo as a whole still depends on it through the `added` bucket, so it belongs in the array regardless.

## Audit items #11 and #12 — user check-in resolved (2026-11-22)
- **#11 (silent baseline relocation)**: when a baseline package dish is moved to an ad-hoc new section via "Move to", the FP print shows zero diff indicator (`newSectionsByDept` deliberately skips it — "already in the package — relocated, not added"). **User decision: leave this silent** — a relocation isn't a menu change, so it shouldn't look like one on the printed sheet. No code change.
- **#12 (outsourced dishes aren't marked on the FP)**: a dish toggled "outsourced" (vendor-supplied, `events.outsourced_dishes`) printed exactly like any in-house dish, with nothing telling the kitchen it isn't theirs to prep. **User decision: fix it.**
  - **Fix**: `FunctionPlanPrintView.jsx` gained an `outsourcedSet` prop (the same `{dishName: true}` lookup `EventMenuBuilderView.jsx` already builds for the Items tab) and a helper, `outTag(name)`, appending a muted italic "(Outsourced)" tag next to a dish name. Applied at the 3 places a dish name actually prints: the package-diff "+" addition line (not "−" removals — a removed dish isn't being served either way, so marking it would be noise), the "(New X)" new-section addition list, and the no-package branch's plain dish bullet. Deliberately NOT applied in the whole-"Section removed" block (same reasoning as removals) nor in the "Menu matches the package exactly" summary path (that branch never renders per-dish bullets at all, regardless of outsourced status — a pre-existing structural limit of that print branch, not a gap this change could close).
  - **Caught by adversarial review — prototype-pollution-shaped false positive**: `outsourcedSet` is a plain `{}` object; a bare `outsourcedSet[name]` lookup would resolve a dish literally named `"constructor"`/`"toString"`/`"__proto__"` through `Object.prototype`'s own chain to a truthy inherited value, falsely tagging it "(Outsourced)" even though it was never toggled. Dish names are free text in the Dish Library, so not purely hypothetical. Fixed with `Object.prototype.hasOwnProperty.call(outsourcedSet, name)` instead of the bare lookup.

## Investigation 2's last item — orphaned kitchen_tracking rows on dish removal (fixed 2026-11-22, client-only, no DB change)
- Original audit finding (low real-world impact, fixed anyway at explicit user request after a scope check-in): removing a dish from an event's menu never cleared its `kitchen_tracking` row (keyed `evId|dishName`, holding ready/step progress) — locally or on the server. Re-adding the SAME dish to the SAME event later resurrected its old progress, looking like it had already been worked on.
- **Rejected approach — a reactive sweep in `App.jsx` comparing `kitchenTracking` against `events.menu`'s current contents**: this session's own item 18 proved `events.menu` can be transiently stale right after a package quick-start/switch (`event_items_initialized` true but the mirror not yet re-derived) — a sweep treating "not currently in `events.menu`" as "genuinely removed, safe to wipe" would risk destroying a chef's REAL in-progress data during exactly that known transient window, trading a low-impact stale-display bug for a real data-loss bug. Not used.
- **Fix actually shipped — clear at the exact moment of a DELIBERATE removal action**, not a reactive inference: new `clearDishEntryForRemoval(oldEntry)` in `kitchenDishKey.js` (reuses the existing `tombstoneAgainst` null-every-field logic against an empty fresh entry, plus explicitly nulls `mesaDone` too — `tombstoneAgainst`'s own caller, a day reset, must preserve `mesaDone` since other still-live functions share the combined bucket's D-1 state, but a dish leaving one event's menu entirely has nothing else writing to that event's own row). `EventMenuBuilderView.jsx` gained `kitchenTracking`/`setKitchenTracking` props (optional, defaulting to `null`/no-op) and a new `clearKitchenTrackingForRemovedDishes(names)`, called from `toggleDish` (only on `result.action === 'removed'`) and `removeWholeSection` (the real `names` array actually deleted from `event_items`), right after each one's existing `event_items`/`events.menu` mutation succeeds. Deliberately NOT gated on `isKitchenTrackedDish` — the clear is a no-op per-name anyway when no row exists, so unconditionally attempting it for every removed dish (even one now resolving to bev/frt) correctly also catches a row left over from BEFORE a past dept change. `removeAdHocSection` (a different function — clears a section-override TAG only, never actually removes the dish from `event_items`) is correctly untouched.
- **New write-access props threaded through 3 mount points** (`BookedFunctionsView.jsx`, `FunctionPlansHub.jsx`, `MenuPackagesView.jsx` — the 3 places `EventMenuBuilderView` is mounted with real edit capability), from the SAME top-level `kitchenTracking`/`setKitchenTracking` `App.jsx` already passes to `KitchenHub`/`TransportDispatch`/`DeptView`. **Deliberately NOT threaded to `PublicFPHub.jsx`** (the unauthenticated public FP link) — it mounts `EventMenuBuilderView` with `currentUser={null}`, `initialTab="fp"`, `autoOpenPrint={true}`, so it never renders the Items tab UI `toggleDish`/`removeWholeSection` live on, and the missing props make the clear a safe no-op even if that ever changed.
- **Confirmed safe by adversarial review**: the clear reaches the server through the ORDINARY `kitchenTracking` state diff → `kt_set_paths` sync effect already in `App.jsx` (no new/bypassing write path — `setKitchenTracking` is the exact same setter every other kitchen_tracking writer already uses), so it gets the same per-path, last-write-wins timestamp race safety as any other tablet's concurrent tap; the updater closure is a pure function of `prev` with no stale-closure risk across a StrictMode double-invoke or a rapid re-call. One pre-existing-and-unrelated nuance confirmed, not a bug from this change: `EventDayTab.jsx`'s COMBINED-view read folds every contributing function's own `mesaDone` onto the shared combined row with no exclusion, so if a dish removed from one function is still served by another the same day, that view's `mesaDone` display can transiently lag until `events`/`kitchen_tracking`'s own realtime echoes settle — self-correcting, not data loss, same class of brief lag this session's other kitchen_tracking fixes already accept.
- 4 new unit tests for `clearDishEntryForRemoval` in `kitchenDishKey.test.js` (217 tests, 8 files as of 2026-11-22) — this one is React-effect/prop-threading glue at the component layer (no test harness for that in this project), so coverage is on the pure helper function only, matching this session's established testing convention.

## CSV package import silently ignored its own section column, and clobbered an existing package's section ids/depts/subsections on re-import (fixed 2026-11-22, client-only, no DB change)
- Two separate, real bugs in `MenuPackagesView.jsx`'s `commitCsvImport` (bulk CSV import of `package,section,dish,type,sop_category,ops_item,qty_per_cover,hindi` rows into `menu_packages`), both found chasing down this session's last two flagged-but-unverified backlog items:
  1. **`dishes_master.section_id` was never written for a CSV-imported dish**, even though the CSV carries a `section`/`sop_category` column — a raw `supabase.from('dishes_master').insert({dish_name: name})` that bypassed `createCustomDishInLibrary` (the shared helper every OTHER "add a new dish" entry point uses — MenuEditor/EventMenuBuilderView/MenuBuilderView's own add-custom-dish flows) entirely, so this one path never got the fix item 1 earlier this session (`6e3a314`) gave every other path.
  2. **Re-importing a CSV into an ALREADY-EXISTING package wholesale-replaced its `sections` array with brand-new objects every time**: a fresh random id per section (stranding any `menu_section_overrides` pointing at the OLD id — same failure mode as the already-fixed "switching an event's package stranded dish tags" bug, `b4ab47a`, just triggered by a CSV re-import instead of a package switch), no `sales_dept` at all (silently resetting every section back to the 'kit' default on every re-import, undoing whatever an admin had picked via the package editor's own department selector), and no subsections (the CSV's flat per-dish schema has no column that could ever represent one, so they were deleted outright).
- **Fix**: new pure module `src/lib/csvImportSection.js`:
  - `buildCsvImportSections(csvRows, getExistingSections)` — groups CSV rows into per-package sections, matching each row's `section` text against the package's EXISTING sections (name match, case/whitespace-insensitive — grouped by the SAME normalized key, not the raw CSV text, see the adversarial-review note below) when the package already exists, carrying over that matched section's real `id`/`sales_dept`/`catalogue_section_id`/`subsections` verbatim — only the section's own direct `dishes` list (and `sop_category` if it was blank) gets rebuilt from the CSV. A brand-new package, or a section name with no existing match, still gets a fresh id defaulting to `sales_dept: 'kit'`, same as a manually-added section (`addSection`'s own default).
  - `resolveCsvCatalogueSectionId(row, catalogueSections)` — resolves a real `dish_catalogue_sections.id` by exact (case/whitespace-insensitive) name match, preferring `row.sop_category` then falling back to `row.section`; returns `null` (never guesses) when zero or more than one catalogue section matches a name — same "never guess" philosophy as `sectionDept.js`'s `resolveDeptForOverrideTarget`.
  - `commitCsvImport` now calls `buildCsvImportSections` instead of its own inline grouping loop, and calls `createCustomDishInLibrary(supabase, name, null, resolvedCatalogueSectionId)` per distinct dish (the FIRST CSV row seen for that name) instead of the raw insert — `catId` stays `null`, preserving the existing deferred "no SOP recipe yet — map later in Dish library" behavior for `sop`-type rows exactly as before. `openCsvImport` now also calls the existing, cached `loadCatalogueForPicker()` so `catalogueSections` is populated before import, wrapped in its own try/catch so a failure there never blocks the rest of the import (a dish just imports with no `section_id`, same as before this fix).
- **Caught by adversarial review — a real id collision from inconsistent CSV casing**: the first version grouped sections by the RAW `r.section` string, while the existing-section match was already case/whitespace-folded — so two rows spelling the same section differently in one CSV (`"Beverages"` / `"BEVERAGES"`, an easy manual-CSV-editing mistake) would each independently match the same existing section and get pushed as TWO separate objects sharing the identical `id`. Downstream this silently corrupts the package: duplicate React keys in the section list, and anything keyed by section id (`resolveDeptForOverrideTarget`'s own `.find`, the section-settings modal) only ever sees/affects the first of the pair, with the second orphaned but still rendered. **Fixed** by grouping on the same normalized key used for the existing-section match, not the raw text.
- **Confirmed correct, not changed**: `createCustomDishInLibrary`'s `isNewLocally` check (never overwrites an EXISTING dish's `section_id` — stays the Dish Library Sections editor's own job) and its FK-retry-without-section_id behavior both apply unchanged at this new call site; the untouched Hindi/inventory-store upsert steps, CSV export, template download, and the existing "REPLACES existing packages" confirm-dialog warning are all unaffected.
- 17 new unit tests in `src/lib/csvImportSection.test.js` (234 tests, 9 files as of 2026-11-22).

## The tea/coffee/ice-cream name-pin (pinnedDeptForDish) — confirmed intentional, not a bug (checked 2026-11-22, no code change)
- Flagged as an open question during this session's review passes: does hard-pinning any dish whose name contains "tea"/"coffee"/"ice cream" to Beverages, unconditionally — overriding ANY package section tag or per-event override that might say otherwise — risk being too broad, and was this actually considered by the original audit?
- **Checked, closed with no change**: `pinnedDeptForDish` (`salesConfig.js`) is checked FIRST, as the top of the real precedence chain, in every single department-resolution call site across the entire app — `eventItems.js`'s `resolveDeptForDish`/`buildEventDeptContext`, `useMenuItemGrouping.js` (5 call sites), `MenuBuilderPreview.jsx`, `ProposalsView.jsx`, `EventMenuBuilderView.jsx`, `kitchenDishKey.js` — all identically `pinnedDeptForDish(name) || <everything else>`. This is deliberate, pre-existing, uniformly-applied business logic (a dish whose name says it's a drink IS Beverages, full stop, regardless of how a package happens to file it), not something kitchenDishKey.js invented this session or an inconsistency anywhere else in the app. Nothing to fix.
- **This closes the entire backlog** from both Fable-model audits run this session (FP print-view diff logic; dish-section-tagging + kitchen_tracking) — every item has now been either shipped, resolved via explicit user decision (items #11/#12), or is this one.

## Every no_auto_select package dish was pre-selected the first time a NEW booking's Items tab was ever opened — two paths wrote a package's raw, unfiltered dish list straight into events.menu (fixed 2026-11-25, client-only, no DB change)
- User report: a "never auto-select here" (`MENU_PACKAGE_NO_AUTO_OVERRIDES`) dish — and every catalogue-level `no_auto_select`-flagged dish/section (Soup Station: pick 2-3 of 8-10) — showed up already selected the FIRST time Booked Functions' Items tab (`EventMenuBuilderView.jsx`) was opened for a brand-new event, despite the override being set correctly. Traced live via direct Supabase queries (not reasoning alone) to confirm the override data itself was correct before looking for the bug elsewhere.
- **Root cause**: `filterAutoSeedable` (`menuItemOps.js`) is the one shared gate for "should this dish be bulk-added as a package default" (dish-level `dishes_master.no_auto_select`, whole-section `dish_catalogue_sections.no_auto_select`, and the per-package override, in that precedence). Every path that's supposed to call it was already doing so correctly — EXCEPT two that wrote a package's COMPLETE RAW dish list (`MENU_PACKAGES[pkgName]`, unfiltered) straight into `events.menu` the moment a package gets assigned, never consulting it at all:
  1. `Dashboard.jsx`'s `saveForm()` (the Add/Edit Event modal) — picking a package for a new or edited event.
  2. `MenuPackagesView.jsx`'s `commitMenu` bulk-replace branch ("Quick start from package" in Kitchen's Build Menu tab, `delta.action==='package'`).
  For a brand-new event, `event_items` is empty and `event_items_initialized` is false — so `EventMenuBuilderView.jsx`'s own one-time `seedFromLegacyMenuIfNeeded` migration finds this non-empty `events.menu` and copies it VERBATIM into `event_items`, deliberately WITHOUT re-running `filterAutoSeedable` (its own comment: a non-empty legacy menu is assumed to be an already-curated, deliberate selection that must not be re-filtered — true for a genuinely hand-built pre-`event_items`-era menu, but not for a value either of these two paths had just written moments earlier, which nobody had curated at all). Fixed at the ORIGIN instead of touching that migration's own "don't re-filter a curated menu" assumption, which still holds for its real intended case.
- **Fix**: both call sites now run the package's dish list through `filterAutoSeedable(dishes, pkgName)` before writing it — `saveForm`/`commitMenu` both had to become `async function`s for the `await`. 9 new unit tests in `src/lib/menuItemOps.test.js` cover `filterAutoSeedable` itself directly (dish-level flag, whole-section flag, per-package override winning in both directions over either), with `./supabase.js`'s singleton `vi.mock`'d so these run deterministically with no real network call — the only test file in this project to mock that module; every other test either injects a fake client as a parameter (`createCustomDishInLibrary`) or avoids DB-touching functions entirely.
- **Caught by adversarial review — making `saveForm` async opened a real race window with no guard at all**: `filterAutoSeedable` does a genuine network round-trip, so the `await` is real latency, not a microtask tick — and the Add/Edit Event modal had no "saving in progress" state of any kind. Three concrete failure scenarios during that window, all now-possible for the first time (the function used to run fully synchronously): (1) a double-click on Save created two duplicate events / double-fired `syncEventItemsOnPackageChange`; (2) clicking Cancel immediately after Save did NOT actually cancel anything — the in-flight save's closure kept going and still wrote the event once the network call resolved; (3) worse, if the user then reopened the modal for a DIFFERENT event while the first save was still pending, the original call's unconditional trailing `setShowForm(false)`/`setEditId(null)`/etc. fired after the NEW modal was already open, silently closing it and discarding whatever the user had just started typing for it.
  - **Fix**: new `savingEvent` state, set before the `await` and cleared in `finally`. The guard blocks re-entry at the top of `saveForm` (stops double-submit), and BOTH the Cancel button and the × close button are disabled while `savingEvent` is true (stops the fake-cancel and, by extension, the clobbered-reopen — the modal simply cannot be left until the in-flight save settles, so there's no way to get back to a different event's "Edit" button in the meantime; the modal's own backdrop has no click-to-close handler, so these two buttons were the only two closing paths that needed guarding).
  - `commitMenu` (the other newly-async function) did NOT need an analogous guard — confirmed by the same review: it has no unconditional trailing state reset, its `dishes` reassignment happens before every place that reads it, and `revertMenu`'s closure only captures snapshotted `prevMenu`/`prevMenuPackage`/`prevOverrides`, untouched by the reassignment's timing.
- **Noted, not changed**: `saveMenu` (`MenuPackagesView.jsx`)'s "did this just drop the menu by a lot, are you sure" confirm-dialog threshold check runs against the RAW, pre-filter dish count (MenuEditor always hands it the unfiltered list) — after this fix, the actually-committed (filtered) result can be smaller than what that check evaluated, so a package quick-start that drops a lot of dishes purely via no-auto-select filtering (not user intent) could skip a confirm dialog it might arguably deserve. Pre-existing approximation, not introduced by this fix, left as-is.

## Two more no-auto-select raw-list instances (ODC's embedded Menu Editor), and "Load defaults" redesigned as a true reset (fixed 2026-11-25, client-only, no DB change)
- Chasing the same user report further (live-data diagnosis kept moving because the user was actively testing/switching packages on the SAME event mid-investigation — confirmed by re-querying and watching `events.menu_package` change out from under the first query) surfaced two MORE places with the exact same bug class as the Dashboard.jsx/MenuPackagesView.jsx fixes above, both specific to `Dashboard.jsx`'s embedded `MenuEditor` for ODC (Outdoor Catering) events:
  1. Opening the editor for the first time with a package already picked in the form used to seed `menuEditorDishes` with `MENU_PACKAGES[form.menuPackage]` verbatim.
  2. `<MenuEditor onChange={setMenuEditorDishes}>` — wiring `onChange` straight to a plain `useState` setter silently dropped the second `delta` argument MenuEditor's own "Quick start from package" button passes (`onChange(rawDishes, {action:'package', pkgName})`), so the raw list landed in state with zero filtering, unlike `MenuPackagesView.jsx`'s `commitMenu` (which branches on `delta.action` and was already fixed).
  - **Fix**: new `async function openMenuEditor()` and `async function onMenuEditorChange(dishes, delta)` in `Dashboard.jsx`, both calling `filterAutoSeedable` the same way the other fixed call sites do (`onMenuEditorChange` only filters the `'package'`-action delta — `'add'`/`'remove'`/clear deltas correctly stay unfiltered, same reasoning as everywhere else: a human's deliberate single pick must never be blocked by `no_auto_select`).
  - **Caught by adversarial review — a new async race, same class as `saveForm`'s own race fixed earlier this session**: both new functions do a real network round-trip with no guard. A second click on "Open menu editor" while the first was still pending could re-enter it; worse, confirming a package quick-start and then clicking a single dish add/remove DURING that pending filter would land synchronously first, only to be silently clobbered the instant the package filter's `await` resolved and overwrote `menuEditorDishes` wholesale — an interleaving impossible before this fix (every `onChange` call used to run fully synchronously end to end).
    - **Fix**: new `menuEditorBusy` state guards both functions (checked at entry, set before the `await`, cleared in `finally`), the outer "Open/Close menu editor" toggle button is disabled while busy, and `MenuEditor.jsx` gained a new `disabled` prop (distinct from its existing `locked` prop — `locked` shows a "this event's FP is locked" alert for a real business-rule lock; `disabled` silently no-ops every mutation entry point — `addDish`/`removeDish`/`toggleOutsourced`/`openCustomModal`/`selectPackage`/`confirmDestructive` — with no alert, for exactly this kind of "caller is mid-await on its own onChange handler" window), passed as `disabled={menuEditorBusy}`.
- **User-requested behavior change: "Load defaults" is now a true RESET, not purely additive.** Previously `loadPackageDefaultItems` (`menuItemOps.js`, shared by `EventMenuBuilderView.jsx`'s Items-tab button and `MenuBuilderView.jsx`'s Proposals equivalent) only ever ADDED missing package-default dishes, never removing anything — explicitly documented that way in its own old comment. User asked for it to reset the menu to defaults AND un-select any add-ons. Rewritten to compute `toRemove` (anything currently selected that is NOT in the new filtered default set — this covers both a genuine custom add-on and a package dish a human had individually picked from a no-auto-select section, e.g. one specific Soup-Station soup) and delete those rows, in addition to the existing add-missing logic — final selection becomes EXACTLY the filtered default set. A dish already selected AND already wanted is left completely untouched (its row/ordering/`foc` flag etc. survive unreinserted).
  - Both callers updated to confirm first (`window.confirm`, matching this exact file's own existing `removeWholeSection` precedent — NOT a new custom modal, and deliberately not `MenuEditor.jsx`'s in-app modal pattern, which that file's own V80 comment says exists specifically because `window.confirm()` is unreliable in ITS runtime/embedding context, not a blanket ban across the whole app) ONLY when `toRemove.length > 0` — a purely additive run (the common case, nothing to remove) skips the confirm entirely, unchanged ergonomics from before.
  - `EventMenuBuilderView.jsx`'s version additionally runs the SAME kitchen-tracking cleanup this session's "orphaned kitchen_tracking rows on dish removal" fix already established (`mirrorKitchenMenu` when anything removed/added is kitchen-tracked, `clearKitchenTrackingForRemovedDishes(result.removed)`) — without this, the new reset path would have reopened the exact bug that fix just closed, via a different door. `MenuBuilderView.jsx`'s Proposals equivalent doesn't need this (proposals aren't booked events yet, no `kitchen_tracking` rows exist for them).
  - Confirmed by adversarial review: `kept`/`toRemove`/`toAdd` partition `dishItems` exhaustively with no overlap (computed from the ORIGINAL array before the delete runs, so DB round-trip timing can't affect it); the delete's `.eq(itemsFk, itemsFkValue).in('dish_name', toRemove)` scoping matches the pre-existing `toggleDishItem`/`removeSectionItems` pattern exactly, correctly scoped per event/proposal; `result.added` (row objects) vs `result.removed` (name strings) are never conflated in either caller.
- 15 new unit tests added across `src/lib/menuItemOps.test.js`'s existing `filterAutoSeedable` describe block plus a new `loadPackageDefaultItems` one (249 tests, 10 files as of 2026-11-25) — the reset's add+remove-in-one-call case, the purely-additive no-op case (zero DB calls at all), removing a custom add-on vs. removing an individually-picked no-auto-select package dish, and the parent-table "initialized" flag update, all against the same mocked `supabase` singleton (extended with `.delete().eq().in()`/`.insert().select()`/`.update().eq()` chains) — no real network call.

## Package switch via the Dashboard Add/Edit Event form had the SAME "old package stuff bleeds into the new package" bug (fixed 2026-11-25, client-only, no DB change)
- Follow-up user report, right after the "Load defaults" reset fix above: `Dashboard.jsx`'s `syncEventItemsOnPackageChange` (runs when an existing event's package is switched) used to only ever remove a dish that was EXCLUSIVELY part of the OLD package's raw dish list and absent from the NEW one — so a dish common to both packages' raw lists always survived a switch, even a no-auto-select pick (Soup-Station-style) the new package never actually defaults to on its own. Same bug class as everywhere else this session, reached through yet another door.
- **Fix**: the function now computes `seedDishes = await filterAutoSeedable(newDishes, nextPkgName)` (the NEW package's own filtered defaults) and treats that as the target state for the package-sourced portion of the menu. The decision logic itself was pulled out as a new pure, exported `computePackageSwitchDiff(existingItems, seedDishes)` in `menuItemOps.js` (same reasoning as `loadPackageDefaultItems`'s own extraction — independently testable without mocking DB I/O): `toRemove` is every non-add-on (`!r.is_addon`, treating `null`/`undefined` the same as `false`) existing item not in `seedDishes`; `toAdd` is every seed dish not already present at all (add-on or not — never duplicates an existing add-on row under the same name). A genuine custom add-on (`is_addon:true`) is always preserved across a switch, unchanged from before — it was never "old package stuff" to begin with. The `event_items` query was widened from `select('dish_name')` to `select('dish_name,is_addon')` to make the distinction.
- **Also closed a related, pre-existing gap in the same change**: this function never cleaned up `kitchen_tracking` rows for dishes it removed — the exact "orphaned rows on dish removal" bug class this session already fixed in `EventMenuBuilderView.jsx` (`toggleDish`/`removeWholeSection`/`loadPackageDefaults`), just never reached here since `Dashboard.jsx` had no `setKitchenTracking` prop at all before now. Since the reseed fix above WIDENS how often this path actually removes dishes, left alone it would have widened that gap's surface area too. **Fix**: `clearKitchenTrackingForRemovedDishes` was pulled OUT of `EventMenuBuilderView.jsx` (a private local function closing over component state) into a new shared, pure export in `kitchenDishKey.js` — `clearKitchenTrackingForRemovedDishes(setKitchenTracking, eventId, names)` — with `EventMenuBuilderView.jsx`'s own local function of the same name reduced to a one-line delegating wrapper (verified by adversarial review to produce byte-for-byte identical guard/early-return behavior at every one of its existing call sites). `setKitchenTracking` threaded as a new prop: `Dashboard`'s own signature, and BOTH of its two mount points in `App.jsx`.
- Confirmed by adversarial review: no duplicate-insert/unique-constraint risk (`toAdd` correctly excludes anything already present as an add-on); `remainingCount`'s ordering formula is unchanged from before (pre-existing, not a regression); the FP-lock early-return and `menu_section_overrides` stale-id pruning still run in the same order, untouched.
- **A real test gap the SAME adversarial review flagged, and then closed**: the decision logic had no test coverage at all before being extracted — `computePackageSwitchDiff` now has its own describe block in `menuItemOps.test.js`, including a test that exercises the exact bleed scenario END TO END (a dish flagged `no_auto_select_overrides:true` for the new package, run through the REAL `filterAutoSeedable`, then fed into `computePackageSwitchDiff` to confirm it lands in `toRemove`, not silently kept). 6 more unit tests for the newly-shared `clearKitchenTrackingForRemovedDishes` added to `kitchenDishKey.test.js` (its own reference-equality "no-op returns the exact same prev" case, multi-dish clears, cross-event isolation, and guard conditions) — this function had NEVER been unit tested before either, since it used to be a private, untested local function in a component with no test harness.
- 21 new tests in `menuItemOps.test.js`, 6 new in `kitchenDishKey.test.js` (260 tests, 10 files as of 2026-11-25).

## "Menu section" pill pickers flattened every package section AND every subsection into one confusing row — now two-level (fixed 2026-11-25, UI-only, no logic/test change)
- User feedback via screenshot: the "Menu section" chip picker (shown when adding a custom dish, merging an "Add section from library" pill, or picking a catalogue section to add) rendered every top-level section AND every one of its subsections as one long flat row of pills, subsection labels written as a full breadcrumb ("Beverages › Aerated Drinks") — hard to scan, and visually indistinguishable from a top-level pill.
- **Fix**: new shared `SectionPillPicker` (`src/components/SectionPillPicker.jsx`) renders only top-level sections first; clicking one selects it AND (if it has subsections) reveals them as a second row of short, un-prefixed pills below — picking a subsection switches the selection to it, re-clicking the open top pill while already on "general" collapses the subsection row. Replaces 3 flat `.map` pill renders: `MenuEditor.jsx`'s custom-dish "Menu section" picker (built from `MENU_PACKAGE_SECTIONS[pkgName]`'s own existing `subsections` tree — no new data needed), and `MenuBuilderView.jsx`'s "Menu section" (Add dish modal) + "Catalogue section" / "Merge into existing menu section" (Add section modal) pickers — the latter two needed a new tree-shaped `catalogueSectionGroups` alongside the pre-existing flat `catalogueSectionOptions` in `useMenuItemGrouping.js` (kept both; the flat form is still used for id/label lookups elsewhere), threaded through `ItemsTab` the same way `catalogueSectionOptions` already was (both `MenuBuilderView.jsx`'s own call site and `EventMenuBuilderView.jsx`'s, since it reuses the same `ItemsTab`).
- Purely a render/UX change — no selection logic, onChange contracts, or underlying data changed (the "Catalogue section" picker still auto-defaults `targetId` to match `catSectionId` on pick, same as before); no new unit tests needed (nothing here is pure-function logic the existing suite's pattern covers — this project's tests are logic-only, no component-rendering harness).

## "Add section from library"'s merge step removed; an already-selected dish can now be moved to a different menu section (fixed 2026-11-25, client-only, no DB change)
- Two follow-up user requests on the section-picker UI fix above:
  1. The "Merge into existing menu section" picker in the "Add section from library" modal (`MenuBuilderView.jsx`) was unnecessary — a catalogue section added this way is already persisted as its own real `dish_catalogue_sections` row (via the "Or create a new section" sub-flow, or just by being a real catalogue section already), so it's always available as its own pill in any future menu regardless. Removed the whole picker + its explanatory copy; `pendingSection.targetId` is still always auto-set equal to `catSectionId` by the existing click handlers (never overridden now), so `confirmAddSection`'s required-field guard is unaffected — every "add section" now always creates its own new pill, never folds into an existing one.
  2. A dish that's already SELECTED in this menu under its native catalogue section (e.g. Steam Rice, native section Rice Factory) couldn't be moved to a different menu-section pill for this one event (e.g. a newly-made "Driver Food" section) — searching for it in the "Add dish" modal used to just no-op silently (disabled button, modal closed on click) since the code assumed "already selected" meant "nothing to do." This conflated two different things: the dish's GLOBAL catalogue home (`dishes_master.section_id`, one per dish, shared everywhere) vs. its per-event DISPLAY section (`sectionOverrides`/`menu_section_overrides`, already overridable — this is exactly what the "Menu section" picker next to it already writes for a NOT-yet-selected dish).
  - **Fix**: new `alreadySelected` branch in `ItemsTab`'s shared `confirmCustom` (`MenuBuilderView.jsx`, used by both Proposals and Booked Functions via its `EventMenuBuilderView.jsx` import) — picking a Menu section pill for an already-selected matched dish now calls a new `onRetagDish(name, sectionId)` prop instead of re-adding it. Wired to the pre-existing `saveSectionOverride(dishName, sectionId)` function each file already has (same one `addCustomDish`/`addExistingDish` call) — writes `menu_section_overrides` only, never touches `event_items`/`proposal_items`, so there's no duplicate-insert/unique-constraint risk. The dish's catalogue section_id is untouched (this is a per-event retag, same as the pre-existing per-dish "section" `<select>` MenuEditor.jsx already has for Extras-grouped dishes — not a new mechanism, just a new entry point into it).
  - Confirmed by adversarial review: `selectedSet`/`allDishes` (used to compute `alreadySelected`) are both built from the FULL dish list (not dept-filtered), so switching dept tabs can't cause a stale/wrong read; failure surfaces via the existing `sayFail` toast, same as every other action in this modal; non-`alreadySelected` paths (new dish, existing-but-unselected dish) are byte-for-byte unchanged aside from the old inline no-op check being replaced; Proposals and Booked Functions each pass their own `saveSectionOverride` closure (own `sectionOverrides` state), no cross-contamination. One nit the review flagged and this fix also closed: the confirm button's `disabled` check now also requires `onRetagDish` to be present (matching the runtime guard inside `confirmCustom` itself), so a future caller of `ItemsTab` that forgot to pass it would get a disabled button instead of a silent no-op click.
- No new unit tests (component/JSX logic only, no new pure functions — matches this fix's own prior precedent).
