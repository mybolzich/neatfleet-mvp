import type { Session, User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { routes as demoRoutes, vehicles as demoVehicles, visits as demoVisits } from "@/domain/demo-data";
import { backendConfigured, supabase } from "./supabase";

export interface UserProfile {
  id: string;
  company_id: string;
  email: string;
  full_name: string;
  role: "owner" | "dispatcher" | "driver";
}

export interface CompanyProfile {
  id: string;
  name: string;
  slug: string;
  dispatch_address: string;
  dispatch_lat: number;
  dispatch_lng: number;
}

export function useNeatFleetAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(backendConfigured);

  const loadProfile = useCallback(async (user: User | null) => {
    if (!user) {
      setProfile(null);
      setCompany(null);
      return;
    }
    const { data: nextProfile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    setProfile(nextProfile as UserProfile | null);
    if (!nextProfile) {
      setCompany(null);
      return;
    }
    const { data: nextCompany } = await supabase.from("companies").select("*").eq("id", nextProfile.company_id).maybeSingle();
    setCompany(nextCompany as CompanyProfile | null);
  }, []);

  useEffect(() => {
    if (!backendConfigured) {
      return;
    }
    void supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session?.user ?? null);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      window.setTimeout(() => {
        void loadProfile(nextSession?.user ?? null).finally(() => setLoading(false));
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [loadProfile]);

  async function login(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function register(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return Boolean(data.session);
  }

  async function createWorkspace(input: { companyName: string; fullName: string }) {
    if (!session?.user) throw new Error("Sign in before creating a workspace.");
    const companyId = crypto.randomUUID();
    const slug = `${input.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${companyId.slice(0, 6)}`;
    const { error: companyError } = await supabase.from("companies").insert({
      id: companyId,
      name: input.companyName,
      slug,
      dispatch_address: "Guadalupe, Makati",
      dispatch_lat: 14.5547,
      dispatch_lng: 121.0346,
    });
    if (companyError) throw companyError;

    const { error: profileError } = await supabase.from("profiles").insert({
      id: session.user.id,
      company_id: companyId,
      email: session.user.email ?? "",
      full_name: input.fullName,
      role: "owner",
      active: true,
    });
    if (profileError) throw profileError;

    const { data: insertedVehicles, error: vehicleError } = await supabase.from("vehicles").insert(
      demoVehicles.map((vehicle, index) => ({
        company_id: companyId,
        name: vehicle.label,
        capacity: vehicle.capacity.units,
        shift_start: index ? 30 : 0,
        shift_end: index ? 570 : 540,
        color: demoRoutes[index]?.color ?? "#176b58",
        status: "Idle",
      })),
    ).select("id");
    if (vehicleError) throw vehicleError;

    const { error: orderError } = await supabase.from("orders").insert(demoVisits.map((visit, index) => ({
      company_id: companyId,
      name: visit.jobId,
      customer: visit.customerName,
      address: visit.address,
      lat: visit.location.lat,
      lng: visit.location.lng,
      x: 35 + (index * 9) % 55,
      y: 28 + (index * 13) % 60,
      volume: visit.demand.units,
      time_window_start: timeToOffset(visit.timeWindow.start),
      time_window_end: timeToOffset(visit.timeWindow.end),
      service_duration: visit.serviceMinutes,
      priority: visit.priority === "urgent" ? "High" : visit.priority === "high" ? "High" : "Medium",
      status: "Pending",
    })));
    if (orderError) throw orderError;

    const { error: routeError } = await supabase.from("routes").insert((insertedVehicles ?? []).map((vehicle) => ({
      company_id: companyId,
      vehicle_id: vehicle.id,
      status: "Planned",
      created_by: session.user.id,
    })));
    if (routeError) throw routeError;
    await loadProfile(session.user);
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  return { backendConfigured, session, profile, company, loading, login, register, createWorkspace, logout };
}

function timeToOffset(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return Math.max(0, hours * 60 + minutes - 480);
}
