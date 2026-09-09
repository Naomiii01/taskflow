"use client";

import { useQuery } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("departments")
        .select("id, department_name, manager")
        .order("department_name");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("users")
        .select("id, name, email, role, avatar_url")
        .order("name");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Fleet Master — feeds the Task Form's Aircraft Type → Aircraft Registration
 * cascade. Pass an aircraft type to filter registrations to that fleet. */
export function useFleet(aircraftType?: string) {
  return useQuery({
    queryKey: ["planning", "fleet", aircraftType ?? "all"],
    queryFn: async () => {
      const res = await fetch(`/api/planning/fleet${aircraftType ? `?aircraft_type=${aircraftType}` : ""}`);
      if (!res.ok) throw new Error("無法載入機隊主檔");
      return res.json() as Promise<{ id: string; aircraft_type: string; aircraft_registration: string; station: string; status: string }[]>;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Project Center — feeds the Task Form's Project dropdown. */
export function useProjectOptions() {
  return useQuery({
    queryKey: ["planning", "projects", "options"],
    queryFn: async () => {
      const res = await fetch("/api/planning/projects");
      if (!res.ok) throw new Error("無法載入專案清單");
      return res.json() as Promise<{ id: string; code: string; name: string }[]>;
    },
    staleTime: 5 * 60 * 1000,
  });
}
