import { describe, expect, it } from "vitest";
import { routes, visits, workers } from "./demo-data";
import { assignInBrowser, dispatchInBrowser, optimizeInBrowser } from "./client-operations";

describe("GitHub Pages planner operations", () => {
  it("assigns an unassigned job to a route", () => {
    const result = assignInBrowser(visits, routes, "v-101", "r-1");
    expect(result.visits.find((visit) => visit.id === "v-101")?.status).toBe("planned");
    expect(result.routes.find((route) => route.id === "r-1")?.stops.at(-1)?.visitId).toBe("v-101");
  });

  it("optimizes every job into the available routes", () => {
    const result = optimizeInBrowser(visits, routes, workers);
    expect(result.visits.every((visit) => visit.status === "planned")).toBe(true);
    expect(result.routes.flatMap((route) => route.stops)).toHaveLength(visits.length);
  });

  it("dispatches a planned route", () => {
    const result = dispatchInBrowser(routes, "r-1");
    expect(result.find((route) => route.id === "r-1")?.status).toBe("dispatched");
  });
});
