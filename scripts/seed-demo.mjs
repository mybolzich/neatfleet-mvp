import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
const email = process.env.DEMO_EMAIL;
const password = process.env.DEMO_PASSWORD;

if (!url || !key || !email || !password) {
  throw new Error("VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, DEMO_EMAIL, and DEMO_PASSWORD are required.");
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
let auth = await supabase.auth.signInWithPassword({ email, password });
if (auth.error) auth = await supabase.auth.signUp({ email, password });
if (auth.error || !auth.data.user) throw auth.error ?? new Error("Demo sign-in failed.");

const user = auth.data.user;
let { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

if (!profile) {
  const companyId = crypto.randomUUID();
  const companyResult = await supabase.from("companies").insert({
    id: companyId,
    name: "NeatFleet Demo Operations",
    slug: `neatfleet-demo-${companyId.slice(0, 6)}`,
    dispatch_address: "Guadalupe, Makati",
    dispatch_lat: 14.5547,
    dispatch_lng: 121.0346,
  });
  if (companyResult.error) throw companyResult.error;
  const profileResult = await supabase.from("profiles").insert({ id: user.id, company_id: companyId, email, full_name: "NeatFleet Demo", role: "owner", active: true });
  if (profileResult.error) throw profileResult.error;
  profile = { id: user.id, company_id: companyId };

  const vehicleResult = await supabase.from("vehicles").insert([
    { company_id: companyId, name: "Van 04", capacity: 12, color: "#186b58", status: "Idle" },
    { company_id: companyId, name: "Van 07", capacity: 10, color: "#e06b3c", status: "Idle" },
  ]).select("id");
  if (vehicleResult.error) throw vehicleResult.error;
  const routeResult = await supabase.from("routes").insert(vehicleResult.data.map((vehicle) => ({ company_id: companyId, vehicle_id: vehicle.id, status: "Planned", created_by: user.id })));
  if (routeResult.error) throw routeResult.error;
  const orderResult = await supabase.from("orders").insert([
    ["NF-2401", "Luna Dental Studio", "Salcedo Village, Makati", 60, 180, 45, "High", 14.5586, 121.0216],
    ["NF-2402", "Maven Coffee Roasters", "Legazpi Village, Makati", 120, 300, 30, "Medium", 14.5534, 121.0171],
    ["NF-2403", "Northpoint Offices", "BGC, Taguig", 300, 480, 90, "High", 14.5515, 121.0482],
    ["NF-2397", "Harbor Wellness", "Rockwell Center, Makati", 30, 150, 40, "Medium", 14.5652, 121.0369],
    ["NF-2398", "Aster Home", "Poblacion, Makati", 120, 240, 15, "Medium", 14.5658, 121.0296],
    ["NF-2399", "Common Ground", "Uptown, BGC", 60, 240, 35, "High", 14.5565, 121.0537],
    ["NF-2400", "Sora Kitchen", "Kapitolyo, Pasig", 210, 390, 20, "Medium", 14.5732, 121.0594],
  ].map(([name, customer, address, start, end, duration, priority, lat, lng], index) => ({ company_id: companyId, name, customer, address, time_window_start: start, time_window_end: end, service_duration: duration, priority, lat, lng, x: 35 + index * 7, y: 30 + index * 8, volume: 1 + index % 3, status: "Pending" })));
  if (orderResult.error) throw orderResult.error;
}

const companyId = profile.company_id;
const [orders, vehicles, routes] = await Promise.all([
  supabase.from("orders").select("id", { count: "exact", head: true }).eq("company_id", companyId),
  supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("company_id", companyId),
  supabase.from("routes").select("id", { count: "exact", head: true }).eq("company_id", companyId),
]);
if (orders.error || vehicles.error || routes.error) throw orders.error ?? vehicles.error ?? routes.error;
console.log(JSON.stringify({ workspaceReady: true, orders: orders.count, vehicles: vehicles.count, routes: routes.count }));
