/**
 * How long it takes to get from one site to another.
 *
 * `data.json` gives every project a street address but no coordinates, and the
 * difference between two sites matters enormously: Winterthur to Frauenfeld is
 * half an hour, Basel to St. Gallen is most of a morning. A single flat buffer
 * treats those as the same thing, which means it nags about the short hop and
 * says nothing about the impossible one.
 *
 * So the towns in those addresses are given coordinates here, the same way the
 * site access windows are transcribed in `site-access.ts`. These are town
 * centres taken from the postcode in each address — public facts, not guesses
 * — and they are deliberately not presented as anything more precise. Real
 * geocoding of the street addresses, and real routing, is the upgrade; this is
 * the version that fits in the data we were given.
 */

import type { Project } from './types.ts';

type Coordinates = { lat: number; lon: number; town: string };

/** Town centres for the postcodes that appear in the project addresses. */
const SITE_LOCATIONS: Record<string, Coordinates> = {
  'prj-001': { lat: 47.4996, lon: 8.7241, town: 'Winterthur' }, // 8404
  'prj-002': { lat: 47.558, lon: 8.899, town: 'Frauenfeld' }, // 8500
  'prj-003': { lat: 47.3925, lon: 8.506, town: 'Zürich' }, // 8005, Hardturm
  'prj-004': { lat: 47.558, lon: 8.899, town: 'Frauenfeld' }, // 8500
  'prj-005': { lat: 47.4245, lon: 9.3767, town: 'St. Gallen' }, // 9000
  'prj-006': { lat: 47.0502, lon: 8.3093, town: 'Luzern' }, // 6000
  'prj-007': { lat: 46.948, lon: 7.4474, town: 'Bern' }, // 3008
  'prj-008': { lat: 47.5596, lon: 7.5886, town: 'Basel' }, // 4057
};

const EARTH_RADIUS_KM = 6371;

/**
 * Road distance is longer than the straight line; 1.3 is the usual planning
 * factor and holds up well across a road network as dense as Switzerland's.
 */
const DETOUR_FACTOR = 1.3;

/** Town driving is slow. */
const URBAN_KM = 15;
const URBAN_SPEED_KMH = 45;

/** Beyond that, these journeys are motorway. */
const OPEN_ROAD_SPEED_KMH = 90;

/** Parking, signing in at the gate, and getting into PPE. */
const SITE_OVERHEAD_MINUTES = 10;

function haversineKm(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function siteLocation(project: Project): Coordinates | null {
  return SITE_LOCATIONS[project.id] ?? null;
}

/** The town an inspector would name when talking about this site. */
export function townOf(project: Project): string {
  const known = SITE_LOCATIONS[project.id];
  if (known) return known.town;
  // Swiss addresses end with "<postcode> <town>".
  const tail = project.address.split(',').pop()?.trim() ?? '';
  return tail.replace(/^\d{4}\s+/, '') || 'another site';
}

/**
 * Minutes needed to get from one site to another, including getting on and off
 * each one. Returns null when either site has no known location.
 *
 * Rounded to five minutes, because presenting "43 minutes" from a straight-line
 * estimate would claim a precision this does not have.
 */
export function travelMinutesBetween(from: Project, to: Project): number | null {
  const origin = SITE_LOCATIONS[from.id];
  const destination = SITE_LOCATIONS[to.id];
  if (!origin || !destination) return null;

  const roadKm = haversineKm(origin, destination) * DETOUR_FACTOR;
  const urbanKm = Math.min(roadKm, URBAN_KM);
  const openRoadKm = Math.max(0, roadKm - URBAN_KM);

  const minutes =
    (urbanKm / URBAN_SPEED_KMH) * 60 +
    (openRoadKm / OPEN_ROAD_SPEED_KMH) * 60 +
    SITE_OVERHEAD_MINUTES;

  return Math.max(5, Math.round(minutes / 5) * 5);
}
