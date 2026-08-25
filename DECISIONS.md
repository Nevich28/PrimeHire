# Decisions

## Running it

```bash
npm install
npx expo start
```

Press `w` for the browser, or scan the QR code with Expo Go. The project targets
**Expo SDK 54**, which is what the Expo Go currently in the app stores supports.

```bash
npm test        # 38 unit tests, Node's built-in runner, no extra dependencies
npm run typecheck
```

`data.json` is unchanged at the repository root and is the only source of
projects, inspectors and inspections.

---

## The three most important decisions

### 1. The product leads with what is wrong, and offers to fix it

The client already has a list of inspections — that is what the spreadsheet is.
What they cannot get from a spreadsheet is the answer to *"what is about to go
wrong?"*, and that is what the phone calls are for.

So the schedule opens with an attention feed, and the dataset is full of things
to put in it. Anna Keller is booked on two sites at once on 26 August. A
critical crack review on the Limmat bridge is scheduled for tomorrow at 08:00
with nobody assigned. An inspection on the A12 runs until 16:30 at a site whose
security gate closes at 16:00. A drainage inspection in St. Gallen runs half an
hour past the time the traffic control team goes home.

Finding those is half of it. Most of them have exactly one sensible resolution
and the product already knows what it is — who is free and signed off for that
slot, which hour of the day fits inside a site's access window — so the fix sits
on the row as one tap, with an undo behind it.

A suggestion is only offered when it survives the same rules engine that raised
the problem: it must clear the issue it targets and must not introduce a
blocker. Moving the 15:30 bearing inspection earlier is therefore *not* offered,
because Anna Keller would still be double booked that afternoon. The product
stays quiet rather than pretending to have fixed something.

### 2. Site notes are rules, not decoration

`data.json` carries site access constraints as prose inside `project.siteNote`:
*"Security gate closes at 16:00. Last permitted site arrival is 15:45."* Shown
as grey text on a card, that is a nice touch. Modelled as a rule, it stops
somebody being sent to a locked gate — and it is what lets the product suggest
15:15–16:00 instead.

Those windows are transcribed into `src/domain/site-access.ts` as structured
data, and the original note is still shown verbatim next to it. Parsing the
sentences at runtime was considered and rejected: it is a regex guessing game
against free text that an operations team can rewrite at any time, and it fails
silently when it guesses wrong. In a real system this would be a field on the
project, which is exactly how it is modelled here.

### 3. Warnings inform, they do not block

Nothing in the product refuses to save. A coordinator can book an inspector who
is already busy, schedule work outside a site access window, or send somebody
outside their discipline — because they sometimes know something the data does
not. What they cannot do is *not notice*: the consequence is spelled out in a
sentence, in the form, before they commit.

The same thinking runs through the rest. Cancellation is never a delete — the
record stays and the reason is required, because the delivered dataset works
that way and because that sentence is what stops the next person ringing round
to ask what happened. And every change to an existing inspection leaves an undo
behind for a few seconds, because all of this happens quickly, often on a phone,
often on the wrong row.

---

## Assumptions

- **Now is fixed at 25 August 2026, 17:00 Europe/Zurich.** The brief pins the
  date; the time is chosen deliberately, eighteen minutes after the critical
  crack review was raised and left unassigned for the following morning. It is
  the moment the product has to earn its keep. Everything reads `now()` from
  `src/domain/clock.ts`, so a live clock is a one-line change.
- **The user is an operations coordinator, not an inspector.** They assign work
  and resolve clashes; they do not carry out inspections. That is why there is
  no field report, sign-off or photo capture.
- **Projects and inspectors are reference data.** The product reads them and
  never edits them, so only inspections are persisted. An updated `data.json`
  can never be shadowed by stale local storage.
- **Travel time is estimated from town centres.** The addresses in `data.json`
  carry postcodes but no coordinates, so `src/domain/travel.ts` holds the
  coordinates of the seven towns those postcodes name and estimates the journey
  from straight-line distance: a 1.3 detour factor, town speeds for the first
  fifteen kilometres and motorway speeds beyond, plus ten minutes for parking
  and signing in. It puts Frauenfeld to St. Gallen at 55 minutes and Basel to
  St. Gallen at two and a quarter hours, both close to reality. It is an
  estimate, and the product says so — the warning gives the gap and the journey
  time and lets the coordinator judge.
- **`facade` and `facades` are the same discipline.** The data uses the singular
  for inspection types and the plural for inspector specialties.
- **Later is better than earlier when a slot has to move.** Work on site tends
  to run on, so a suggested reschedule takes the latest hour that fits the
  access window rather than pulling the visit forward more than necessary.
- **Swiss conventions**: 24-hour clock, weeks starting on Monday, project codes
  shown everywhere because two projects are called "A12 East Viaduct
  Rehabilitation — North Approach/Abutment Structure" and only the code tells
  them apart.

---

## What I deliberately did not build

- **Authentication, roles and multi-user anything.** There is no backend, and a
  fake login would only add screens.
- **Dark mode.** One light theme executed properly beats two half-finished ones,
  and it would double the visual QA surface for no gain to a dispatcher.
- **Managing projects and inspectors.** Reference data stays read-only; the
  inspector screen shows workload rather than offering edits.
- **Notifications, offline sync, reporting, exports, attachments, recurring
  inspections, drag-to-reschedule.** All plausible, none of them the difference
  between this being useful on Monday morning and not.
- **Hand-drawn artwork.** The icon, favicon and splash mark are generated by a
  small script rather than designed; they are clean and consistent, not the work
  of somebody who draws for a living.
- **Component tests.** The domain layer is covered by 38 unit tests and every
  flow was exercised by hand on web, iOS and Android. A rendering test setup
  would have cost more than it returned at this size.

---

## AI usage

Built with **Claude Code** (Claude Opus), used for effectively all of the
implementation: scaffolding, the domain layer, the rules engine, every screen,
the test suite and the commit messages. I directed the product decisions, read
and reviewed the output, and drove the debugging.

Where it was most useful: turning a described product into working code quickly,
and grinding through the Expo/Metro compatibility problems below without losing
the thread.

Where it needed steering: it will happily produce a competent CRUD calendar if
you ask for a "site inspections app". The framing — that the data is full of
operational problems and that finding them is the product — was mine, and it is
the thing the whole application is built around.

### Something the AI proposed that I changed

Asked to make the site notes useful, the first proposal was to parse the access
rules out of the free text at runtime with regular expressions — pull `16:00`
and `15:45` out of *"Security gate closes at 16:00. Last permitted site arrival
is 15:45."* It demos well and it is the wrong thing to ship: it is a guessing
game against text an operations team can reword at any time, and when it guesses
wrong it fails silently, which is the worst way for a safety-adjacent rule to
fail. I replaced it with an explicit table of access windows transcribed from the
notes, documented as the field this would be in a real system, with the original
note still shown verbatim beside it.

Three smaller corrections are worth recording, because each one traded a
plausible-looking answer for a duller correct one:

- The generated store used Zustand, which ships `import.meta` in its middleware;
  Metro does not transform that for the web target on SDK 54, so the web bundle
  threw before the first frame. Rather than add resolver configuration to work
  around a library, I removed the dependency — the store is one collection and
  five actions, which is about eighty lines of `useSyncExternalStore`.
- The responsive layout was built on `useWindowDimensions`, which did not
  re-emit on web window resize, leaving the layout stuck on whichever side of
  the breakpoint it started on. It now measures the app container with
  `onLayout`, which is correct on both targets.
- The keyboard focus ring was drawn from Pressable's `focused` state. That
  cannot tell a keyboard user from someone who has just clicked, so it lit up
  after every mouse press. The browser already makes that distinction, so the
  ring is now the native `:focus-visible` outline, restyled to match the app
  through a stylesheet that only exists on web.

---

## Engineering notes

- **Dates.** No date library and no reliance on `Intl` timezone data in Hermes.
  Every timestamp is an absolute instant and is only ever displayed through
  `src/domain/datetime.ts`, which applies Switzerland's DST rules explicitly.
  The tests round-trip all 60-odd timestamps in `data.json` and pin both 2026
  transition boundaries.
- **The rules engine is pure.** `evaluateInspection(candidate, context)` has no
  React, storage or navigation in it, which is what lets the same code drive the
  attention feed, live validation of a draft that has not been saved yet, the
  ranking in the inspector picker, and the verification of its own suggested
  fixes. There is one definition of what counts as a clash.
- **Tests name real scenarios.** They run against the actual `data.json` rather
  than fixtures, so a regression fails as *"Anna Keller is double booked on 26
  August"* rather than as an abstract case.
- **One layout, two arrangements.** A single column on a phone; the schedule
  beside the open inspection from 900px up. Routes are shared, so an inspection
  has a real URL that works from the browser address bar, a phone and the back
  button.
- **Date and time entry is hand-built.** The community picker is a native dialog
  on device and unreliable on the web, which would break the promise that both
  platforms behave identically.
- **Web output is `single`, not `static`.** Static made the dev server
  server-render every route in Node, where `AsyncStorage` has no `window`. An
  internal tool with local state gains nothing from prerendering.
- **Safe areas belong to the screen container, not the scroll content.** Padding
  the content only guarantees the last card clears the notch and the Android
  navigation bar; everything passing through mid-scroll still renders under it.
- **Expo SDK 54**, because that is what the Expo Go in the app stores supports.
  The scaffold produced SDK 57, which Expo Go refuses to open — and a build the
  reviewer cannot run is worth nothing.

---

## The three things I would do next

1. **Move site access windows and site coordinates out of the code and onto the
   project.** Both are transcribed by hand today, and they are the two places in
   this product where structure was added to data that did not have it.
   Operations should be able to correct a gate time or a site location when it
   changes, without a deploy — and every rule that reads them improves for free.

2. **Close the loop with the inspectors.** Right now the schedule is written by
   the office and read by nobody else. A per-inspector view of their own day,
   and the ability to confirm or decline a booking, is what stops the schedule
   drifting from what actually happens on site — and it is the natural step
   before anyone would trust this to replace the phone calls entirely.

3. **Give each inspector a start and an end to their day.** Travel time is only
   checked between two site visits, so the first journey of the morning and the
   last one home are invisible to the product: it will happily put somebody in
   St. Gallen at 07:00 when they live in Bern. Knowing where a day begins closes
   the last gap in the same rule I have just made useful.
