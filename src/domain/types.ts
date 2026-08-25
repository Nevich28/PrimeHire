/**
 * Domain model.
 *
 * The shapes below mirror `data.json` deliberately: the seed file is the
 * client's data and the app has to keep working with it verbatim, so the store
 * speaks the same language (ISO strings included) and anything we persist can
 * be diffed against the original without a translation layer.
 *
 * Absolute instants are derived where they are needed, never stored.
 */

export type InspectionStatus = 'scheduled' | 'completed' | 'cancelled';

export type Priority = 'normal' | 'high' | 'critical';

export type ProjectStatus = 'active' | 'on_hold' | 'completed';

/**
 * The seed data uses a small set of discipline tags. It is typed as an open
 * union so that data we have not seen yet degrades to a plain label instead of
 * crashing a screen.
 */
export type InspectionType =
  | 'structural'
  | 'concrete'
  | 'electrical'
  | 'safety'
  | 'drainage'
  | 'facade'
  | 'environmental'
  | (string & {});

export type Inspector = {
  id: string;
  name: string;
  email: string;
  /** Not every inspector has a mobile number on file. */
  phone: string | null;
  /** Inactive inspectors keep their history but cannot take new work. */
  active: boolean;
  specialties: string[];
};

export type ProjectContact = {
  name: string;
  phone: string | null;
};

export type Project = {
  id: string;
  /** Short code such as `A12-NA-018`. Two projects can have near-identical
   *  names, so the code is the only thing that reliably tells them apart. */
  code: string;
  name: string;
  client: string;
  address: string;
  status: ProjectStatus;
  /** Free-text site briefing. May carry access rules — see `site-access.ts`. */
  siteNote: string | null;
  contact: ProjectContact;
};

export type Inspection = {
  id: string;
  projectId: string;
  /** Null means nobody is going to site yet. */
  inspectorId: string | null;
  title: string;
  type: InspectionType;
  status: InspectionStatus;
  priority: Priority;
  startsAt: string;
  endsAt: string;
  notes: string | null;
  createdAt: string;
  cancellationReason: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
};

export type Dataset = {
  meta: {
    exerciseDate: string;
    timezone: string;
    company: string;
  };
  inspectors: Inspector[];
  projects: Project[];
  inspections: Inspection[];
};

/** An inspection joined with its project and inspector, plus parsed instants. */
export type ResolvedInspection = {
  inspection: Inspection;
  project: Project;
  inspector: Inspector | null;
  start: number;
  end: number;
};
