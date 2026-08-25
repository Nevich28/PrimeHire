/**
 * The client's dataset, loaded verbatim.
 *
 * `data.json` stays at the repository root exactly as it was handed over. It is
 * the only source of projects and inspectors — those are reference data the app
 * reads but never edits, so they are indexed once here and used directly.
 * Inspections are the working set and live in the store.
 */

import raw from '../../data.json';
import type { Dataset, Inspection, Inspector, Project } from './types.ts';

export const dataset = raw as Dataset;

export const COMPANY = dataset.meta.company;

export const PROJECTS: Record<string, Project> = Object.fromEntries(
  dataset.projects.map((project) => [project.id, project])
);

export const INSPECTORS: Record<string, Inspector> = Object.fromEntries(
  dataset.inspectors.map((inspector) => [inspector.id, inspector])
);

export const PROJECT_LIST: Project[] = [...dataset.projects].sort((a, b) =>
  a.code.localeCompare(b.code)
);

export const INSPECTOR_LIST: Inspector[] = [...dataset.inspectors].sort((a, b) =>
  a.name.localeCompare(b.name)
);

export const SEED_INSPECTIONS: Inspection[] = dataset.inspections;

/** Every discipline that appears in the data, offered when creating work. */
export const INSPECTION_TYPES: string[] = Array.from(
  new Set(dataset.inspections.map((inspection) => inspection.type))
).sort();
