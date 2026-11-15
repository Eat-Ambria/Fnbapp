# Safe patterns for syncing from an external system (LMS, CRM, ERP, etc.)

This document generalizes what Ambria FnB Operations' `lms-sync` edge
function learned the hard way on 2026-11-14, when a sequence of three
distinct bugs in the same sync pass caused real, unrecoverable production
data loss (events, menu selections, and at least one already-finalized,
sent-to-kitchen Function Plan were hard-deleted). It's written to be dropped
into any app that periodically pulls records from an external source of
truth and mirrors them into its own database — not specific to Ambria's
schema or LMS's API shape.

If your app has a background job that fetches a list from somewhere else
and reconciles it against your own table (inserting new rows, updating
changed ones, and — the dangerous part — deleting rows that didn't come
back), read this before you trust that job with real data.

## The core failure mode

**"This record wasn't in today's fetch" is not the same fact as "this
record was deleted/cancelled at the source."** Any code that treats those
two as equivalent and acts on it automatically (especially via a hard
DELETE, especially when that cascades to child data) is a correctness bug
waiting to happen, not a matter of tuning a heuristic. We hit three
unrelated reasons a record could vanish from one fetch while still being
real and active at the source:

1. **Pagination truncation.** A page-size cap plus a page-count cap plus
   silent growth in source-side row count = your "complete" fetch quietly
   stops partway through. Every record past the cutoff looks "missing,"
   every single run, until someone notices by coincidence.
2. **Source-side visibility quirks.** The account/API-key/user-id your
   sync authenticates as may not reliably see every record, even if it's
   nominally an admin/superadmin account in the source system's own UI. A
   record can be visible one day and invisible the next for reasons
   entirely internal to the source system (ownership/assignment changes,
   a permissions quirk, a caching bug on their end) — your sync has no way
   to distinguish that from a genuine deletion.
3. **Your own disambiguation/matching logic reassigning IDs.** If you
   derive a stable "same record" key from fields other than the source's
   own immutable primary key (e.g. `source-id + date` instead of just the
   source's row id), any legitimate change to one of those fields (or any
   bug in your own fetch — see #2 feeding extra rows into a dedup pass)
   can make your own code mint a new key for an old record and treat the
   old key as "gone."

None of these are exotic edge cases. Assume at least one of them will
happen in production and design the whole sync so that none of them can
delete real data.

## Rule 1 — No automated process ever issues a hard DELETE on synced data

This is the one rule that would have prevented all the actual data loss,
independent of whatever specific detection bug caused it. Concretely:

- The sync job's "clean up records missing from this run" pass should, at
  most, **log/flag** candidates for a human to review. It should never
  itself delete, and definitely never delete-and-cascade.
- If your app needs end users to be able to delete a record, that delete
  path should be a **soft delete** (a boolean tombstone column, an
  `archived`/`is_deleted` flag) performed by an explicit, admin-gated UI
  action — never a side effect of a background job's reconciliation pass.
- The sync's upsert logic must **respect that tombstone**: fetch the set
  of soft-deleted IDs once per run and exclude them from re-insertion,
  otherwise a user's deliberate delete "resurrects" on the next sync.
- A tombstoned record should **never be reconsidered by the cleanup pass
  either** — once it's a tombstone, leave it alone forever. (We had a bug
  where the cleanup pass saw a tombstoned row as "missing from this
  fetch" and happily hard-deleted the tombstone itself, which meant the
  *next* sync had no tombstone to check against and resurrected a record
  the user had explicitly removed.)
- If a hard delete capability needs to exist at all for compliance/storage
  reasons, make it a separate, manual, admin-only action — distinct from
  anything the sync job can reach — never automatic.

## Rule 2 — Database constraints should assume application code will have bugs

Don't rely solely on "the sync code will never delete a parent row" —
assume it will, someday, due to a bug you haven't found yet, and make the
blast radius small at the schema level too:

- Foreign keys from child/detail tables (line items, selections, linked
  plans, logs) back to the synced parent table should be **`ON DELETE
  RESTRICT`, not `ON DELETE CASCADE`**. CASCADE means a single wrong
  DELETE on the parent instantly and silently destroys every dependent
  row in the same transaction, with no error, no warning, and (if there's
  no tombstone/snapshot) no way to recover any of it. RESTRICT means that
  same wrong DELETE just fails loudly — a foreign-key-violation error —
  which is recoverable: you fix the bug and nothing was lost.
- If you have a genuine, intentional cross-table cascade need (e.g.
  renaming a parent's primary key and wanting child rows to follow), do it
  explicitly: re-point every child FK column via `UPDATE` first, then only
  touch the parent row — never lean on `ON DELETE CASCADE`/`ON UPDATE
  CASCADE` to do it implicitly for you. An explicit migration function is
  easy to audit; a schema-level CASCADE firing as a side effect of an
  unrelated bug is not.

## Rule 3 — Detect pagination/fetch truncation explicitly, and never let a truncated run drive any deletion decision

- Pick a page-count safety cap (and page size) with real headroom above
  current and reasonably-foreseeable source-side volume — not just "what
  currently works." Put the actual observed volume and the date you
  checked it in a comment, so the next person knows whether the cap still
  has headroom or needs re-checking.
- Have your paginated fetch helper return an explicit `truncated: boolean`
  alongside the rows — `true` means the loop hit its page cap while the
  *last* page fetched was still full, i.e. there was provably more data
  this run never saw. Don't infer this after the fact from row counts;
  compute it where the pagination happens.
- Record `truncated` in the sync's own run log (not just a `console.log`
  — a queryable, first-class status field or warning message that
  outlives server logs) so anyone can tell, after the fact, which runs
  were incomplete.
- The "anything missing from this run is gone" cleanup pass (Rule 1) must
  check this flag and refuse to treat *any* record as "missing" on a
  truncated run — a truncated run has no business asserting anything is
  absent.

## Rule 4 — Prefer the source's own immutable ID as your dedup/matching key; handle legitimate renames explicitly instead of via delete+insert

- If you must derive your own record ID from mutable source fields
  (because the source has no useful natural key, or you need to compose
  one from several), also capture the source's own row-level ID (whatever
  survives an edit) as a separate field and keep it through your transform
  pipeline. Use it to detect "this is actually the same real-world record,
  just under a new derived ID," not just for logging.
- When you detect an unambiguous 1:1 swap for an otherwise-stable grouping
  key (same external contract/account/record number, exactly one old
  derived-ID disappeared, exactly one new one appeared, and a couple of
  independent fields — e.g. location and quantity — still match), treat it
  as a **rename/migration**, not a delete+insert:
  - Re-point every child table's foreign key from the old ID to the new
    one via explicit `UPDATE`s.
  - Watch for any place a related table embeds the parent ID as part of a
    *composite* key or a string that bakes the ID in (e.g.
    `${parentId}::${childId}` as a primary key, or a derived cache/lookup
    key like `${parentId}|${someOtherField}`) — a plain column-level
    `UPDATE` of just the foreign-key column will miss these, leaving
    orphaned-looking state that "technically" still exists but is
    unreachable under the new ID. Enumerate every table that references
    the parent, including ones that only embed the ID indirectly.
  - Carry forward the old row's own accumulated customizations (anything a
    user edited directly on the parent row that isn't itself a child
    table) onto the new row — a freshly re-synced row only has what the
    source just sent, not any local edits layered on top.
  - Only after everything is confirmed migrated, tombstone (never hard
    delete, per Rule 1) the old row.
  - If the match is ambiguous (more than one plausible old/new pairing, or
    the secondary fields don't agree), don't guess — leave it to the
    normal insert path and flag it for manual review instead.

## Rule 5 — Never let a sync's own read-modify-write races clobber a concurrent human edit

If users can edit a synced record locally (overriding what the source
system says), and the sync can run concurrently with that edit (multiple
devices triggering it, no server-side lock), a naive "read current value,
decide whether it's customized, write a merged value back" pattern has a
race window: a user's edit landing between your read and your write gets
silently overwritten with your stale snapshot.

- Add a short server-side cooldown on the sync itself (e.g. refuse to run
  again within N minutes of the last successful run) so casual
  retriggering (page reloads, multiple devices, impatient manual
  "sync now" clicks) can't stack overlapping runs. This narrows the race
  window; it doesn't close it.
- For the actual write, make the "this hasn't changed since I decided it
  was safe to touch" check part of the write itself, not a separate
  earlier read: do a conditional `UPDATE ... WHERE <column> = <value you
  read>` (optimistic concurrency) instead of writing an unconditional
  blind value. If zero rows matched, something changed it after your read
  — treat that as "someone else already handled this" and do nothing,
  rather than clobbering it.
- Maintain an explicit "has a human confirmed/customized this field"
  signal (a boolean flag set only by the human-facing UI action) as the
  primary gate, and only fall back to inferring customization from current
  values (e.g. "the source-reported field differs from what we last
  synced") for rows that predate the flag or weren't explicitly confirmed.
  An inferred heuristic alone tends to miss cases where a user picked a
  different *named* value rather than going fully custom or blank.

## Rule 6 — Make the sync observable, not just functional

- Every run should write a row to its own log table: start time, end
  time, status, counts (fetched/inserted/updated/skipped/"would have
  deleted but didn't"), and any warning (truncation, ambiguous
  rename, source visibility anomaly). Silent success/failure is how a
  truncation bug ran undetected for weeks.
- When a safety mechanism (Rule 1's disabled auto-delete, Rule 3's
  truncation flag) fires, log *what it would have done* and surface that
  somewhere a human will actually see it, not just in function logs that
  roll off — the run-log row is a good place, since it's already queryable
  and has a UI showing it.

## Checklist for auditing an existing sync against this

- [ ] Does the cleanup/reconciliation pass ever call a real `DELETE`?
      If yes → change it to log-only, or to a flag an admin confirms.
- [ ] Are child-table foreign keys to the synced table `CASCADE`?
      If yes → change to `RESTRICT` (and explicitly re-point children
      before any real delete you do keep).
- [ ] Does the paginated fetch have a hard page/row cap with no
      `truncated` signal, and no comment stating when and at what volume
      it was last verified to have headroom?
      If yes → add the signal, verify headroom, document the date/volume.
- [ ] Does anything downstream treat "absent from this fetch" as "deleted
      at the source" without checking a truncation/partial-fetch flag?
      If yes → gate it on that flag.
- [ ] Is your dedup/matching key built from mutable fields with no
      fallback to the source's own stable row ID?
      If yes → capture the stable ID anyway, and use it to detect
      renames instead of silently dropping/re-adding records.
- [ ] Does a soft-deleted/tombstoned record ever get re-evaluated by the
      cleanup pass, or resurrected by the next sync's insert?
      If yes → exclude tombstones from both paths, permanently.
- [ ] Can the sync run concurrently with a user edit to the same row, and
      if so, does the write path use optimistic concurrency (conditional
      update) rather than a blind overwrite?

## Case study (what actually happened, for context)

On 2026-11-14, Ambria FnB's `lms-sync` function had a page cap sized for
source-side volume from weeks earlier; actual volume had grown past it
silently, so every run was truncating the fetch without any signal. Its
cleanup pass treated anything "missing from this run" as cancelled and
hard-deleted the corresponding local row, which cascaded (via `ON DELETE
CASCADE` FKs) into deleting that event's menu selections and — in at least
one case — an already-finalized, sent-to-kitchen Function Plan, with no
tombstone and no way to recover it after the fact. Chasing it down also
surfaced a second, independent cause (one legitimate, non-cancelled record
was invisible to the specific admin account the sync authenticated as,
for reasons internal to the source system), and then — because the first
attempted fix tried to work around #2 by fetching as multiple source
users in parallel — a *third*, self-inflicted cause (duplicate raw rows
across those parallel fetches confused the same-day-multi-function
disambiguation logic, minting spurious new IDs and marking the real ones
"missing"), which deleted even more real events on its first run before
being caught and reverted. Recovery required restoring a full database
backup (no point-in-time recovery was configured) and manually reapplying
unrelated same-day work that the restore would otherwise have rolled back.

The permanent fix was all six rules above, applied together: raise the
page cap with real headroom and add an explicit `truncated` signal;
disable the auto-delete cleanup pass entirely (log-only now); convert the
relevant FKs from CASCADE to RESTRICT; convert the one remaining
legitimate hard-delete path to re-point children then tombstone instead of
deleting; and keep the sync's existing optimistic-concurrency write path
for customized rows. No single one of those would have been enough on its
own — it took all three original bugs happening on the same day to
demonstrate that the detection heuristic itself ("missing from fetch" ==
"cancelled") was the thing that needed to stop being trusted to delete
anything automatically, regardless of how each individual cause gets
fixed.
