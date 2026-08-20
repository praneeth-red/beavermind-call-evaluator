import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getServerEnv } from "./env";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type RunRow = {
  id: string;
  call_type: "kickoff" | "coaching";
  transcript: string;
  client_hash: string;
  status: "queued" | "processing" | "completed" | "failed";
  result_json: Json | null;
  public_error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

type Database = {
  public: {
    Tables: {
      runs: {
        Row: RunRow;
        Insert: {
          id?: string;
          call_type: RunRow["call_type"];
          transcript: string;
          client_hash: string;
          status?: RunRow["status"];
          result_json?: Json | null;
          public_error?: string | null;
          created_at?: string;
          started_at?: string | null;
          finished_at?: string | null;
        };
        Update: Partial<Omit<RunRow, "id" | "created_at">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

let client: SupabaseClient<Database> | undefined;

export function getSupabase(): SupabaseClient<Database> {
  if (!client) {
    const { supabaseUrl, supabaseServiceRoleKey } = getServerEnv();
    client = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  }

  return client;
}
