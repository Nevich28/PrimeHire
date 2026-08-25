## Running this

```bash
npm install
npx expo start
```

Press `w` for the browser, or scan the QR code with Expo Go. The project targets
**Expo SDK 54**, which is the version the Expo Go in the app stores supports.

```bash
npm test          # 36 unit tests, on Node's built-in test runner
npm run typecheck
```

The product decisions, assumptions and trade-offs are in
[DECISIONS.md](DECISIONS.md). The original brief follows, unchanged.

---

# Product Engineering Challenge — Site Inspections

## Context

You are joining a team building internal software for a civil engineering company.

Operations staff coordinate site inspections across multiple construction projects. They use the product throughout the day from both laptops and phones.

You have been given a `data.json` file containing representative project, inspector, and inspection data.

There is no existing UI and no Figma.

Your task is to turn this into a product experience you would be comfortable shipping to a real client.

---

## Task

Build a **Site Inspections** application using:

- Expo
- React Native
- TypeScript

It must work in:

- Expo Go on iOS/Android
- Expo Web

At minimum, users should be able to:

- understand upcoming inspections
- understand which project and inspector an inspection relates to
- schedule an inspection
- edit or reschedule an inspection
- cancel an inspection
- understand the current state of an inspection

The requirements beyond that are intentionally incomplete.

Make reasonable product decisions yourself.

---

## Product direction

The client has told us:

> "Our operations people need to use this every day. We need a simple way to manage inspections without constantly checking spreadsheets and calling each other. It should feel finished."

That is all the product direction you get.

We care more about the quality of the finished experience than the number of features.

---

## Data

Use the provided `data.json`.

Do not replace it with simplified demo data.

Assume:

- Current date: **25 August 2026**
- Primary timezone: **Europe/Zurich**

A real backend is not required.

Use any reasonable Expo-compatible local state/persistence approach.

---

## AI usage

Use AI as much as you want.

Claude Code, Cursor, Codex, ChatGPT, Copilot, and similar tools are all allowed.

We actively want engineers who use AI effectively.

You are responsible for the quality of the final result.

---

## Timebox

**Maximum: 4 hours**

Please stop after four hours.

Setup time is included.

If something is unfinished, leave it unfinished and explain what you would do next.

---

## Deliverables

### 1. Source code

Send us the repository or a ZIP.

It should run with:

```bash
npx expo start
```

We should be able to test it using Expo Go and Expo Web.

Keep the provided `data.json` in the project.

### 2. Git history

Commit your work as you go.

We do not require perfect commit hygiene.

### 3. `DECISIONS.md`

Keep this concise.

Include:

- the three most important product or UX decisions you made
- important assumptions you made
- what you deliberately did not build
- which AI tools you used and what you used them for
- one example of something the AI proposed that you changed, rejected, or improved
- the three most important things you would do with another day

### 4. Walkthrough video

Maximum **5 minutes**.

Show:

- the product on web
- the product on mobile / Expo Go
- the main workflow
- the product decision you are happiest with
- one technical decision you are happy with
- one thing you would still improve

No slides are needed.

---

## Evaluation

We will evaluate the final result across:

- product and UX quality
- product judgment
- engineering quality
- reliability and completeness
- communication

There is no single correct solution.

We are interested in how you turn an incomplete real-world problem into a polished product.

Good luck.
