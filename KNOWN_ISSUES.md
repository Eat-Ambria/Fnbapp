# KNOWN_ISSUES.md — Ambria FnB Operations

Tracks findings from the 2026-10-16 "edit it in one screen, does it reach
everywhere else" audit: what was found, what got fixed, and what's
deliberately left alone for now. Read this before touching menu-package
propagation, dish categorization, role/screen permissions, or Transport
dispatch status — the fixes below assume you understand why they exist.

---

## Fixed 2026-10-16

**Menu Packages' "Quick start from package" silently desynced `menu_package`
from the actual menu.** `MenuPackagesView.jsx`'s Build Menu tab lets an admin
switch an already-booked event to an entirely different package in one
click. The resulting dish list (`events.menu`) and `event_items` were
reconciled correctly, but `events.menu_package` — the column Booked
Functions reads directly to show the package label — was never touched,
because `MenuEditor.jsx`'s `selectPackage`/`confirmDestructive` called
`onChange(dishes)` with no indication a *package* (not a single dish) had
changed. `commitMenu` had nothing to tell it `menuPackage` itself needed
updating, so App.jsx's `setEvents` diff never saw that column change and
never persisted it — Booked Functions kept showing the old package name
forever, surviving refreshes, even though the dishes underneath had already
moved to the new package. Fixed by having `selectPackage`/`confirmDestructive`
pass `{action:'package', pkgName}` through `onChange`, and `commitMenu` now
updates local `menuPackage` alongside `menu` when it sees that delta so the
existing diff-and-persist path picks it up. Single dish add/remove deltas
are unaffected — those are correctly meant to keep the base package name
unchanged (see the comment above `commitMenu`).

**Store's shopping-list ignored the chef's yield-multiplier.**
`StoreModule.jsx`'s `buildEventBags()` now scales its effective pax by
`ev.yield_multiplier` before computing any ingredient quantity (same formula
Kitchen Hub/Event Day use for their own no-base-yield fallback:
`Math.round(evPax * mult)`). Before this, scaling a dish up/down in Kitchen
Hub's Planning tab had zero effect on what Store ordered.

**Transport vehicle dispatch status was never persisted.**
Planning→Loaded→Dispatched→At Venue→Unloaded, driver, and departure time used
to live in plain `useState` with no Supabase write at all — a refresh or a
second tablet silently reset everything to "Planning". Now backed by
`transport_dispatch_assignments` (migration
`20261016000000_transport_dispatch_assignments.sql`), with its own realtime
subscription inside `TransportDispatch.jsx`. Also fixed in passing: the
stored status value used to be `T2("Planning")` (translated text) instead of
the plain English key every comparison in the file actually checks against —
harmless only because the UI defaults to English; would have silently broken
every status comparison the moment someone used this screen in Hindi.

**Revoking a role's screen access didn't take effect for anyone already logged in.**
Access Manager's Manage Roles / Manage Screens writes were never pushed to
other open sessions — `role_definitions`/`screen_definitions` had no realtime
subscription (unlike `staff`, `events`, etc.). App.jsx now subscribes to both
and re-hydrates `PRESET_ROLES`/`SCREEN_PERMISSIONS` on any change, with a
`permsTick` state bump to force the re-render `canAccessScreen`/`NAV_ITEMS`
need to actually reflect it.

**A dish explicitly marked "no SOP needed" could still get miscategorized.**
`getCatIdForDish` (src/data/recipeData.js) now checks `isDishNoSopMarked`
before falling into the fuzzy exact/substring/normalized match against
`RECIPE_DB` — the same guard `findRecipeForDish` already had, for the same
reason (a short dish name can substring-match an unrelated recipe, e.g. "Tea"
⊂ "S-tea-med Chicken Dimsum").

**Dish category/store-mapping/name-map/Hindi-override edits only reached the editing tab.**
`DISH_CAT_MAP`, `DISH_NAME_MAP`, `DISH_HINDI_MAP`, `DISH_MASTER`,
`DISH_STORE_MAP` (all in recipeData.js) were boot-time snapshots with no
realtime sync, unlike `RECIPE_DB`/`MENU_PACKAGES` which already had it. Added
`subscribeDishMetaRealtime()`, called alongside `subscribeRecipeRealtime()` at
boot. Any already-open Kitchen Hub/Store/DeptView session now picks up a
recategorization or re-mapping live instead of cooking/ordering against a
stale category for the rest of the shift.

**Transport's own dish-list filter was missing the Beverages exclusion.**
`TransportDispatch.jsx`'s copy of `menuArr()` didn't filter out
tea/coffee/ice-cream via `pinnedDeptForDish`, unlike the identical function in
`KitchenHub.jsx`/`EventDayTab.jsx` — a real, found instance of the
"triplicated function, one copy missed a fix" risk already flagged below.

**Booked Functions had no realtime at all.**
`BookedFunctionsView.jsx` fetched `events`/`event_function_plans` once on
mount. Any menu/package/FP-lock change made elsewhere went unnoticed until
you navigated away and back. Now subscribes to both tables and refetches on
any change.

**`sectionOverrides` in both menu builders was a one-time snapshot.**
`EventMenuBuilderView.jsx` and `MenuBuilderView.jsx` each initialized
`sectionOverrides` from `event`/`proposal.menu_section_overrides` once via
`useState`, with nothing keyed on `event.id`/`proposal.id` to refresh it if
the component were ever reused for a different record. Added a `useEffect`
keyed on the id to reset it. **Not fixed, left as a known gap:** the *parent*
(`BookedFunctionsView.jsx`) doesn't actually keep the `event` object it hands
to the open modal (`menuBuilderEvent`) in sync with its own now-realtime
`events` list — so this fix protects against component reuse, but an
already-open Menu Builder modal still won't pick up an external
`menu_section_overrides` change live. Wiring that up means deciding what
happens if the admin has unsaved local edits when a fresher `event` arrives —
a bigger, deliberately out-of-scope change.

**Dept-resolution logic was hand-duplicated.**
`EventMenuBuilderView.jsx`'s `effectiveDeptForDish` and
`src/lib/eventItems.js`'s `resolveDeptForDish` were two copies of the exact
same precedence chain (`pinnedDeptForDish → sectionOverrideDept →
dishNameToPkgDept → catalogueDept → metaDept → DEFAULT_DEPT`), confirmed
identical at audit time but with nothing enforcing that. `resolveDeptForDish`
is now exported and `effectiveDeptForDish` delegates to it instead of
maintaining its own copy.

**Vendor Directory removed entirely** (component, nav entry, screen
permission, DB `screen_definitions` row). It never persisted anything — pure
hardcoded local state; add/edit/delete a vendor was invisible to everyone
else and lost on refresh. If a real vendor directory is wanted later, build
it against a Supabase table from the start.

**Attendance/leave tracking removed entirely.** This app no longer does
attendance. Removed: `leaves` state/load/realtime/upsert in App.jsx, the
"My Leaves" tab + leave-balance tile in `StaffView.jsx`, the
pending-leave-count badge/bell in App.jsx's nav and alerts bar, and
TeamHub.jsx's leave-derived "Coverage Alerts" banner (which only existed
*because* of leave data — removing leaves removes that staffing-shortage
warning too; nothing else replaces it). `team.leave_request`/
`team.leave_approve` permissions removed from `permissions.js` and from any
already-customized `role_definitions` DB rows (migration
`20261016010000_remove_vendors_and_leave_perms.sql`). Actual attendance/kiosk
code (a `KioskAttendance` component, daily-wage calculation) was already gone
before this — confirmed by repo-wide search, only dead strings/comments
referenced it (see below).

---

## Deliberately NOT done (and why)

**Orphaned Hindi translation strings for Attendance/Kiosk/Daily Wages.**
`src/data/translations.js`'s `HI` dict still has ~20 scattered key/value
pairs like `"Attendance":"उपस्थिति"`, `"Launch Kiosk":"किओस्क खोलें"`, several
sharing a source line with other, still-live keys. These are completely
inert — nothing calls `T("Attendance", ...)` anymore, so they're dead weight,
not a bug. Left alone because bulk-editing a dictionary file where dead and
live keys share lines is more risk (accidentally deleting a live translation)
than reward (a few dozen unused object entries). Safe to clean up in a
dedicated pass if someone wants to; search for `Attendance|Kiosk|Daily Wage`
case-insensitively in that file.

**`NAV_ADMIN`/`NAV` in `src/data/constants.js` are dead code.** Confirmed
unused anywhere in the app (superseded by the DB-backed `NAV_ITEMS` system in
`permissions.js`). Only touched the one line reading "Team & Attendance" →
"Team" since it was directly relevant; didn't delete the dead array itself —
out of scope for this pass.

**`EMPLOYEE_DB_INIT` (`src/data/staffData.js`) is `[]`.** App.jsx's boot
effect does `EMPLOYEE_DB_INIT.find(e => e.staff_id==='AM001')` to idempotently
re-seed AM001 into Supabase on every load — with an empty array this always
finds nothing, so that seed step is silently a no-op. Not an active bug
(AM001 already exists in the live `staff` table from however the project was
first set up), but it means a *genuinely fresh* database would boot with no
admin account at all. Worth either restoring a one-row `EMPLOYEE_DB_INIT` or
removing the now-dead seed call — not done here since it doesn't affect the
running app today and wasn't part of what was asked.

**`MenuBuilderView.jsx` vs `EventMenuBuilderView.jsx` grouping/mutation duplication.**
A separate, larger refactor plan exists for this (unifying the dish-grouping
`useMemo` chains and the add/remove/toggle mutation ops between Proposals and
Booked Functions' menu builders). `src/utils/useMenuItemGrouping.js` and
`src/lib/menuItemOps.js` already exist as the shared layer this plan called
for — the dept-resolution duplication fixed today was one specific piece of
that same disease, not the whole plan. The grouping/mutation unification
itself is still open; ask whoever owns that plan before assuming it's done.

**`menuArr()` is still triplicated** across `KitchenHub.jsx`, `EventDayTab.jsx`,
`TransportDispatch.jsx` (plus a near-identical shape in `StoreModule.jsx`'s
`buildEventBags`). Today's fix (the missing Beverages filter in Transport's
copy) closed one divergence; the underlying duplication — and the risk of a
future exclusion rule landing in one copy and not the others — remains. A
shared `menuArr(ev)` helper in a lib file would remove this permanently; not
done here since it touches four files' worth of call sites for a fix whose
immediate problem (the missing filter) was already narrow.

---

## How to spot this class of bug yourself

Ask two questions whenever a change doesn't show up somewhere it should:
1. **Does the target screen have a realtime subscription for the table that
   changed, or does it fetch once on mount?** (`BookedFunctionsView.jsx` and
   `TransportDispatch.jsx` were both the second kind before today.)
2. **Does the target screen read from the same column/table the edit wrote
   to, or from a derived mirror/cache?** (`events.menu_package` vs
   `event_items`; `DISH_CAT_MAP` vs the `dish_categories` table before its
   realtime existed.)

If the answer to either is "no live connection" or "different source," that's
this bug class — not a one-off.
