# Decisions

How to run it is in the [README](README.md). `npm test` runs 38 unit tests.

## The three decisions that mattered

**1. Lead with what is wrong, and offer the fix.** The client already has a list
of inspections — that is the spreadsheet. The dataset is full of real problems:
Anna Keller booked on two sites at once, a critical crack review tomorrow at
08:00 with nobody assigned, an A12 visit running past a gate that closes at
16:00. So the schedule opens with those, and where there is one sensible
resolution the product offers it in a tap. A fix is only offered if it survives
the same rules engine that raised the problem: moving `insp-1002` earlier is
*not* offered, because Anna would still be double booked.

**2. Site notes are rules, not decoration.** *"Security gate closes at 16:00.
Last permitted site arrival is 15:45."* As grey text that is a nice touch; as a
rule it stops somebody being sent to a locked gate. Transcribed into
`site-access.ts`, with the note still shown verbatim beside it. Parsing the
prose at runtime would demo well and fail silently the first time an operations
team reworded a sentence.

**3. Warnings inform, they never block.** Anybody can be booked over a clash or
outside an access window — coordinators know things the data does not. They just
cannot fail to notice. Same reasoning behind cancellation keeping the record and
requiring a reason, and every change leaving an undo.

## Assumptions

- **Now is 25 August 2026, 17:00 Zurich** — eighteen minutes after the critical
  review was raised and left unassigned. Injected through `clock.ts`.
- The user is an **office coordinator**, not an inspector: they assign work and
  resolve clashes, they do not carry inspections out.
- **Projects and inspectors are read-only** reference data; only inspections are
  persisted, so an updated `data.json` is never shadowed by stale storage.
- **Travel time is estimated, not routed**: town coordinates from the postcodes
  in each address, straight-line distance with a detour factor. Frauenfeld to
  St. Gallen comes out at 55 minutes, Basel to St. Gallen at 2h15.
- `facade` and `facades` are one discipline; the data uses both.
- Swiss conventions: 24-hour clock, weeks start on Monday, project codes shown
  everywhere because two projects have nearly identical names.

## Deliberately not built

Authentication and roles · dark mode · editing projects or inspectors ·
notifications, offline sync, exports, attachments, recurring inspections ·
component tests — the domain has 38 unit tests and every flow was exercised by
hand on web, iOS and Android.

## AI usage

**Claude Code (Opus)** wrote effectively all of the implementation: scaffolding,
domain layer, rules engine, screens, tests, commit messages. I set the product
direction, reviewed the output and drove the debugging. Left to itself it builds
a competent CRUD calendar; the framing — that the data is full of operational
problems and that finding them *is* the product — is the part that was not
automatic.

**What I changed.** The one-tap fixes were built the obvious way, and I only
found the flaw by using the thing: I pressed *Assign David Baumann* on Anna
Keller's clash and **two** rows disappeared. That is correct — a double booking
is reported from both inspections' point of view, and resolving either side
clears it — but it meant the header was counting one problem as two, and the
feed behaved like a list of inspections when it is meant to be a list of
problems. Clashes are now collapsed to a single entry there, while both cards
in the schedule still carry the warning, because somebody looking at one
inspection has to see that it is affected.

Two smaller corrections: Zustand went out after its `import.meta` broke the web
bundle on this SDK, and the keyboard focus ring moved from a JavaScript focus
state to `:focus-visible`, which can tell a keyboard user from a mouse click.

## Worth knowing

- **Expo SDK 54**, because that is what the Expo Go in the app stores supports.
  The scaffold produced SDK 57, which Expo Go refuses to open.
- **No date library.** `datetime.ts` applies Zurich's DST rules explicitly; the
  tests round-trip every timestamp in `data.json` and pin both 2026 boundaries.
- **The rules engine is pure**, so one implementation drives four surfaces: the
  attention feed, live validation of an unsaved draft, the ranking in the
  inspector picker, and the verification of its own suggested fixes.
- **One layout, two arrangements**, with shared routes — every inspection has a
  real URL that works from a browser, a phone and the back button.

## With another day

1. **Site access windows and coordinates onto the project**, editable without a
   deploy. They are the two places structure was added to data that lacked it.
2. **A per-inspector view with confirm or decline**, so the schedule stops
   drifting from what actually happens on site.
3. **A start and an end to each inspector's day.** Travel is only checked
   between two visits, so the first journey of the morning and the last one home
   are invisible: the product will happily put somebody in St. Gallen at 07:00
   when they live in Bern.
