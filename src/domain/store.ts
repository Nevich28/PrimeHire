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

export type InspectionState = {
  inspections: Inspection[];
  /** False until AsyncStorage has been read, so the UI can avoid a flash. */
  hydrated: boolean;

  scheduleInspection: (draft: InspectionDraft) => string;
  updateInspection: (id: string, draft: InspectionDraft) => void;
  cancelInspection: (id: string, reason: string) => void;
  completeInspection: (id: string) => void;
  /** Puts a cancelled or completed inspection back on the schedule. */
  reopenInspection: (id: string) => void;
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

function mapInspection(id: string, change: (inspection: Inspection) => Inspection) {
  setInspections(
    state.inspections.map((inspection) => (inspection.id === id ? change(inspection) : inspection))
  );
}

let state: InspectionState = {
  inspections: [...SEED_INSPECTIONS],
  hydrated: false,

  scheduleInspection: (draft) => {
    const inspection = changes.createInspection(draft, state.inspections, now());
    setInspections([...state.inspections, inspection]);
    return inspection.id;
  },

  updateInspection: (id, draft) => {
    mapInspection(id, (inspection) => changes.applyDraft(inspection, draft));
  },

  cancelInspection: (id, reason) => {
    mapInspection(id, (inspection) => changes.cancelInspection(inspection, reason, now()));
  },

  completeInspection: (id) => {
    mapInspection(id, (inspection) => changes.completeInspection(inspection, now()));
  },

  reopenInspection: (id) => {
    mapInspection(id, changes.reopenInspection);
  },

  resetToSeed: () => {
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
