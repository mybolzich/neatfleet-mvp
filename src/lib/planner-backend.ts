import { useCallback, useEffect, useState } from "react";
import { routes as seedRoutes, visits as seedVisits, workers } from "@/domain/demo-data";
import { optimizeInBrowser } from "@/domain/client-operations";
import type { CreateJobInput, Route, RouteStatus, Visit } from "@/domain/models";
import { supabase } from "./supabase";

interface DispatchEvent {
  id: string;
  event_type: string;
  created_at: string;
  data: Record<string, unknown> | null;
}

interface CloudSnapshot {
  visits: Visit[];
  routes: Route[];
  events: DispatchEvent[];
}

export function useCloudPlanner(companyId: string, actorId: string) {
  const [snapshot, setSnapshot] = useState<CloudSnapshot>({ visits: seedVisits, routes: seedRoutes, events: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setSnapshot(await loadCloudSnapshot(companyId));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load the cloud planner.");
      throw nextError;
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void refresh(), 0);
    const channel = supabase.channel(`neatfleet-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `company_id=eq.${companyId}` }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "routes", filter: `company_id=eq.${companyId}` }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "route_stops", filter: `company_id=eq.${companyId}` }, () => void refresh())
      .subscribe();
    return () => { window.clearTimeout(initialLoad); void supabase.removeChannel(channel); };
  }, [companyId, refresh]);

  async function createJob(input: CreateJobInput) {
    const { error: insertError } = await supabase.from("orders").insert({
      company_id: companyId,
      name: `NF-${Date.now().toString().slice(-6)}`,
      customer: input.customerName,
      address: input.address,
      lat: 14.5547,
      lng: 121.0346,
      x: 50,
      y: 50,
      volume: 1,
      time_window_start: timeToOffset(input.timeWindow.start),
      time_window_end: timeToOffset(input.timeWindow.end),
      service_duration: input.serviceMinutes,
      priority: input.priority === "normal" ? "Medium" : "High",
      status: "Pending",
    });
    if (insertError) throw insertError;
    await refresh();
  }

  async function assignJob(visitId: string, routeId: string) {
    const route = snapshot.routes.find((item) => item.id === routeId);
    const visit = snapshot.visits.find((item) => item.id === visitId);
    if (!route || !visit) throw new Error("Select an unassigned job and a route.");
    const sequence = route.stops.length + 1;
    const { error: insertError } = await supabase.from("route_stops").insert({
      company_id: companyId,
      route_id: routeId,
      order_id: visitId,
      stop_sequence: sequence,
      eta: timeToOffset(route.stops.at(-1)?.eta ?? "08:00") + 45,
      status: "Pending",
    });
    if (insertError) throw insertError;
    await refresh();
  }

  async function optimizeRoutes() {
    const optimized = optimizeInBrowser(snapshot.visits, snapshot.routes, workers);
    const { data: existing, error: readError } = await supabase.from("route_stops").select("id,order_id").eq("company_id", companyId);
    if (readError) throw readError;
    const existingByOrder = new Map((existing ?? []).map((stop) => [stop.order_id as string, stop.id as string]));

    for (const route of optimized.routes) {
      const { error: routeError } = await supabase.from("routes").update({ status: "Planned" }).eq("id", route.id);
      if (routeError) throw routeError;
      for (const stop of route.stops) {
        const values = {
          company_id: companyId,
          route_id: route.id,
          order_id: stop.visitId,
          stop_sequence: stop.sequence,
          eta: timeToOffset(stop.eta),
          status: "Pending",
        };
        const existingId = existingByOrder.get(stop.visitId);
        const result = existingId
          ? await supabase.from("route_stops").update(values).eq("id", existingId)
          : await supabase.from("route_stops").insert(values);
        if (result.error) throw result.error;
      }
    }
    await refresh();
  }

  async function dispatchRoute(routeId: string) {
    const route = snapshot.routes.find((item) => item.id === routeId);
    if (!route?.stops.length) throw new Error("Add at least one job before dispatching.");
    const orderIds = route.stops.map((stop) => stop.visitId);
    const { error: routeError } = await supabase.from("routes").update({ status: "Active" }).eq("id", routeId);
    if (routeError) throw routeError;
    const { data: routeRecord, error: routeReadError } = await supabase.from("routes").select("vehicle_id").eq("id", routeId).single();
    if (routeReadError) throw routeReadError;
    const { error: vehicleError } = await supabase.from("vehicles").update({ status: "Active" }).eq("id", routeRecord.vehicle_id);
    if (vehicleError) throw vehicleError;
    const { error: orderError } = await supabase.from("orders").update({ status: "In Transit" }).in("id", orderIds);
    if (orderError) throw orderError;
    const { error: eventError } = await supabase.from("dispatch_events").insert({
      company_id: companyId,
      route_id: routeId,
      vehicle_id: routeRecord.vehicle_id,
      event_type: "route_dispatched",
      actor_id: actorId,
      data: { stop_count: orderIds.length },
    });
    if (eventError) throw eventError;
    await refresh();
  }

  async function updateStopStatus(visitId: string, status: "Arrived" | "Completed") {
    const { data: stop, error: stopReadError } = await supabase.from("route_stops").select("id,route_id").eq("company_id", companyId).eq("order_id", visitId).single();
    if (stopReadError) throw stopReadError;
    const { data: routeRecord, error: routeReadError } = await supabase.from("routes").select("vehicle_id").eq("id", stop.route_id).single();
    if (routeReadError) throw routeReadError;
    const { error: stopError } = await supabase.from("route_stops").update({ status, arrival_time: status === "Arrived" ? timeToOffset(new Date().toTimeString().slice(0, 5)) : undefined }).eq("id", stop.id);
    if (stopError) throw stopError;
    const { error: orderError } = await supabase.from("orders").update({ status: status === "Completed" ? "Completed" : "In Transit" }).eq("id", visitId);
    if (orderError) throw orderError;
    const { error: eventError } = await supabase.from("dispatch_events").insert({
      company_id: companyId,
      route_id: stop.route_id,
      vehicle_id: routeRecord.vehicle_id,
      stop_id: stop.id,
      event_type: status === "Completed" ? "stop_completed" : "stop_arrived",
      actor_id: actorId,
      data: { order_id: visitId },
    });
    if (eventError) throw eventError;

    if (status === "Completed") {
      const { data: remaining, error: remainingError } = await supabase.from("route_stops").select("id").eq("route_id", stop.route_id).neq("status", "Completed");
      if (remainingError) throw remainingError;
      if (!remaining?.length) {
        await Promise.all([
          supabase.from("routes").update({ status: "Completed" }).eq("id", stop.route_id),
          supabase.from("vehicles").update({ status: "Idle" }).eq("id", routeRecord.vehicle_id),
          supabase.from("dispatch_events").insert({ company_id: companyId, route_id: stop.route_id, vehicle_id: routeRecord.vehicle_id, event_type: "route_completed", actor_id: actorId }),
        ]);
      }
    }
    await refresh();
  }

  return { ...snapshot, loading, error, refresh, createJob, assignJob, optimizeRoutes, dispatchRoute, updateStopStatus };
}

async function loadCloudSnapshot(companyId: string): Promise<CloudSnapshot> {
  const [ordersResult, vehiclesResult, routesResult, stopsResult, eventsResult] = await Promise.all([
    supabase.from("orders").select("*").eq("company_id", companyId).order("created_at"),
    supabase.from("vehicles").select("*").eq("company_id", companyId).order("created_at"),
    supabase.from("routes").select("*").eq("company_id", companyId).order("created_at"),
    supabase.from("route_stops").select("*").eq("company_id", companyId).order("stop_sequence"),
    supabase.from("dispatch_events").select("id,event_type,created_at,data").eq("company_id", companyId).order("created_at", { ascending: false }).limit(20),
  ]);
  const failure = [ordersResult.error, vehiclesResult.error, routesResult.error, stopsResult.error, eventsResult.error].find(Boolean);
  if (failure) throw failure;

  const stops = stopsResult.data ?? [];
  const stopByOrder = new Map(stops.map((stop) => [stop.order_id as string, stop]));
  const visits: Visit[] = (ordersResult.data ?? []).map((order) => {
    const stop = stopByOrder.get(order.id);
    return {
      id: order.id,
      jobId: order.name,
      kind: "service",
      customerName: order.customer,
      address: order.address,
      location: { lat: order.lat ?? 14.5547, lng: order.lng ?? 121.0346 },
      serviceMinutes: order.service_duration,
      timeWindow: { start: offsetToTime(order.time_window_start), end: offsetToTime(order.time_window_end) },
      requiredSkills: [],
      demand: { units: order.volume },
      priority: order.priority === "High" ? "high" : "normal",
      status: order.status === "Completed" ? "completed" : order.status === "In Transit" ? "in_progress" : stop ? "planned" : "unassigned",
    };
  });

  const vehicleById = new Map((vehiclesResult.data ?? []).map((vehicle) => [vehicle.id as string, vehicle]));
  const routes: Route[] = (routesResult.data ?? []).map((route, index) => {
    const vehicle = vehicleById.get(route.vehicle_id);
    const routeStops = stops.filter((stop) => stop.route_id === route.id).sort((a, b) => a.stop_sequence - b.stop_sequence);
    const status = mapRouteStatus(route.status, routeStops.length);
    return {
      id: route.id,
      label: index === 0 ? "Central AM" : index === 1 ? "East Loop" : vehicle?.name ?? `Route ${index + 1}`,
      workerId: index % 2 ? "w-2" : "w-1",
      vehicleId: index % 2 ? "veh-2" : "veh-1",
      color: vehicle?.color ?? (index % 2 ? "#e06b3c" : "#186b58"),
      status,
      stops: routeStops.map((stop) => ({ visitId: stop.order_id, sequence: stop.stop_sequence, eta: offsetToTime(stop.eta ?? 0), travelMinutes: 15 })),
      totalDistanceKm: Math.round(routeStops.length * 8.7 * 10) / 10,
      totalMinutes: routeStops.reduce((total, stop) => total + 15 + (visits.find((visit) => visit.id === stop.order_id)?.serviceMinutes ?? 20), 0),
    };
  });

  return { visits, routes, events: (eventsResult.data ?? []) as DispatchEvent[] };
}

function mapRouteStatus(status: string, stopCount: number): RouteStatus {
  if (status === "Active") return "dispatched";
  if (status === "Completed") return "completed";
  if (status === "Cancelled") return "draft";
  return stopCount ? "ready" : "draft";
}

function timeToOffset(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return Math.max(0, hours * 60 + minutes - 480);
}

function offsetToTime(offset: number) {
  const total = 480 + offset;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
