import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CONFIG, parseConfig, type ElectionConfig } from "@/lib/config";

// One lookup per request. If the settings cannot be read (for example before they are set up) the defaults are used.
export const getConfig = cache(async (): Promise<ElectionConfig> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("election_config_json");
    return error ? DEFAULT_CONFIG : parseConfig(data);
  } catch {
    return DEFAULT_CONFIG;
  }
});
