import { supabaseAdmin } from "@/lib/supabase/server";
supabaseAdmin().from("youcam_usage").select("units").neq("status", "failed").then(({ data }) => console.log("units used:", (data ?? []).reduce((s, r) => s + r.units, 0)));
