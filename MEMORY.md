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
| **`kitchenTracking` localStorage has no prune** | It grows every day. On quota exhaustion the write fails silently (it is caught) and persistence quietly stops. `transportQueue` already prunes by date; this should too. |
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
- **Known, separate, pre-existing bug this review surfaced but did NOT fix (same bug class, different code path)**: the DEPARTMENT-routing lookups (`useMenuItemGrouping.js`'s `sectionOverrideDept` ~line 210-223, and `src/lib/eventItems.js`'s `deptForOverrideTarget` ~line 36-47) ALSO only check top-level package sections for an override target, with no subsection flattening — a dish overridden directly to a subsection with its own distinct `sales_dept` gets counted and mirrored to Kitchen/Ops under the wrong department. This predates this session's fix and needs its own separate pass; add to the open-items backlog.
