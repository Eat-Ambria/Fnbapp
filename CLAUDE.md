# CLAUDE.md — Ambria FnB Operations App

## READ THIS FIRST — EVERY SESSION

This is the project memory for Claude Code. Read this entire file
before making ANY changes to the codebase.

**ALSO READ `MEMORY.md`** in this folder. This file holds the project's standing
rules; `MEMORY.md` holds the change log — what was changed, why, the root causes
of bugs already fixed, and a list of traps in this codebase that have each cost
real debugging time (template-literal backticks in `theme.js`, JSX comments in JS
slots, `!important` and inline styles, container queries, portalled CSS scope).
Read it before editing `theme.js`, `KitchenUI.jsx`, `EventDayTab.jsx` or the
kitchen-tracking state, and append to it when you make a non-obvious change.

---

## CRITICAL RULES

1. **The app is "Ambria FnB Operations" — NOT "Ambria Work Force"**
   - If you see "Work Force" or "Workforce" ANYWHERE in the code — it is WRONG
   - The correct name is: Ambria FnB Operations
   - The subtitle is: F&B Kitchen Operations
   - The company is: Get Your Venue Events Pvt Ltd (Ambria Cuisines)

2. **The repo is Fnbapp — NOT Fnpapp**
   - GitHub: https://github.com/Eat-Ambria/Fnbapp
   - Live URL: https://Eat-Ambria.github.io/Fnbapp/
   - vite.config.js MUST have: base: '/Fnbapp/'
   - NEVER use /Fnpapp/ — that is wrong

3. **App.jsx is the shell/router (~1600 lines); screens live in src/components/*.jsx**
   - This was a single ~9400-line file long ago — it has since been split out.
   - Do NOT assume App.jsx holds a screen's logic; find the matching component
     in src/components/ instead (KitchenHub.jsx, StoreModule.jsx, Dashboard.jsx...).
   - App.jsx still owns top-level state (events, empDb, kitchenTracking,
     transportQueue), Supabase boot-load, and realtime subscriptions — screens
     receive that state as props.

4. **PIN login MUST read from live empDb state — NEVER from a stale local copy**
   - EMPLOYEE_DB_INIT (src/data/staffData.js) is static seed data — used ONLY
     as (a) the useState fallback before Supabase loads, and (b) a gap-filler
     for any staff id Supabase doesn't have (see App.jsx's `initOnly` merge).
   - empDb is the live state, backed by the Supabase `staff` table and kept
     current via a realtime subscription (dbSubscribe('staff', ...) in
     App.jsx) — NOT by window.storage/localStorage. A PIN or permission change
     reaches every open session without a reload.
   - LoginScreen receives empDb as a prop; its PIN check is
     safeArr(empDb).find(...).
   - There is no separate kiosk/attendance screen in the current codebase.

5. **empDb persistence chain:**
   App() useState → initializes from EMPLOYEE_DB_INIT (pre-load fallback only)
   App() boot load → dbLoad('staff', EMPLOYEE_DB_INIT), merges in any
     EMPLOYEE_DB_INIT entries Supabase doesn't have
   Access Manager / Team edits → write straight to the `staff` table
   App()'s `staff` realtime subscription → patches empDb AND, if the changed
     row is the logged-in device's own id, currentUser too — so a role/PIN
     change reaches an already-open session live
   LoginScreen → reads empDb prop → uses live PIN data

6. **Dates MUST use localDateStr() — NEVER .toISOString()**
   - .toISOString() causes UTC timezone shift in India (IST = UTC+5:30)
   - localDateStr(d) builds YYYY-MM-DD from local year/month/day
   - const TODAY = localDateStr(new Date())
   - grep "toISOString" src/App.jsx should return NOTHING

---

## PROJECT STRUCTURE

Fnbapp/
├── CLAUDE.md              ← THIS FILE (read every session)
├── index.html
├── vite.config.js         ← base: '/Fnbapp/'
├── package.json
├── .env.local             ← Supabase keys (gitignored)
├── .env.example
├── .gitignore
├── .github/workflows/
│   └── deploy.yml         ← GitHub Pages deploy on push to main
└── src/
    ├── App.jsx            ← Shell/router + top-level state + boot load + realtime (~1600 lines)
    ├── main.jsx           ← just renders App
    ├── index.css          ← EMPTY (app injects own styles)
    ├── components/        ← one file per screen (KitchenHub.jsx, StoreModule.jsx, Dashboard.jsx, TeamHub.jsx, ...)
    ├── data/               ← recipeData.js, permissions.js, menuPackages.js, translations.js, constants.js, salesConfig.js
    └── lib/                ← supabase.js, db.js (dbLoad/dbUpsert/dbSubscribe), eventItems.js, dbConfig.js, menuItemOps.js

---

## DEPLOY WORKFLOW

Every change follows this pattern:
npm run build
git add .
git commit -m "description"
git push origin main

Live at: https://Eat-Ambria.github.io/Fnbapp/

---

## KEY PEOPLE

AM001 | Abhi | Admin (Efficiency Manager) | Management | PIN: 0000

All other staff are added by Abhi via Access Manager.
EMPLOYEE_DB_INIT (src/data/staffData.js) is currently an empty array `[]` —
all staff, including AM001, live only in the Supabase `staff` table now. See
KNOWN_ISSUES.md for a note on what that means for App.jsx's AM001 boot-seed.

---

## APP MODULES (one component per screen, see src/components/)

1. Dashboard (Dashboard.jsx) — KPI tiles, upcoming events, event edit modal
2. Kitchen Hub (KitchenHub.jsx) — Event Day/Prep Day/SOPs/Planning/Analytics/Closing
3. Store and Inventory (StoreModule.jsx) — barcode scan, smart issue, auto-demand
4. Transport & Dispatch (TransportDispatch.jsx) — vehicle assignment, dispatch status
5. Team (TeamHub.jsx) — staff directory, roles, PINs, outside-vendor booking.
   No attendance or leave tracking — removed 2026-10-16, this app no longer
   does attendance.
6. Menu Packages (MenuPackagesView.jsx) / Proposals (ProposalsView.jsx) /
   Booked Functions (BookedFunctionsView.jsx + EventMenuBuilderView.jsx) —
   package, pre-booking draft, and post-booking per-dish/dept menu editing.
   event_items is the source of truth once a function's Items tab has been
   opened; events.menu/menu_package is a Kitchen-only mirror kept in sync
   by src/lib/eventItems.js's syncAllKitchenMenuMirrors (boot) and
   Dashboard.jsx's syncEventItemsOnPackageChange (on a package switch).
7. Dept Views (DeptView.jsx) — Service, Crockery, Beverages, Fruits, ODC
8. Access Manager (AccessManager.jsx) — Admin only: staff CRUD, Manage Roles,
   Manage Screens. Role/screen definitions are DB-backed
   (role_definitions/screen_definitions) with their own realtime subscription
   in App.jsx, so an edit reaches every already-open session.

There is no Vendor Directory (removed 2026-10-16 — it had never actually
persisted anything) and no Repair & Maintenance module in the current code.

---

## KITCHEN D-1 LOGIC

No event today: Tab 1 = "D-1 for [tomorrow]" (mesa/prep steps)
                Tab 2 = "Continue [today] D-1 & D-1 for [day after]" (3-view selector)

Event today:    Tab 1 = "Final Cooking" (all cooking steps)
                Tab 2 = "Continue [today] D-1 & D-1 for [day after]"

---

## BEFORE EVERY PUSH — VERIFY

grep -r "Work Force" src/              # Should return NOTHING
grep "base:" vite.config.js            # Should show base: '/Fnbapp/'
grep "toISOString" src/App.jsx         # Should return NOTHING
npm run build                          # Must succeed
npx vitest run                         # Must pass (24 tests, 2 files)

---

## COMMON BUGS AND FIXES

White page on GitHub Pages     → base: '/Fnbapp/' in vite.config.js
"Work Force" login showing     → git show ebcb698:src/App.jsx > src/App.jsx
PIN change not working         → Pass empDb prop to LoginScreen; check the
                                  `staff` realtime subscription in App.jsx is
                                  patching both empDb and currentUser
Date shows yesterday           → Use localDateStr() not toISOString()
Hindi not translating          → Add key to HI dict
"I changed it, it's not        → Classic sign of two copies of the same fact.
showing somewhere else"          Check: does the target screen have a realtime
                                  subscription, or does it fetch once on mount?
                                  Does it read from the same table/column the
                                  edit wrote to, or from a cached mirror? See
                                  KNOWN_ISSUES.md for the pattern and the list
                                  of places this has already bitten.
