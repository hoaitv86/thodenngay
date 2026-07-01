"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  SettingsIcon, 
  ShieldIcon, 
  InfoIcon, 
  BuildingIcon, 
  PhoneIcon, 
  MailIcon, 
  LinkIcon, 
  AlertTriangleIcon, 
  CheckCircleIcon, 
  XIcon 
} from "../../components/icons";

import { SettingsData, DEFAULT_SETTINGS } from "@/lib/settings-types";

export default function AdminSettings() {
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingSystem, setSavingSystem] = useState(false);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' | null }>({ message: '', type: null });
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: null }), 3000);
  };

  const supabase = createClient();

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
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
        setDbConnected(true);
      }
    } catch (err: unknown) {
      console.warn("Could not load settings from DB, falling back to LocalStorage:", err instanceof Error ? err.message : err);
      setDbConnected(false);
      
      const saved = localStorage.getItem('system_settings');
      if (saved) {
        try {
          setSettings(JSON.parse(saved));
        } catch {
          setSettings(DEFAULT_SETTINGS);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSettings();
    }, 0);
    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGeneral(true);
    
    try {
      if (dbConnected) {
        const { error } = await supabase
          .from('system_settings')
          .update({
            app_name: settings.app_name,
            hotline: settings.hotline,
            support_email: settings.support_email,
            company_address: settings.company_address,
            facebook_url: settings.facebook_url,
            zalo_url: settings.zalo_url,
          })
          .eq('id', 'default');
          
        if (error) throw error;
      } else {
        localStorage.setItem('system_settings', JSON.stringify(settings));
      }
      showToast("Lưu cấu hình chung thành công!", "success");
    } catch (err: unknown) {
      console.error(err);
      showToast("Lỗi khi lưu cấu hình: " + (err instanceof Error ? err.message : "Không xác định"), "error");
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleSaveSystem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSystem(true);
    
    try {
      if (dbConnected) {
        const { error } = await supabase
          .from('system_settings')
          .update({
            maintenance_mode: settings.maintenance_mode,
            terms_url: settings.terms_url,
            privacy_url: settings.privacy_url,
          })
          .eq('id', 'default');
          
        if (error) throw error;
      } else {
        localStorage.setItem('system_settings', JSON.stringify(settings));
      }
      showToast("Lưu cấu hình hệ thống thành công!", "success");
    } catch (err: unknown) {
      console.error(err);
      showToast("Lỗi khi lưu cấu hình: " + (err instanceof Error ? err.message : "Không xác định"), "error");
    } finally {
      setSavingSystem(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-primary-container border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* Toast Notification */}
      {toast.type && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-sm px-4 py-3 rounded-xl shadow-lg border animate-fade-in flex items-start gap-3 ${
          toast.type === 'success' ? 'bg-success-container text-on-success-container border-success/30' :
          toast.type === 'error' ? 'bg-error-container text-on-error-container border-error/30' :
          'bg-surface-container-high text-on-surface border-outline-variant/30'
        }`}>
          {toast.type === 'success' ? <CheckCircleIcon size={20} /> : toast.type === 'error' ? <XIcon size={20} /> : <InfoIcon size={20} />}
          <span className="text-body-sm font-bold leading-tight pt-0.5">{toast.message}</span>
        </div>
      )}

      <div>
        <h1 className="text-headline-md text-on-surface">Cài đặt</h1>
        <p className="text-body-sm text-on-surface-variant">
          Cấu hình hệ thống và tài khoản admin.
        </p>
      </div>

      {dbConnected === false && (
        <div className="p-4 rounded-xl border border-warning/30 bg-warning-container text-on-warning-container flex items-start gap-3">
          <AlertTriangleIcon className="w-5 h-5 shrink-0 mt-0.5 text-warning" />
          <div className="space-y-1">
            <h4 className="font-bold">Đang chạy ở chế độ Demo (Offline)</h4>
            <p className="text-body-sm leading-relaxed">
              Chưa tìm thấy bảng <code>system_settings</code> trong database. Thay đổi của bạn hiện tại đang được lưu vào bộ nhớ trình duyệt (LocalStorage).
              Để lưu vĩnh viễn vào database, vui lòng chạy file SQL <code>supabase/migration_v3_settings.sql</code> trong SQL Editor của Supabase.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Cấu hình chung */}
          <form onSubmit={handleSaveGeneral} className="card space-y-5">
            <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-4">
              <div className="p-2 bg-primary/10 text-primary rounded-lg">
                <SettingsIcon size={20} />
              </div>
              <h2 className="text-lg font-semibold text-on-surface">Cấu hình chung</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-label-sm">Tên ứng dụng</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                    <InfoIcon size={16} />
                  </div>
                  <input 
                    type="text" 
                    className="input-field pl-9" 
                    value={settings.app_name} 
                    onChange={e => setSettings({...settings, app_name: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-label-sm">Hotline</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                    <PhoneIcon size={16} />
                  </div>
                  <input 
                    type="text" 
                    className="input-field pl-9" 
                    value={settings.hotline} 
                    onChange={e => setSettings({...settings, hotline: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-label-sm">Email hỗ trợ</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                    <MailIcon size={16} />
                  </div>
                  <input 
                    type="email" 
                    className="input-field pl-9" 
                    value={settings.support_email} 
                    onChange={e => setSettings({...settings, support_email: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-label-sm">Địa chỉ công ty</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                    <BuildingIcon size={16} />
                  </div>
                  <input 
                    type="text" 
                    className="input-field pl-9" 
                    value={settings.company_address} 
                    onChange={e => setSettings({...settings, company_address: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-label-sm">Link Facebook</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                    <LinkIcon size={16} />
                  </div>
                  <input 
                    type="url" 
                    className="input-field pl-9" 
                    value={settings.facebook_url} 
                    onChange={e => setSettings({...settings, facebook_url: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-label-sm">Link Zalo</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                    <LinkIcon size={16} />
                  </div>
                  <input 
                    type="url" 
                    className="input-field pl-9" 
                    value={settings.zalo_url} 
                    onChange={e => setSettings({...settings, zalo_url: e.target.value})}
                  />
                </div>
              </div>
            </div>
            
            <div className="pt-2 flex justify-end">
              <button type="submit" disabled={savingGeneral} className="btn-primary min-w-[140px]">
                {savingGeneral ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </form>

          {/* Cấu hình Hệ thống & Pháp lý */}
          <form onSubmit={handleSaveSystem} className="card space-y-5">
            <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-4">
              <div className="p-2 bg-error/10 text-error rounded-lg">
                <ShieldIcon size={20} />
              </div>
              <h2 className="text-lg font-semibold text-on-surface">Hệ thống & Pháp lý</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border border-outline-variant/50 bg-surface">
                <div className="flex gap-3">
                  <div className="mt-0.5 text-warning">
                    <AlertTriangleIcon size={20} />
                  </div>
                  <div className="flex-1 pr-4">
                    <h3 className="font-semibold text-on-surface">Chế độ bảo trì</h3>
                    <p className="text-sm text-on-surface-variant mt-0.5">Bật tính năng này sẽ tạm thời đóng app đối với Khách hàng và Thợ.</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={settings.maintenance_mode}
                    onChange={e => setSettings({...settings, maintenance_mode: e.target.checked})}
                  />
                  <div className="w-11 h-6 bg-surface-variant rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-error"></div>
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="text-label-sm">Điều khoản sử dụng (URL)</label>
                <input 
                  type="url" 
                  className="input-field" 
                  value={settings.terms_url} 
                  onChange={e => setSettings({...settings, terms_url: e.target.value})}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-label-sm">Chính sách bảo mật (URL)</label>
                <input 
                  type="url" 
                  className="input-field" 
                  value={settings.privacy_url} 
                  onChange={e => setSettings({...settings, privacy_url: e.target.value})}
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button type="submit" disabled={savingSystem} className="btn-primary min-w-[170px]">
                {savingSystem ? "Đang lưu..." : "Lưu cấu hình hệ thống"}
              </button>
            </div>
          </form>
        </div>

        {/* Cột thông báo bên phải */}
        <div className="space-y-6">
          <div className="card bg-surface-container-low border-none">
            <h3 className="font-semibold text-on-surface mb-2">Lưu ý cấu hình</h3>
            <ul className="space-y-3 text-sm text-on-surface-variant list-disc list-inside">
              <li>Các thay đổi ở &quot;Cấu hình chung&quot; sẽ cập nhật ngay lập tức trên Ứng dụng.</li>
              <li>Chỉ bật &quot;Chế độ bảo trì&quot; khi có bản cập nhật lớn hoặc sửa lỗi khẩn cấp.</li>
              <li>Các phần cấu hình Dịch vụ, Thanh toán sẽ được cập nhật trong giai đoạn sau.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
