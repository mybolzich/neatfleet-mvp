import type { Route, Visit, Worker } from "./models";

const depot = { lat: 14.5547, lng: 121.0346 };

export function optimizeInBrowser(visits: Visit[], routes: Route[], workers: Worker[]) {
  if (routes.some((route) => route.status === "dispatched" || route.status === "active")) {
    throw new Error("Dispatched routes are locked. Refresh the demo to plan a new day.");
  }

  const assigned = new Map(routes.map((route) => [route.id, [] as Visit[]]));
  const ordered = [...visits].sort(
    (a, b) => priorityRank(b.priority) - priorityRank(a.priority) || a.timeWindow.start.localeCompare(b.timeWindow.start),
  );

  for (const visit of ordered) {
    const compatible = routes.filter((route) => {
      const worker = workers.find((item) => item.id === route.workerId);
      return worker && visit.requiredSkills.every((skill) => worker.skills.includes(skill));
    });
    const choices = compatible.length ? compatible : routes;
    const route = [...choices].sort(
      (a, b) => routeLoad(assigned.get(a.id) ?? []) - routeLoad(assigned.get(b.id) ?? []),
    )[0];
    assigned.get(route.id)!.push(visit);
  }

  const nextRoutes = routes.map((route) => {
    const worker = workers.find((item) => item.id === route.workerId)!;
    const plan = buildRoutePlan(assigned.get(route.id) ?? [], worker);
    return { ...route, status: "ready" as const, ...plan };
  });
  const nextVisits = visits.map((visit) => ({ ...visit, status: "planned" as const }));
  return { visits: nextVisits, routes: nextRoutes };
}

export function assignInBrowser(visits: Visit[], routes: Route[], visitId: string, routeId: string) {
  const visit = visits.find((item) => item.id === visitId);
  const route = routes.find((item) => item.id === routeId);
  if (!visit || !route) throw new Error("Select an unassigned job and a valid route.");
  if (route.status === "dispatched" || route.status === "active") throw new Error("Dispatched routes are locked.");

  const nextVisits = visits.map((item) => item.id === visitId ? { ...item, status: "planned" as const } : item);
  const nextRoutes = routes.map((item) => {
    if (item.id !== routeId) return item;
    const sequence = item.stops.length + 1;
    const previousEta = item.stops.at(-1)?.eta ?? "08:00";
    return {
      ...item,
      status: "ready" as const,
      stops: [...item.stops, { visitId, sequence, eta: addMinutes(previousEta, 45), travelMinutes: 15 }],
      totalDistanceKm: Math.round((item.totalDistanceKm + 4.2) * 10) / 10,
      totalMinutes: item.totalMinutes + visit.serviceMinutes + 15,
    };
  });
  return { visits: nextVisits, routes: nextRoutes };
}

export function dispatchInBrowser(routes: Route[], routeId: string) {
  const route = routes.find((item) => item.id === routeId);
  if (!route?.stops.length) throw new Error("Add at least one job before dispatching.");
  return routes.map((item) => item.id === routeId ? { ...item, status: "dispatched" as const } : item);
}

function buildRoutePlan(jobs: Visit[], worker: Worker) {
  const remaining = [...jobs];
  const ordered: Visit[] = [];
  let point = depot;
  while (remaining.length) {
    remaining.sort((a, b) => distance(point, a.location) - distance(point, b.location));
    const next = remaining.shift()!;
    ordered.push(next);
    point = next.location;
  }

  let clock = timeToMinutes(worker.shift.start);
  let totalDistanceKm = 0;
  point = depot;
  const stops = ordered.map((job, index) => {
    const leg = distance(point, job.location);
    const travelMinutes = Math.max(4, Math.round((leg / 25) * 60));
    totalDistanceKm += leg;
    clock = Math.max(clock + travelMinutes, timeToMinutes(job.timeWindow.start));
    const eta = minutesToTime(clock);
    clock += job.serviceMinutes;
    point = job.location;
    return { visitId: job.id, sequence: index + 1, eta, travelMinutes };
  });
  const returnKm = ordered.length ? distance(point, depot) : 0;
  totalDistanceKm += returnKm;
  clock += Math.round((returnKm / 25) * 60);
  return {
    stops,
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    totalMinutes: Math.max(0, clock - timeToMinutes(worker.shift.start)),
  };
}

function routeLoad(visits: Visit[]) {
  return visits.reduce((sum, visit) => sum + visit.serviceMinutes + visit.demand.units * 8, 0);
}

function priorityRank(priority: Visit["priority"]) {
  return { normal: 0, high: 1, urgent: 2 }[priority];
}

function addMinutes(time: string, minutes: number) {
  return minutesToTime(timeToMinutes(time) + minutes);
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(value: number) {
  const normalized = value % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function distance(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const radians = Math.PI / 180;
  const dLat = (b.lat - a.lat) * radians;
  const dLng = (b.lng - a.lng) * radians;
  const value = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
