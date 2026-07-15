"use client";

import {
  Bell,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Clock3,
  Filter,
  LayoutDashboard,
  Map,
  MapPin,
  Menu,
  MoreHorizontal,
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
import { useEffect, useMemo, useState } from "react";
import { routes as seedRoutes, vehicles, visits as seedVisits, workers } from "@/domain/demo-data";
import { assignInBrowser, dispatchInBrowser, optimizeInBrowser } from "@/domain/client-operations";
import type { CreateJobInput, JobKind, Route, Visit } from "@/domain/models";
import { summarizeRoute } from "@/domain/models";

const demoStorageKey = "neatfleet-mvp-planner-v1";

function loadDemoState(): { visits: Visit[]; routes: Route[] } | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(demoStorageKey) ?? "null") as { visits: Visit[]; routes: Route[] } | null;
  } catch {
    return null;
  }
}

const kindLabel: Record<JobKind, string> = {
  service: "Service",
  delivery: "Delivery",
  pickup: "Pickup",
  inspection: "Inspection",
  installation: "Install",
};

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Plan routes", icon: RouteIcon, active: true },
  { label: "Live operations", icon: Navigation },
  { label: "Jobs", icon: Wrench, count: 7 },
  { label: "Team & fleet", icon: Users },
];

export function DispatcherWorkspace() {
  const [query, setQuery] = useState("");
  const [selectedVisitId, setSelectedVisitId] = useState("v-104");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [liveVisits, setLiveVisits] = useState<Visit[]>(() => loadDemoState()?.visits ?? seedVisits);
  const [liveRoutes, setLiveRoutes] = useState<Route[]>(() => loadDemoState()?.routes ?? seedRoutes);
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    window.localStorage.setItem(demoStorageKey, JSON.stringify({ visits: liveVisits, routes: liveRoutes }));
  }, [liveRoutes, liveVisits]);

  function runAction(action: string, request: () => string) {
    setBusyAction(action);
    try {
      setToast(request());
      window.setTimeout(() => setToast(null), 3200);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusyAction(null);
    }
  }

  function optimize() {
    runAction("optimize", () => {
      const optimized = optimizeInBrowser(liveVisits, liveRoutes, workers);
      setLiveVisits(optimized.visits);
      setLiveRoutes(optimized.routes);
      return "Routes optimized across the available team and fleet.";
    });
  }

  function dispatchRoute(routeId: string) {
    runAction(`dispatch-${routeId}`, () => {
      setLiveRoutes(dispatchInBrowser(liveRoutes, routeId));
      return "Route dispatched to the assigned field worker.";
    });
  }

  function assignJob(visitId: string, routeId: string) {
    runAction(`assign-${visitId}`, () => {
      const assigned = assignInBrowser(liveVisits, liveRoutes, visitId, routeId);
      setLiveVisits(assigned.visits);
      setLiveRoutes(assigned.routes);
      return "Selected job added to the route.";
    });
  }

  function createJob(input: CreateJobInput) {
    const sequence = liveVisits.length + 1;
    const visit: Visit = {
      ...input,
      id: `v-demo-${Date.now()}`,
      jobId: `NF-${2400 + sequence}`,
      location: { lat: 14.5547 + sequence * 0.001, lng: 121.0346 + sequence * 0.001 },
      requiredSkills: [],
      demand: { units: 1 },
      status: "unassigned",
    };
    setLiveVisits((current) => [...current, visit]);
    setSelectedVisitId(visit.id);
    setShowCreateJob(false);
    setToast("New job added to the unassigned queue.");
    window.setTimeout(() => setToast(null), 3200);
  }

  const unassigned = useMemo(
    () =>
      liveVisits.filter(
        (visit) =>
          visit.status === "unassigned" &&
          `${visit.customerName} ${visit.jobId} ${visit.address}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [query, liveVisits],
  );

  const selectedVisit = liveVisits.find((visit) => visit.id === selectedVisitId);

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
          {navigation.map(({ label, icon: Icon, active, count }) => (
            <button className={`nav-item ${active ? "active" : ""}`} key={label}>
              <Icon size={18} />
              <span>{label}</span>
              {count ? <span className="nav-count">{count}</span> : null}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="trial-card">
          <span className="trial-icon"><Sparkles size={16} /></span>
          <strong>Build smarter days</strong>
          <p>Your workspace is ready for its first optimized plan.</p>
          <button>View setup guide</button>
        </div>
        <nav className="secondary-nav">
          <button className="nav-item"><CircleHelp size={18} /><span>Help center</span></button>
          <button className="nav-item"><Settings size={18} /><span>Settings</span></button>
        </nav>
        <div className="profile-row">
          <div className="avatar avatar-dark">EL</div>
          <div><strong>Eddan Lacan</strong><span>Workspace admin</span></div>
          <MoreHorizontal size={18} />
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div className="location-switcher">
            <span className="location-icon"><MapPin size={16} /></span>
            <div><span>Operations hub</span><strong>Metro Manila</strong></div>
            <ChevronDown size={16} />
          </div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Notifications"><Bell size={19} /><span className="notification-dot" /></button>
            <button className="primary-button" onClick={() => setShowCreateJob(true)}><Plus size={17} /> Create job</button>
          </div>
        </header>

        <section className="page-heading">
          <div>
            <div className="breadcrumb"><span>Route planning</span><span>/</span><span>Daily plan</span></div>
            <h1>Shape today&apos;s routes</h1>
            <p>Balance the workload, honor every promise, and keep the day moving.</p>
          </div>
          <div className="heading-actions">
            <button className="date-button"><CalendarDays size={17} /><span>Wed, 15 July</span><ChevronDown size={15} /></button>
            <button className="optimize-button" onClick={optimize} disabled={busyAction === "optimize"}><Sparkles size={17} />{busyAction === "optimize" ? "Optimizing…" : "Optimize routes"}</button>
          </div>
        </section>

        <section className="metric-strip" aria-label="Plan summary">
          <Metric label="Total jobs" value={String(liveVisits.length)} detail={`${liveVisits.filter((visit) => visit.status !== "unassigned").length} already planned`} tone="neutral" />
          <Metric label="Unassigned" value={String(unassigned.length)} detail="Needs your attention" tone="warning" />
          <Metric label="Planned distance" value={`${liveRoutes.reduce((total, route) => total + route.totalDistanceKm, 0).toFixed(1)} km`} detail={`Across ${liveRoutes.length} routes`} tone="neutral" />
          <Metric label="Workload" value={`${Math.floor(liveRoutes.reduce((total, route) => total + route.totalMinutes, 0) / 60)}h ${liveRoutes.reduce((total, route) => total + route.totalMinutes, 0) % 60}m`} detail="64% team utilization" tone="success" />
        </section>

        <section className="planner-shell">
          <div className="jobs-panel">
            <div className="panel-heading">
              <div><h2>Unassigned jobs</h2><span className="count-pill">{unassigned.length}</span></div>
              <button className="icon-button" aria-label="Job filters"><Filter size={17} /></button>
            </div>
            <div className="search-field">
              <Search size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search jobs" aria-label="Search jobs" />
              <kbd>⌘ K</kbd>
            </div>
            <div className="filter-row">
              <button>All types <ChevronDown size={14} /></button>
              <button>Any window <ChevronDown size={14} /></button>
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
              <div className="route-view-actions"><button className="soft-button"><SlidersHorizontal size={16} /> View</button><button className="icon-button"><MoreHorizontal size={18} /></button></div>
            </div>
            <div className="route-list">
              {liveRoutes.map((route) => {
                const worker = workers.find((item) => item.id === route.workerId)!;
                const vehicle = vehicles.find((item) => item.id === route.vehicleId)!;
                const summary = summarizeRoute(route, liveVisits, vehicle);
                return (
                  <article className="route-card" key={route.id}>
                    <div className="route-accent" style={{ background: route.color }} />
                    <div className="route-header">
                      <div className="route-person"><div className="avatar" style={{ background: route.color }}>{worker.initials}</div><div><div className="route-title-line"><h3>{route.label}</h3><span className={`status status-${route.status}`}>{route.status}</span></div><p>{worker.name} · {vehicle.label}</p></div></div>
                      <button className="icon-button"><MoreHorizontal size={18} /></button>
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
                    <div className="route-card-actions"><button className="route-add-stop" onClick={() => assignJob(selectedVisitId, route.id)} disabled={!unassigned.some((visit) => visit.id === selectedVisitId) || busyAction === `assign-${selectedVisitId}`}><Plus size={15} />{busyAction === `assign-${selectedVisitId}` ? "Adding…" : "Add selected job"}</button><button className="dispatch-button" onClick={() => dispatchRoute(route.id)} disabled={busyAction === `dispatch-${route.id}` || route.status === "dispatched"}>{route.status === "dispatched" ? "Dispatched" : busyAction === `dispatch-${route.id}` ? "Dispatching…" : "Dispatch route"}</button></div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="map-panel">
            <div className="map-toolbar">
              <div className="map-tabs"><button className="active"><Map size={15} />Map</button><button>Timeline</button></div>
              <button className="map-layer-button"><PackageOpen size={15} />Jobs <ChevronDown size={13} /></button>
            </div>
            <div className="map-canvas">
              <div className="map-road road-one" /><div className="map-road road-two" /><div className="map-road road-three" />
              <svg className="route-lines" viewBox="0 0 600 500" preserveAspectRatio="none" aria-hidden="true">
                <path d="M110,350 C180,310 205,180 300,230 S430,330 505,170" className="route-path route-path-green" />
                <path d="M100,390 C210,420 290,350 360,390 S470,430 525,300" className="route-path route-path-orange" />
              </svg>
              <MapMarker number="1" color="#186b58" position={{ left: "48%", top: "41%" }} active={selectedVisitId === "v-104"} />
              <MapMarker number="2" color="#186b58" position={{ left: "77%", top: "27%" }} active={selectedVisitId === "v-105"} />
              <MapMarker number="1" color="#e06b3c" position={{ left: "57%", top: "70%" }} active={selectedVisitId === "v-106"} />
              <MapMarker number="2" color="#e06b3c" position={{ left: "83%", top: "56%" }} active={selectedVisitId === "v-107"} />
              <div className="depot-marker"><span>NF</span><div><strong>NeatFleet Hub</strong><small>Guadalupe, Makati</small></div></div>
              {selectedVisit ? <div className="selected-map-card"><span className={`kind-icon kind-${selectedVisit.kind}`}>{kindLabel[selectedVisit.kind].slice(0, 1)}</span><div><strong>{selectedVisit.customerName}</strong><small>{selectedVisit.timeWindow.start}–{selectedVisit.timeWindow.end} · {selectedVisit.serviceMinutes} min</small></div></div> : null}
              <div className="map-zoom"><button>+</button><button>−</button></div>
              <div className="map-attribution">Development map preview</div>
            </div>
          </div>
        </section>
        {toast ? <div className="toast" role="status"><span className="toast-dot" />{toast}</div> : null}
        {showCreateJob ? <CreateJobModal onClose={() => setShowCreateJob(false)} onCreated={createJob} /> : null}
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

function MapMarker({ number, color, position, active }: { number: string; color: string; position: React.CSSProperties; active: boolean }) {
  return <button className={`map-marker ${active ? "active" : ""}`} style={{ ...position, background: color }} aria-label={`Route stop ${number}`}>{number}</button>;
}

function CreateJobModal({ onClose, onCreated }: { onClose: () => void; onCreated: (job: CreateJobInput) => void }) {
  const [form, setForm] = useState({ customerName: "", address: "", kind: "service" as JobKind, serviceMinutes: "30", priority: "normal" });
  const [saving, setSaving] = useState(false);
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    onCreated({
      ...form,
      priority: form.priority as Visit["priority"],
      serviceMinutes: Number(form.serviceMinutes),
      timeWindow: { start: "09:00", end: "17:00" },
    });
    setSaving(false);
  }
  return <div className="modal-backdrop" role="presentation"><form className="modal-card" onSubmit={submit}><div className="modal-header"><div><span className="eyebrow">New work item</span><h2>Create a job</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close create job dialog"><X size={18} /></button></div><label>Customer or site<input required value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} placeholder="e.g. Acme Facilities" /></label><label>Address<input required value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Street, city, region" /></label><div className="form-grid"><label>Job type<select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as JobKind })}>{Object.entries(kindLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Service minutes<input type="number" min="5" max="480" value={form.serviceMinutes} onChange={(event) => setForm({ ...form, serviceMinutes: event.target.value })} /></label></div><label>Priority<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><div className="modal-actions"><button type="button" className="soft-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Creating…" : "Create job"}</button></div></form></div>;
}
