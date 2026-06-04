# CLAUDE.md — Ambria FnB Operations App

## READ THIS FIRST — EVERY SESSION

This is the project memory for Claude Code. Read this entire file
before making ANY changes to the codebase.

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

3. **The main app file is src/App.jsx (~9400+ lines)**
   - It is a single-file React app — all components in one file
   - Do NOT split it into modules unless explicitly asked
   - Do NOT create new component files unless explicitly asked

4. **PIN login MUST read from live empDb state — NEVER from EMPLOYEE_DB_INIT**
   - EMPLOYEE_DB_INIT is the static seed data — used ONLY as fallback in useState
   - empDb is the live state; PINs are persisted via window.storage ("ambria_pins")
   - LoginScreen receives empDb as a prop
   - LoginScreen PIN check uses safeArr(empDb).find(...)
   - KioskAttendance also receives empDb as prop for PIN validation
   - grep -c "EMPLOYEE_DB_INIT" src/App.jsx should return 2 (definition + useState)

5. **empDb persistence chain:**
   App() useState → initializes from EMPLOYEE_DB_INIT
   App() useEffect (mount) → loads saved PINs from window.storage("ambria_pins") → merges into empDb
   setEmpDb() wrapper → extracts PINs → saves to window.storage("ambria_pins")
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
    ├── App.jsx            ← THE ENTIRE APP (~9400+ lines)
    ├── main.jsx           ← just renders App
    └── index.css          ← EMPTY (app injects own styles)

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
EMP_DB_INIT should contain ONLY AM001 (clean slate).

---

## APP MODULES (all in src/App.jsx)

1. Dashboard — 6 KPI tiles, upcoming events (NO guest names), closure report
2. Kitchen Hub — 5 tabs: Today/D-1/Pax Scaling/SOPs/Menu
3. Store and Inventory — 745 items, barcode scan, smart issue
4. Transport — 3 vehicles, SVG map, dispatch
5. Team and Attendance — kiosk PIN, leaves, daily wages
6. Repair and Maintenance — shared pool, 7 assignees, photo completion
7. Menu Packages — 8 packages, applicability matrix
8. Vendor Directory — categories, contacts
9. Dept Views — Service, Crockery, Beverages, ODC
10. Access Manager — Admin only, CRUD staff, role templates, bulk ops, visible PINs

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
grep -c "EMPLOYEE_DB_INIT" src/App.jsx  # Must be 2 (definition + useState)
grep "toISOString" src/App.jsx         # Should return NOTHING
wc -l src/App.jsx                      # Should be 9000+
npm run build                          # Must succeed

---

## COMMON BUGS AND FIXES

White page on GitHub Pages     → base: '/Fnbapp/' in vite.config.js
"Work Force" login showing     → git show ebcb698:src/App.jsx > src/App.jsx
PIN change not working         → Pass empDb prop to LoginScreen
Date shows yesterday           → Use localDateStr() not toISOString()
Hindi not translating          → Add key to HI dict
AccessManager changes lost     → useEffect saves empDb to localStorage
