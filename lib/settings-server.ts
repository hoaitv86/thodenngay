import { createClient } from "./supabase/server";
import { DEFAULT_SETTINGS, SettingsData } from "./settings-types";

export async function getSystemSettings(): Promise<SettingsData> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('system_settings')
      .select('app_name, hotline, support_email, company_address, facebook_url, zalo_url, maintenance_mode, terms_url, privacy_url')
      .eq('id', 'default')
      .single();

    if (error) throw error;
    if (data) {
      return {
        app_name: data.app_name || DEFAULT_SETTINGS.app_name,
        hotline: data.hotline || DEFAULT_SETTINGS.hotline,
        support_email: data.support_email || DEFAULT_SETTINGS.support_email,
        company_address: data.company_address || DEFAULT_SETTINGS.company_address,
        facebook_url: data.facebook_url || DEFAULT_SETTINGS.facebook_url,
        zalo_url: data.zalo_url || DEFAULT_SETTINGS.zalo_url,
        maintenance_mode: data.maintenance_mode ?? DEFAULT_SETTINGS.maintenance_mode,
        terms_url: data.terms_url || DEFAULT_SETTINGS.terms_url,
        privacy_url: data.privacy_url || DEFAULT_SETTINGS.privacy_url,
      };
    }
  } catch (err: unknown) {
    console.warn("Could not load settings from server DB:", err instanceof Error ? err.message : err);
  }
  return DEFAULT_SETTINGS;
}
