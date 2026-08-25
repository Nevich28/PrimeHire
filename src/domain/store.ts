/**
 * Application state.
 *
 * Inspections are the only mutable data in the product, so the store is small
 * on purpose: a list, five intent-shaped actions, and persistence. Projects and
 * inspectors are reference data and are read straight from the seed.
 *
 * Actions are named after what an operations coordinator is doing — schedule,
 * reschedule, reassign, cancel, complete — rather than after generic CRUD, and
 * each one delegates to a pure function in `inspection-changes.ts`. That keeps
 * this file down to subscription and storage, and keeps the rules about what a
 * cancellation does to a record testable on their own.
 *
 * This started on Zustand and no longer needs it. Zustand ships `import.meta`
 * in its middleware, which Metro does not transform for the web target on this
 * SDK, so the web bundle threw at startup. Rather than add resolver
 * configuration to work around a library, the store is built on React's own
 * `useSyncExternalStore`: one subscription, one snapshot, no dependency, and
 * the same call signature the screens already use.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { now } from './clock.ts';
import * as changes from './inspection-changes.ts';
import type { InspectionDraft } from './inspection-changes.ts';
import { SEED_INSPECTIONS } from './seed.ts';
import type { Inspection } from './types.ts';

export type { InspectionDraft };

/**
 * The last change to an existing inspection, kept so it can be taken back.
 *
 * One step deep on purpose. People undo the thing they just did, immediately,
 * because they picked the wrong row or the wrong name — a full history stack
 * would be more machinery for a case that does not come up.
 */
export type UndoableChange = {
  /** The record exactly as it was before the change. */
  previous: Inspection;
  /** What happened, phrased for the undo bar. */
  message: string;
};

export type InspectionState = {
  inspections: Inspection[];
  /** False until AsyncStorage has been read, so the UI can avoid a flash. */
  hydrated: boolean;
  undo: UndoableChange | null;

  scheduleInspection: (draft: InspectionDraft) => string;
  updateInspection: (id: string, draft: InspectionDraft) => void;
  cancelInspection: (id: string, reason: string) => void;
  completeInspection: (id: string) => void;
  /** Puts a cancelled or completed inspection back on the schedule. */
  reopenInspection: (id: string) => void;
  /** Writes a changed inspection straight through, ready to be taken back. */
  replaceInspection: (next: Inspection, message: string) => void;
  /** Restores the record as it was before the last change. */
  undoLastChange: () => void;
  dismissUndo: () => void;
  /** Throws away local changes and restores the delivered dataset. */
  resetToSeed: () => void;
};

const STORAGE_KEY = 'site-inspections/v1';

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

/** Replaces the inspection list and persists it. Every action goes through here. */
function setInspections(next: Inspection[]) {
  state = { ...state, inspections: next };
  notify();
  void persist(next);
}

/**
 * Applies a change to one inspection and remembers how to take it back.
 *
 * Edits made through the form pass `undoMessage: null`: the user is already
 * looking at what they changed, and an undo bar over the top of it would be
 * noise. The one-tap fixes and the closing actions are the ones worth guarding.
 */
function mapInspection(
  id: string,
  change: (inspection: Inspection) => Inspection,
  undoMessage: string | null
) {
  const previous = state.inspections.find((inspection) => inspection.id === id);
  if (!previous) return;

  state = {
    ...state,
    undo: undoMessage ? { previous, message: undoMessage } : null,
  };
  setInspections(
    state.inspections.map((inspection) => (inspection.id === id ? change(inspection) : inspection))
  );
}

let state: InspectionState = {
  inspections: [...SEED_INSPECTIONS],
  hydrated: false,
  undo: null,

  scheduleInspection: (draft) => {
    const inspection = changes.createInspection(draft, state.inspections, now());
    setInspections([...state.inspections, inspection]);
    return inspection.id;
  },

  updateInspection: (id, draft) => {
    mapInspection(id, (inspection) => changes.applyDraft(inspection, draft), null);
  },

  cancelInspection: (id, reason) => {
    mapInspection(
      id,
      (inspection) => changes.cancelInspection(inspection, reason, now()),
      'Inspection cancelled.'
    );
  },

  completeInspection: (id) => {
    mapInspection(
      id,
      (inspection) => changes.completeInspection(inspection, now()),
      'Marked as completed.'
    );
  },

  reopenInspection: (id) => {
    mapInspection(id, changes.reopenInspection, 'Put back on the schedule.');
  },

  replaceInspection: (next, message) => {
    mapInspection(next.id, () => next, message);
  },

  undoLastChange: () => {
    const pending = state.undo;
    if (!pending) return;
    state = { ...state, undo: null };
    setInspections(
      state.inspections.map((inspection) =>
        inspection.id === pending.previous.id ? pending.previous : inspection
      )
    );
  },

  dismissUndo: () => {
    state = { ...state, undo: null };
    notify();
  },

  resetToSeed: () => {
    state = { ...state, undo: null };
    setInspections([...SEED_INSPECTIONS]);
  },
};

/* ----------------------------------------------------------- persistence -- */

async function persist(inspections: Inspection[]) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ inspections }));
  } catch {
    // Storage being unavailable must not take the app down: the session keeps
    // working in memory and the next write will try again.
  }
}

/**
 * Reads stored inspections once at startup.
 *
 * Only the working set is persisted — projects and inspectors always come from
 * `data.json`, so an updated dataset can never be shadowed by stale storage.
 */
async function hydrate() {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as { inspections?: Inspection[] };
      if (Array.isArray(parsed.inspections)) {
        state = { ...state, inspections: parsed.inspections };
      }
    }
  } catch {
    // Corrupt or unreadable storage falls back to the delivered dataset, which
    // is a better failure than an empty schedule.
  } finally {
    state = { ...state, hydrated: true };
    notify();
  }
}

void hydrate();

/* ------------------------------------------------------------------ hook -- */

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Selector hook.
 *
 * Selectors must return something referentially stable — a field of state or an
 * action — because `useSyncExternalStore` compares snapshots by identity. Every
 * derived value in this app is built in `useSchedule`, which memoises it.
 */
export function useInspectionStore<T>(selector: (state: InspectionState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state)
  );
}

useInspectionStore.getState = (): InspectionState => state;
