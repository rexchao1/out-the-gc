import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  client = createClient(supabaseUrl, supabaseAnonKey);
  return client;
}

export type TripRow = {
  id: string;
  trip_name: string;
  destination: string;
  start_date: string;
  end_date: string;
  cost_per_person: number;
  rsvp_deadline: string;
  organizer_name: string;
  created_at: string;
};
