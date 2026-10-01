import catalog from '../data/routeCatalog.json';
import type { Ride, TransitMode } from '../types';

export type CompendiumMode = TransitMode;

interface RouteEntry {
  id: string;
  label: string;
}

const GROUPS: { mode: CompendiumMode; title: string; routes: RouteEntry[] }[] = [
  { mode: 'max', title: 'MAX', routes: catalog.max },
  { mode: 'wes', title: 'WES', routes: catalog.wes },
  { mode: 'streetcar', title: 'Streetcar', routes: catalog.streetcar },
  { mode: 'bus', title: 'Buses', routes: catalog.bus },
];

const byId = new Map<string, { mode: CompendiumMode; label: string }>();
for (const group of GROUPS) {
  for (const route of group.routes) {
    byId.set(route.id, { mode: group.mode, label: route.label });
  }
}

export function routeCompendium(rides: Ride[]) {
  const seen = {
    max: new Set<string>(),
    wes: new Set<string>(),
    streetcar: new Set<string>(),
    bus: new Set<string>(),
  };

  for (const ride of rides) {
    const id = String(ride.routeNumber).trim();
    const known = byId.get(id);
    if (!known) continue;
    seen[known.mode].add(id);
  }

  return GROUPS.map((group) => {
    const ids = [...seen[group.mode]].sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
      return a.localeCompare(b);
    });
    return {
      mode: group.mode,
      title: group.title,
      ridden: ids.length,
      total: group.routes.length,
    };
  });
}
