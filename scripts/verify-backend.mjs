import { createClient } from "@supabase/supabase-js";

const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: key, DEMO_EMAIL: email, DEMO_PASSWORD: password } = process.env;
if (!url || !key || !email || !password) throw new Error("Cloud and demo credentials are required.");
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const auth = await supabase.auth.signInWithPassword({ email, password });
if (auth.error || !auth.data.user) throw auth.error ?? new Error("Sign-in failed.");
const { data: profile, error: profileError } = await supabase.from("profiles").select("company_id").eq("id", auth.data.user.id).single();
if (profileError) throw profileError;
const companyId = profile.company_id;

const tempOrder = await supabase.from("orders").insert({ company_id: companyId, name: "NF-VERIFY", customer: "Backend Verification", address: "Makati", status: "Pending" }).select("id").single();
if (tempOrder.error) throw tempOrder.error;
const tempDelete = await supabase.from("orders").delete().eq("id", tempOrder.data.id);
if (tempDelete.error) throw tempDelete.error;

const [orderResult, routeResult] = await Promise.all([
  supabase.from("orders").select("id").eq("company_id", companyId).order("created_at").limit(1).single(),
  supabase.from("routes").select("id,vehicle_id").eq("company_id", companyId).order("created_at").limit(1).single(),
]);
if (orderResult.error || routeResult.error) throw orderResult.error ?? routeResult.error;

let stop = await supabase.from("route_stops").select("id").eq("order_id", orderResult.data.id).maybeSingle();
if (stop.error) throw stop.error;
if (!stop.data) {
  stop = await supabase.from("route_stops").insert({ company_id: companyId, route_id: routeResult.data.id, order_id: orderResult.data.id, stop_sequence: 1, eta: 60, status: "Pending" }).select("id").single();
  if (stop.error) throw stop.error;
}
const stopUpdate = await supabase.from("route_stops").update({ eta: 65 }).eq("id", stop.data.id);
if (stopUpdate.error) throw stopUpdate.error;

const routeLive = await supabase.from("routes").update({ status: "Active" }).eq("id", routeResult.data.id);
const vehicleLive = await supabase.from("vehicles").update({ status: "Active" }).eq("id", routeResult.data.vehicle_id);
const orderLive = await supabase.from("orders").update({ status: "In Transit" }).eq("id", orderResult.data.id);
if (routeLive.error || vehicleLive.error || orderLive.error) throw routeLive.error ?? vehicleLive.error ?? orderLive.error;
const event = await supabase.from("dispatch_events").insert({ company_id: companyId, route_id: routeResult.data.id, vehicle_id: routeResult.data.vehicle_id, event_type: "route_dispatched", actor_id: auth.data.user.id, data: { verification: true } });
if (event.error) throw event.error;
const arrived = await supabase.from("route_stops").update({ status: "Arrived", arrival_time: 90 }).eq("id", stop.data.id);
const completedStop = await supabase.from("route_stops").update({ status: "Completed" }).eq("id", stop.data.id);
const completedOrder = await supabase.from("orders").update({ status: "Completed" }).eq("id", orderResult.data.id);
if (arrived.error || completedStop.error || completedOrder.error) throw arrived.error ?? completedStop.error ?? completedOrder.error;
const lifecycleEvent = await supabase.from("dispatch_events").insert([
  { company_id: companyId, route_id: routeResult.data.id, vehicle_id: routeResult.data.vehicle_id, stop_id: stop.data.id, event_type: "stop_arrived", actor_id: auth.data.user.id, data: { verification: true } },
  { company_id: companyId, route_id: routeResult.data.id, vehicle_id: routeResult.data.vehicle_id, stop_id: stop.data.id, event_type: "stop_completed", actor_id: auth.data.user.id, data: { verification: true } },
]);
if (lifecycleEvent.error) throw lifecycleEvent.error;

await Promise.all([
  supabase.from("routes").update({ status: "Planned" }).eq("id", routeResult.data.id),
  supabase.from("vehicles").update({ status: "Idle" }).eq("id", routeResult.data.vehicle_id),
  supabase.from("orders").update({ status: "Pending" }).eq("id", orderResult.data.id),
  supabase.from("route_stops").update({ status: "Pending", arrival_time: null }).eq("id", stop.data.id),
]);
console.log(JSON.stringify({ authenticated: true, jobCrud: true, assignment: true, dispatch: true, stopLifecycle: true, auditEvent: true }));
