"use client";

import {
  Bell,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Clock3,
  LayoutDashboard,
  Map,
  MapPin,
  Menu,
  Navigation,
  PackageOpen,
  Plus,
  Route as RouteIcon,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { routes as seedRoutes, vehicles, visits as seedVisits, workers } from "@/domain/demo-data";
import type { CreateJobInput, JobKind, Visit } from "@/domain/models";
import { summarizeRoute } from "@/domain/models";
import type { CompanyProfile, UserProfile } from "@/lib/auth";
import { useCloudPlanner } from "@/lib/planner-backend";

const kindLabel: Record<JobKind, string> = {
  service: "Service",
  delivery: "Delivery",
  pickup: "Pickup",
  inspection: "Inspection",
  installation: "Install",
};

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Plan routes", icon: RouteIcon },
  { label: "Live operations", icon: Navigation },
  { label: "Jobs", icon: Wrench },
  { label: "Team & fleet", icon: Users },
];

export function DispatcherWorkspace({ cloud }: { cloud: { profile: UserProfile; company: CompanyProfile; logout: () => Promise<void> } }) {
  const cloudPlanner = useCloudPlanner(cloud.company.id, cloud.profile.id);
  const [query, setQuery] = useState("");
  const [activeModule, setActiveModule] = useState("Plan routes");
  const [kindFilter, setKindFilter] = useState<"all" | JobKind>("all");
  const [mapMode, setMapMode] = useState<"map" | "timeline">("map");
  const [compactRoutes, setCompactRoutes] = useState(false);
  const [showMapJobs, setShowMapJobs] = useState(true);
  const [mapZoom, setMapZoom] = useState(1);
  const [showNotifications, setShowNotifications] = useState(false);
  const [utilityModal, setUtilityModal] = useState<"help" | "settings" | "setup" | null>(null);
  const [selectedVisitId, setSelectedVisitId] = useState("v-104");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const liveVisits = cloudPlanner.loading ? seedVisits : cloudPlanner.visits;
  const liveRoutes = cloudPlanner.loading ? seedRoutes : cloudPlanner.routes;
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function runAction(action: string, request: () => Promise<string>) {
    setBusyAction(action);
    try {
      setToast(await request());
      window.setTimeout(() => setToast(null), 3200);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusyAction(null);
    }
  }

  function optimize() {
    void runAction("optimize", async () => {
      await cloudPlanner.optimizeRoutes();
      return "Routes optimized across the available team and fleet.";
    });
  }

  function dispatchRoute(routeId: string) {
    void runAction(`dispatch-${routeId}`, async () => {
      await cloudPlanner.dispatchRoute(routeId);
      return "Route dispatched to the assigned field worker.";
    });
  }

  function assignJob(visitId: string, routeId: string) {
    void runAction(`assign-${visitId}`, async () => {
      await cloudPlanner.assignJob(visitId, routeId);
      return "Selected job added to the route.";
    });
  }

  async function createJob(input: CreateJobInput) {
    await cloudPlanner.createJob(input);
    setShowCreateJob(false);
    setToast("New job added to the unassigned queue.");
    window.setTimeout(() => setToast(null), 3200);
  }

  const unassigned = useMemo(
    () =>
      liveVisits.filter(
        (visit) =>
          visit.status === "unassigned" &&
          (kindFilter === "all" || visit.kind === kindFilter) &&
          `${visit.customerName} ${visit.jobId} ${visit.address}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [kindFilter, query, liveVisits],
  );

  const headingCopy = {
    Overview: ["Operations overview", "Track today’s workload and the latest dispatch activity."],
    "Plan routes": ["Shape today's routes", "Balance the workload, honor every promise, and keep the day moving."],
    "Live operations": ["Live operations", "Monitor dispatched routes and field progress in one place."],
    Jobs: ["Jobs", "Create, search, and monitor every customer commitment."],
    "Team & fleet": ["Team & fleet", "Review active workers, vehicles, capacity, and route assignments."],
  }[activeModule] ?? [activeModule, ""];

  const selectedVisit = liveVisits.find((visit) => visit.id === selectedVisitId);
  const plannedStops = liveRoutes.flatMap((route) => route.stops.map((stop) => ({ ...stop, color: route.color })));

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark"><RouteIcon size={20} strokeWidth={2.4} /></div>
          <div className="brand-name">NeatFleet</div>
          <button className="icon-button sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>

        <nav className="main-nav" aria-label="Main navigation">
          <p className="eyebrow nav-label">Workspace</p>
          {navigation.map(({ label, icon: Icon }) => (
            <button className={`nav-item ${activeModule === label ? "active" : ""}`} key={label} onClick={() => { setActiveModule(label); setSidebarOpen(false); }}>
              <Icon size={18} />
              <span>{label}</span>
              {label === "Jobs" ? <span className="nav-count">{liveVisits.length}</span> : null}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="trial-card">
          <span className="trial-icon"><Sparkles size={16} /></span>
          <strong>Build smarter days</strong>
          <p>Your workspace is ready for its first optimized plan.</p>
          <button onClick={() => setUtilityModal("setup")}>View setup guide</button>
        </div>
        <nav className="secondary-nav">
          <button className="nav-item" onClick={() => setUtilityModal("help")}><CircleHelp size={18} /><span>Help center</span></button>
          <button className="nav-item" onClick={() => setUtilityModal("settings")}><Settings size={18} /><span>Settings</span></button>
        </nav>
        <div className="profile-row">
          <div className="avatar avatar-dark">{cloud.profile.full_name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div>
          <div><strong>{cloud.profile.full_name}</strong><span>{cloud.profile.role}</span></div>
          <button className="profile-logout" onClick={() => void cloud.logout()}>Sign out</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div className="location-switcher">
            <span className="location-icon"><MapPin size={16} /></span>
            <div><span>{cloud.company.name}</span><strong>Metro Manila</strong></div>
            <ChevronDown size={16} />
          </div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Notifications" onClick={() => setShowNotifications((current) => !current)}><Bell size={19} />{cloudPlanner.events.length ? <span className="notification-dot" /> : null}</button>
            <button className="primary-button" onClick={() => setShowCreateJob(true)}><Plus size={17} /> Create job</button>
          </div>
          {showNotifications ? <div className="notification-panel"><strong>Dispatch activity</strong>{cloudPlanner.events.length ? cloudPlanner.events.slice(0, 5).map((event) => <p key={event.id}>{event.event_type.replaceAll("_", " ")}<span>{new Date(event.created_at).toLocaleString()}</span></p>) : <p>No dispatch events yet.</p>}</div> : null}
        </header>

        <section className="page-heading">
          <div>
            <div className="breadcrumb"><span>NeatFleet Cloud</span><span>/</span><span>{activeModule}</span></div>
            <h1>{headingCopy[0]}</h1>
            <p>{headingCopy[1]}</p>
          </div>
          <div className="heading-actions">
            <label className="date-button"><CalendarDays size={17} /><input type="date" defaultValue={new Date().toISOString().slice(0, 10)} aria-label="Planning date" /></label>
            {activeModule === "Plan routes" ? <button className="optimize-button" onClick={optimize} disabled={busyAction === "optimize"}><Sparkles size={17} />{busyAction === "optimize" ? "Optimizing…" : "Optimize routes"}</button> : null}
          </div>
        </section>

        <section className="metric-strip" aria-label="Plan summary">
          <Metric label="Total jobs" value={String(liveVisits.length)} detail={`${liveVisits.filter((visit) => visit.status !== "unassigned").length} already planned`} tone="neutral" />
          <Metric label="Unassigned" value={String(unassigned.length)} detail="Needs your attention" tone="warning" />
          <Metric label="Planned distance" value={`${liveRoutes.reduce((total, route) => total + route.totalDistanceKm, 0).toFixed(1)} km`} detail={`Across ${liveRoutes.length} routes`} tone="neutral" />
          <Metric label="Workload" value={`${Math.floor(liveRoutes.reduce((total, route) => total + route.totalMinutes, 0) / 60)}h ${liveRoutes.reduce((total, route) => total + route.totalMinutes, 0) % 60}m`} detail="64% team utilization" tone="success" />
        </section>

        {activeModule === "Plan routes" ? <section className="planner-shell">
          <div className="jobs-panel">
            <div className="panel-heading">
              <div><h2>Unassigned jobs</h2><span className="count-pill">{unassigned.length}</span></div>
            </div>
            <div className="search-field">
              <Search size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search jobs" aria-label="Search jobs" />
              <kbd>⌘ K</kbd>
            </div>
            <div className="filter-row">
              <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as "all" | JobKind)} aria-label="Filter by job type"><option value="all">All types</option>{Object.entries(kindLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
            </div>
            <div className="job-list">
              {unassigned.map((visit) => (
                <JobCard key={visit.id} visit={visit} selected={visit.id === selectedVisitId} onSelect={() => setSelectedVisitId(visit.id)} />
              ))}
              {unassigned.length === 0 ? <div className="empty-search">No jobs match that search.</div> : null}
            </div>
            <button className="add-job-button" onClick={() => setShowCreateJob(true)}><Plus size={16} /> Add another job</button>
          </div>

          <div className="routes-panel">
            <div className="panel-heading route-panel-heading">
              <div><h2>Planned routes</h2><span className="subtle-count">{liveRoutes.length} routes · {liveRoutes.reduce((total, route) => total + route.stops.length, 0)} stops</span></div>
              <div className="route-view-actions"><button className="soft-button" onClick={() => setCompactRoutes((current) => !current)}><SlidersHorizontal size={16} /> {compactRoutes ? "Comfortable" : "Compact"}</button></div>
            </div>
            <div className={`route-list ${compactRoutes ? "route-list-compact" : ""}`}>
              {liveRoutes.map((route) => {
                const worker = workers.find((item) => item.id === route.workerId)!;
                const vehicle = vehicles.find((item) => item.id === route.vehicleId)!;
                const summary = summarizeRoute(route, liveVisits, vehicle);
                return (
                  <article className="route-card" key={route.id}>
                    <div className="route-accent" style={{ background: route.color }} />
                    <div className="route-header">
                      <div className="route-person"><div className="avatar" style={{ background: route.color }}>{worker.initials}</div><div><div className="route-title-line"><h3>{route.label}</h3><span className={`status status-${route.status}`}>{route.status}</span></div><p>{worker.name} · {vehicle.label}</p></div></div>
                    </div>
                    <div className="route-stats">
                      <span><MapPin size={14} />{summary.stopCount} stops</span>
                      <span><RouteIcon size={14} />{summary.totalDistanceKm} km</span>
                      <span><Clock3 size={14} />{Math.floor(summary.totalMinutes / 60)}h {summary.totalMinutes % 60}m</span>
                      <span className="capacity"><i style={{ width: `${summary.utilizationPercent}%`, background: route.color }} />{summary.utilizationPercent}% load</span>
                    </div>
                    <div className="stop-list">
                      {route.stops.map((stop) => {
                        const visit = liveVisits.find((item) => item.id === stop.visitId)!;
                        const isSelected = selectedVisitId === visit.id;
                        return (
                          <button className={`stop-row ${isSelected ? "selected" : ""}`} key={stop.visitId} onClick={() => setSelectedVisitId(visit.id)}>
                            <span className="drag-handle">⠿</span>
                            <span className="stop-sequence" style={{ borderColor: route.color, color: route.color }}>{stop.sequence}</span>
                            <span className="stop-main"><strong>{visit.customerName}</strong><small>{visit.address}</small></span>
                            <span className="stop-time"><strong>{stop.eta}</strong><small>{visit.serviceMinutes} min</small></span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="route-card-actions"><button className="route-add-stop" onClick={() => assignJob(selectedVisitId, route.id)} disabled={!unassigned.some((visit) => visit.id === selectedVisitId) || busyAction === `assign-${selectedVisitId}`}><Plus size={15} />{busyAction === `assign-${selectedVisitId}` ? "Adding…" : "Add selected job"}</button><button className="dispatch-button" onClick={() => dispatchRoute(route.id)} disabled={busyAction === `dispatch-${route.id}` || route.status === "dispatched" || route.status === "completed"}>{route.status === "completed" ? "Completed" : route.status === "dispatched" ? "Dispatched" : busyAction === `dispatch-${route.id}` ? "Dispatching…" : "Dispatch route"}</button></div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="map-panel">
            <div className="map-toolbar">
              <div className="map-tabs"><button className={mapMode === "map" ? "active" : ""} onClick={() => setMapMode("map")}><Map size={15} />Map</button><button className={mapMode === "timeline" ? "active" : ""} onClick={() => setMapMode("timeline")}>Timeline</button></div>
              <button className="map-layer-button" onClick={() => setShowMapJobs((current) => !current)}><PackageOpen size={15} />Jobs {showMapJobs ? "on" : "off"}</button>
            </div>
            {mapMode === "map" ? <div className="map-canvas" style={{ transform: `scale(${mapZoom})` }}>
              <div className="map-road road-one" /><div className="map-road road-two" /><div className="map-road road-three" />
              <svg className="route-lines" viewBox="0 0 600 500" preserveAspectRatio="none" aria-hidden="true">
                <path d="M110,350 C180,310 205,180 300,230 S430,330 505,170" className="route-path route-path-green" />
                <path d="M100,390 C210,420 290,350 360,390 S470,430 525,300" className="route-path route-path-orange" />
              </svg>
              {showMapJobs ? plannedStops.slice(0, 4).map((stop, index) => <MapMarker key={stop.visitId} number={String(stop.sequence)} color={stop.color} position={{ left: `${[48, 77, 57, 83][index]}%`, top: `${[41, 27, 70, 56][index]}%` }} active={selectedVisitId === stop.visitId} onSelect={() => setSelectedVisitId(stop.visitId)} />) : null}
              <div className="depot-marker"><span>NF</span><div><strong>NeatFleet Hub</strong><small>Guadalupe, Makati</small></div></div>
              {selectedVisit ? <div className="selected-map-card"><span className={`kind-icon kind-${selectedVisit.kind}`}>{kindLabel[selectedVisit.kind].slice(0, 1)}</span><div><strong>{selectedVisit.customerName}</strong><small>{selectedVisit.timeWindow.start}–{selectedVisit.timeWindow.end} · {selectedVisit.serviceMinutes} min</small></div></div> : null}
              <div className="map-zoom"><button onClick={() => setMapZoom((value) => Math.min(1.2, value + 0.05))}>+</button><button onClick={() => setMapZoom((value) => Math.max(.9, value - 0.05))}>−</button></div>
              <div className="map-attribution">Development map preview</div>
            </div> : <div className="timeline-panel">{liveRoutes.map((route) => <section key={route.id}><strong>{route.label}</strong>{route.stops.map((stop) => { const visit = liveVisits.find((item) => item.id === stop.visitId); return <button key={stop.visitId} onClick={() => setSelectedVisitId(stop.visitId)}><span>{stop.eta}</span><div><strong>{visit?.customerName}</strong><small>{visit?.address}</small></div></button>; })}</section>)}</div>}
          </div>
        </section> : <ModulePanel module={activeModule} visits={liveVisits} routes={liveRoutes} events={cloudPlanner.events} onCreateJob={() => setShowCreateJob(true)} onDispatch={dispatchRoute} onStopUpdate={(visitId, status) => void runAction(`stop-${visitId}-${status}`, async () => { await cloudPlanner.updateStopStatus(visitId, status); return status === "Arrived" ? "Stop marked arrived." : "Stop completed and audit event saved."; })} />}
        {toast ? <div className="toast" role="status"><span className="toast-dot" />{toast}</div> : null}
        {cloudPlanner.error ? <div className="toast toast-error" role="alert"><span className="toast-dot" />Cloud error: {cloudPlanner.error}</div> : null}
        {showCreateJob ? <CreateJobModal onClose={() => setShowCreateJob(false)} onCreated={createJob} /> : null}
        {utilityModal ? <UtilityModal kind={utilityModal} company={cloud.company} onClose={() => setUtilityModal(null)} /> : null}
      </main>
    </div>
  );
}

function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong><small className={`metric-${tone}`}>{detail}</small></div>;
}

function JobCard({ visit, selected, onSelect }: { visit: Visit; selected: boolean; onSelect: () => void }) {
  return (
    <button className={`job-card ${selected ? "selected" : ""}`} onClick={onSelect}>
      <div className="job-topline"><span className={`kind-badge kind-${visit.kind}`}>{kindLabel[visit.kind]}</span><span className={`priority priority-${visit.priority}`}>{visit.priority !== "normal" ? visit.priority : ""}</span><span className="job-id">{visit.jobId}</span></div>
      <strong>{visit.customerName}</strong>
      <p><MapPin size={13} />{visit.address}</p>
      <div className="job-meta"><span><Clock3 size={13} />{visit.timeWindow.start}–{visit.timeWindow.end}</span><span>{visit.serviceMinutes} min</span></div>
    </button>
  );
}

function MapMarker({ number, color, position, active, onSelect }: { number: string; color: string; position: React.CSSProperties; active: boolean; onSelect: () => void }) {
  return <button className={`map-marker ${active ? "active" : ""}`} style={{ ...position, background: color }} aria-label={`Route stop ${number}`} onClick={onSelect}>{number}</button>;
}

function ModulePanel({ module, visits, routes, events, onCreateJob, onDispatch, onStopUpdate }: { module: string; visits: Visit[]; routes: import("@/domain/models").Route[]; events: Array<{ id: string; event_type: string; created_at: string }>; onCreateJob: () => void; onDispatch: (routeId: string) => void; onStopUpdate: (visitId: string, status: "Arrived" | "Completed") => void }) {
  if (module === "Jobs") return <section className="module-panel"><div className="module-toolbar"><h2>All jobs</h2><button className="primary-button" onClick={onCreateJob}><Plus size={16} />Create job</button></div><div className="data-table"><div className="data-row data-head"><span>Job</span><span>Customer</span><span>Window</span><span>Status</span></div>{visits.map((visit) => <div className="data-row" key={visit.id}><span>{visit.jobId}</span><strong>{visit.customerName}<small>{visit.address}</small></strong><span>{visit.timeWindow.start}–{visit.timeWindow.end}</span><span className={`status status-${visit.status}`}>{visit.status.replace("_", " ")}</span></div>)}</div></section>;
  if (module === "Live operations") return <section className="module-panel"><div className="module-toolbar"><h2>Route status</h2><span>{routes.filter((route) => route.status === "dispatched").length} dispatched</span></div><div className="module-grid">{routes.map((route) => <article className="module-card" key={route.id}><span className={`status status-${route.status}`}>{route.status}</span><h3>{route.label}</h3><p>{route.stops.length} stops · {route.totalDistanceKm} km</p><button className="dispatch-button module-action" disabled={route.status === "dispatched" || route.status === "completed" || !route.stops.length} onClick={() => onDispatch(route.id)}>{route.status === "completed" ? "Route completed" : route.status === "dispatched" ? "Live in field" : "Dispatch route"}</button>{route.status === "dispatched" ? <div className="live-stop-list">{route.stops.map((stop) => { const visit = visits.find((item) => item.id === stop.visitId); return <div key={stop.visitId}><strong>{visit?.customerName}</strong><span><button onClick={() => onStopUpdate(stop.visitId, "Arrived")}>Arrived</button><button onClick={() => onStopUpdate(stop.visitId, "Completed")}>Complete</button></span></div>; })}</div> : null}</article>)}</div><div className="activity-list"><h2>Latest activity</h2>{events.length ? events.map((event) => <p key={event.id}><span>{event.event_type.replaceAll("_", " ")}</span><time>{new Date(event.created_at).toLocaleString()}</time></p>) : <p>No dispatch events yet.</p>}</div></section>;
  if (module === "Team & fleet") return <section className="module-panel"><div className="module-toolbar"><h2>Team and vehicles</h2><span>{workers.length} workers · {vehicles.length} vehicles</span></div><div className="module-grid">{workers.map((worker, index) => <article className="module-card" key={worker.id}><div className="avatar" style={{ background: routes[index]?.color ?? "#176b58" }}>{worker.initials}</div><h3>{worker.name}</h3><p>{vehicles[index]?.label} · Shift {worker.shift.start}–{worker.shift.end}</p><span className={`status status-${routes[index]?.status ?? "draft"}`}>{routes[index]?.status ?? "unassigned"}</span></article>)}</div></section>;
  return <section className="module-panel"><div className="module-toolbar"><h2>Today at a glance</h2><span>Cloud data is live</span></div><div className="overview-cards"><Metric label="Jobs" value={String(visits.length)} detail={`${visits.filter((visit) => visit.status === "completed").length} completed`} tone="neutral" /><Metric label="Routes" value={String(routes.length)} detail={`${routes.filter((route) => route.status === "dispatched").length} dispatched`} tone="success" /><Metric label="Exceptions" value={String(visits.filter((visit) => visit.status === "exception").length)} detail="Needs review" tone="warning" /></div><div className="activity-list"><h2>Recent dispatch activity</h2>{events.length ? events.map((event) => <p key={event.id}><span>{event.event_type.replaceAll("_", " ")}</span><time>{new Date(event.created_at).toLocaleString()}</time></p>) : <p>Optimize and dispatch a route to begin the audit trail.</p>}</div></section>;
}

function UtilityModal({ kind, company, onClose }: { kind: "help" | "settings" | "setup"; company: CompanyProfile; onClose: () => void }) {
  const copy = kind === "settings"
    ? { title: "Workspace settings", body: `${company.name} operates from ${company.dispatch_address || "its configured dispatch hub"}. Company data is isolated through Supabase row-level security.` }
    : kind === "setup"
      ? { title: "MVP setup guide", body: "Create jobs, select an unassigned job, add it to a route, optimize the day, and dispatch ready routes. Every change is saved to NeatFleet Cloud." }
      : { title: "Help center", body: "For the MVP demonstration: start in Plan routes, create or assign work, optimize, then use Live operations to dispatch and review the audit trail." };
  return <div className="modal-backdrop"><section className="modal-card utility-card"><div className="modal-header"><div><span className="eyebrow">NeatFleet</span><h2>{copy.title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div><p>{copy.body}</p><div className="modal-actions"><button className="primary-button" onClick={onClose}>Done</button></div></section></div>;
}

function CreateJobModal({ onClose, onCreated }: { onClose: () => void; onCreated: (job: CreateJobInput) => Promise<void> }) {
  const [form, setForm] = useState({ customerName: "", address: "", kind: "service" as JobKind, serviceMinutes: "30", priority: "normal" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onCreated({
        ...form,
        priority: form.priority as Visit["priority"],
        serviceMinutes: Number(form.serviceMinutes),
        timeWindow: { start: "09:00", end: "17:00" },
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not create the job.");
    } finally {
      setSaving(false);
    }
  }
  return <div className="modal-backdrop" role="presentation"><form className="modal-card" onSubmit={submit}><div className="modal-header"><div><span className="eyebrow">New work item</span><h2>Create a job</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close create job dialog"><X size={18} /></button></div><label>Customer or site<input required value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} placeholder="e.g. Acme Facilities" /></label><label>Address<input required value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Street, city, region" /></label><div className="form-grid"><label>Job type<select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as JobKind })}>{Object.entries(kindLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Service minutes<input type="number" min="5" max="480" value={form.serviceMinutes} onChange={(event) => setForm({ ...form, serviceMinutes: event.target.value })} /></label></div><label>Priority<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>{error ? <p className="form-error">{error}</p> : null}<div className="modal-actions"><button type="button" className="soft-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Creating…" : "Create job"}</button></div></form></div>;
}
