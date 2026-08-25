/**
 * Application state.
 *
 * Inspections are the only mutable data in the product, so the store is small
 * on purpose: a list, five intent-shaped actions, and persistence. Projects and
 * inspectors are reference data and are read straight from the seed.
 *
 * Actions are named after what an operations coordinator is doing — schedule,
 * reschedule, reassign, cancel, complete — rather than after generic CRUD. That
 * keeps intent visible at the call site and keeps the audit fields (cancelledAt,
 * completedAt, cancellationReason) impossible to forget.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { now } from './clock.ts';
import { toZurichIso } from './datetime.ts';
import { SEED_INSPECTIONS } from './seed.ts';
import type { Inspection, InspectionType, Priority } from './types.ts';

export type InspectionDraft = {
  projectId: string;
  inspectorId: string | null;
  title: string;
  type: InspectionType;
  priority: Priority;
  startsAt: string;
  endsAt: string;
  notes: string | null;
};

type InspectionState = {
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

/**
 * Ids continue the sequence already present in the data (`insp-1024` and up)
 * instead of using random uuids: it keeps the dataset readable, keeps new
 * records sortable by age, and avoids a dependency for something this small.
 */
function nextInspectionId(existing: Inspection[]): string {
  const highest = existing.reduce((max, inspection) => {
    const match = /^insp-(\d+)$/.exec(inspection.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 1000);
  return `insp-${highest + 1}`;
}

function applyDraft(inspection: Inspection, draft: InspectionDraft): Inspection {
  return {
    ...inspection,
    projectId: draft.projectId,
    inspectorId: draft.inspectorId,
    title: draft.title.trim(),
    type: draft.type,
    priority: draft.priority,
    startsAt: draft.startsAt,
    endsAt: draft.endsAt,
    notes: draft.notes?.trim() ? draft.notes.trim() : null,
  };
}

export const useInspectionStore = create<InspectionState>()(
  persist(
    (set, get) => ({
      inspections: [...SEED_INSPECTIONS],
      hydrated: false,

      scheduleInspection: (draft) => {
        const id = nextInspectionId(get().inspections);
        const inspection: Inspection = applyDraft(
          {
            id,
            projectId: draft.projectId,
            inspectorId: draft.inspectorId,
            title: draft.title,
            type: draft.type,
            status: 'scheduled',
            priority: draft.priority,
            startsAt: draft.startsAt,
            endsAt: draft.endsAt,
            notes: draft.notes,
            createdAt: toZurichIso(now()),
            cancellationReason: null,
          },
          draft
        );
        set((state) => ({ inspections: [...state.inspections, inspection] }));
        return id;
      },

      updateInspection: (id, draft) => {
        set((state) => ({
          inspections: state.inspections.map((inspection) =>
            inspection.id === id ? applyDraft(inspection, draft) : inspection
          ),
        }));
      },

      cancelInspection: (id, reason) => {
        set((state) => ({
          inspections: state.inspections.map((inspection) =>
            inspection.id === id
              ? {
                  ...inspection,
                  status: 'cancelled',
                  cancelledAt: toZurichIso(now()),
                  cancellationReason: reason.trim() || 'No reason given.',
                }
              : inspection
          ),
        }));
      },

      completeInspection: (id) => {
        set((state) => ({
          inspections: state.inspections.map((inspection) =>
            inspection.id === id
              ? { ...inspection, status: 'completed', completedAt: toZurichIso(now()) }
              : inspection
          ),
        }));
      },

      reopenInspection: (id) => {
        set((state) => ({
          inspections: state.inspections.map((inspection) =>
            inspection.id === id
              ? {
                  ...inspection,
                  status: 'scheduled',
                  completedAt: null,
                  cancelledAt: null,
                  cancellationReason: null,
                }
              : inspection
          ),
        }));
      },

      resetToSeed: () => {
        set({ inspections: [...SEED_INSPECTIONS] });
      },
    }),
    {
      name: 'site-inspections/v1',
      storage: createJSONStorage(() => AsyncStorage),
      // Only the working set is persisted; reference data always comes from
      // data.json so an updated dataset is never shadowed by stale storage.
      partialize: (state) => ({ inspections: state.inspections }),
      // Runs once storage has been read, whether or not anything was found.
      onRehydrateStorage: () => () => {
        useInspectionStore.setState({ hydrated: true });
      },
    }
  )
);
