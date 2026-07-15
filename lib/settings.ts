"use client";

import { useState, useEffect } from "react";
import { createClient } from "./supabase/client";
import { SettingsData, DEFAULT_SETTINGS } from "./settings-types";

export { DEFAULT_SETTINGS };
export type { SettingsData };

export function useSettings() {
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('system_settings')
          .select('app_name, hotline, support_email, company_address, facebook_url, zalo_url, maintenance_mode, terms_url, privacy_url')
          .eq('id', 'default')
          .single();

        if (error) throw error;
        if (data) {
          setSettings({
            app_name: data.app_name || DEFAULT_SETTINGS.app_name,
            hotline: data.hotline || DEFAULT_SETTINGS.hotline,
            support_email: data.support_email || DEFAULT_SETTINGS.support_email,
            company_address: data.company_address || DEFAULT_SETTINGS.company_address,
            facebook_url: data.facebook_url || DEFAULT_SETTINGS.facebook_url,
            zalo_url: data.zalo_url || DEFAULT_SETTINGS.zalo_url,
            maintenance_mode: data.maintenance_mode ?? DEFAULT_SETTINGS.maintenance_mode,
            terms_url: data.terms_url || DEFAULT_SETTINGS.terms_url,
            privacy_url: data.privacy_url || DEFAULT_SETTINGS.privacy_url,
          });
        }
      } catch (err) {
        // Fallback to LocalStorage in client side
        if (typeof window !== "undefined") {
          const saved = localStorage.getItem('system_settings');
          if (saved) {
            try {
              setSettings(JSON.parse(saved));
            } catch (e) {
              // Keep default
            }
          }
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { settings, loading };
}
