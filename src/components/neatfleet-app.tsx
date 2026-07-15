import { useState } from "react";
import { Route as RouteIcon } from "lucide-react";
import { DispatcherWorkspace } from "./dispatcher-workspace";
import { useNeatFleetAuth } from "@/lib/auth";

export function NeatFleetApp() {
  const auth = useNeatFleetAuth();

  if (auth.loading) return <AuthShell><p className="auth-status">Connecting to NeatFleet Cloud…</p></AuthShell>;
  if (!auth.backendConfigured) return <AuthShell><p className="auth-error">Cloud configuration is missing from this deployment.</p></AuthShell>;
  if (!auth.session) return <AuthScreen onLogin={auth.login} onRegister={auth.register} />;
  if (!auth.profile || !auth.company) return <WorkspaceSetup email={auth.session.user.email ?? ""} onCreate={auth.createWorkspace} onLogout={auth.logout} />;

  return <DispatcherWorkspace cloud={{ profile: auth.profile, company: auth.company, logout: auth.logout }} />;
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand"><span><RouteIcon size={22} /></span><strong>NeatFleet</strong></div>
        {children}
      </section>
    </main>
  );
}

function AuthScreen({ onLogin, onRegister }: { onLogin: (email: string, password: string) => Promise<void>; onRegister: (email: string, password: string) => Promise<boolean> }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "login") await onLogin(email, password);
      else {
        const signedIn = await onRegister(email, password);
        if (!signedIn) setMessage("Account created. Confirm the email, then return here to sign in.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to continue.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <p className="eyebrow">Cloud operations workspace</p>
      <h1>{mode === "login" ? "Welcome back" : "Create your MVP workspace"}</h1>
      <p className="auth-copy">Sign in to manage persistent jobs, routes, vehicles, dispatch events, and live status.</p>
      <form className="auth-form" onSubmit={submit}>
        <label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
        <label>Password<input type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
        {message ? <p className="auth-message" role="status">{message}</p> : null}
        <button className="auth-submit" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
      </form>
      <button className="auth-switch" onClick={() => { setMode(mode === "login" ? "register" : "login"); setMessage(null); }}>
        {mode === "login" ? "New to NeatFleet? Create an account" : "Already have an account? Sign in"}
      </button>
    </AuthShell>
  );
}

function WorkspaceSetup({ email, onCreate, onLogout }: { email: string; onCreate: (input: { companyName: string; fullName: string }) => Promise<void>; onLogout: () => Promise<void> }) {
  const [companyName, setCompanyName] = useState("NeatFleet Demo Operations");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onCreate({ companyName, fullName });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not create the workspace.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <p className="eyebrow">One-time setup</p>
      <h1>Create your operations workspace</h1>
      <p className="auth-copy">Signed in as {email}. We’ll add a presentation-ready fleet and job set to your private company workspace.</p>
      <form className="auth-form" onSubmit={submit}>
        <label>Your name<input required value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
        <label>Company name<input required value={companyName} onChange={(event) => setCompanyName(event.target.value)} /></label>
        {error ? <p className="auth-message">{error}</p> : null}
        <button className="auth-submit" disabled={busy}>{busy ? "Building workspace…" : "Create workspace"}</button>
      </form>
      <button className="auth-switch" onClick={() => void onLogout()}>Sign out</button>
    </AuthShell>
  );
}
