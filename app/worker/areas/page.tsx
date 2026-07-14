"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPin, Plus, RefreshCw, Save } from "lucide-react";

type SubArea = {
  id: string;
  area_id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
};

type Area = {
  id: string;
  name: string;
  area_type?: string | null;
  is_active: boolean;
  sort_order: number;
  sub_areas?: SubArea[] | null;
};

const initialArea = { name: "", sortOrder: "0" };
const initialSubArea = { areaId: "", name: "", sortOrder: "0" };
const initialAssignment = { userId: "", areaId: "", subAreaId: "" };

export default function WorkerAreasPage() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedAreaId, setSelectedAreaId] = useState("");
  const [areaForm, setAreaForm] = useState(initialArea);
  const [subAreaForm, setSubAreaForm] = useState(initialSubArea);
  const [assignmentForm, setAssignmentForm] = useState(initialAssignment);

  const fetchAreas = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/worker/areas");
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error || "Không thể tải địa bàn.");
      setAreas([]);
    } else {
      const nextAreas = (result.areas || []) as Area[];
      setAreas(nextAreas);
      setSelectedAreaId(prev => prev || nextAreas[0]?.id || "");
      setSubAreaForm(prev => ({ ...prev, areaId: prev.areaId || nextAreas[0]?.id || "" }));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void fetchAreas(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchAreas]);

  const selectedArea = useMemo(
    () => areas.find(area => area.id === selectedAreaId) || areas[0],
    [areas, selectedAreaId],
  );

  const saveArea = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/worker/areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "area", ...areaForm }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không thể thêm xã.");
      setAreaForm(initialArea);
      setMessage("Đã thêm xã/phường/thị trấn.");
      await fetchAreas();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể thêm xã.");
    } finally {
      setSaving(false);
    }
  };

  const saveSubArea = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/worker/areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sub_area", ...subAreaForm, areaId: subAreaForm.areaId || selectedArea?.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không thể thêm xóm.");
      setSubAreaForm({ ...initialSubArea, areaId: subAreaForm.areaId || selectedArea?.id || "" });
      setMessage("Đã thêm xóm/thôn/khối.");
      await fetchAreas();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể thêm xóm.");
    } finally {
      setSaving(false);
    }
  };

  const toggleArea = async (area: Area) => {
    setSaving(true);
    await fetch("/api/worker/areas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "area", id: area.id, name: area.name, sortOrder: area.sort_order, isActive: !area.is_active }),
    });
    await fetchAreas();
    setSaving(false);
  };

  const toggleSubArea = async (subArea: SubArea) => {
    setSaving(true);
    await fetch("/api/worker/areas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sub_area", id: subArea.id, areaId: subArea.area_id, name: subArea.name, sortOrder: subArea.sort_order, isActive: !subArea.is_active }),
    });
    await fetchAreas();
    setSaving(false);
  };

  const saveAssignment = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/worker/areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assignment", ...assignmentForm }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không thể phân công người thu.");
      setAssignmentForm(initialAssignment);
      setMessage("Đã phân công người thu.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể phân công người thu.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[calc(100dvh-8rem)] bg-surface p-4 lg:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-primary">Quản lý thu cước</p>
          <h1 className="text-2xl font-extrabold text-on-surface">Địa bàn</h1>
        </div>
        <button type="button" onClick={() => void fetchAreas()} className="btn-outline !w-auto !p-3" title="Tải lại">
          <RefreshCw size={18} />
        </button>
      </header>

      {message && <div className="mt-4 rounded-lg bg-primary-fixed p-3 text-sm font-bold text-primary">{message}</div>}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="space-y-3">
          {loading ? (
            <div className="rounded-lg bg-white p-8 text-center text-sm text-on-surface-variant">Đang tải địa bàn...</div>
          ) : areas.length === 0 ? (
            <div className="rounded-lg border border-dashed border-outline-variant bg-white p-8 text-center text-sm text-on-surface-variant">Chưa có xã nào.</div>
          ) : areas.map(area => (
            <article key={area.id} className={`rounded-lg border bg-white p-4 shadow-sm ${selectedArea?.id === area.id ? "border-primary" : "border-outline-variant/40"}`}>
              <button type="button" onClick={() => { setSelectedAreaId(area.id); setSubAreaForm(prev => ({ ...prev, areaId: area.id })); }} className="flex w-full items-start justify-between gap-3 text-left">
                <div>
                  <h2 className="font-extrabold text-on-surface">{area.name}</h2>
                  <p className="mt-1 text-xs text-on-surface-variant">{area.sub_areas?.length || 0} xóm/thôn/khối · thứ tự {area.sort_order}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${area.is_active ? "bg-success-container text-success" : "bg-surface-container text-on-surface-variant"}`}>
                  {area.is_active ? "Đang dùng" : "Tạm ngưng"}
                </span>
              </button>
              <div className="mt-3 flex justify-end">
                <button type="button" disabled={saving} onClick={() => void toggleArea(area)} className="btn-outline !w-auto !py-2 text-xs">
                  {area.is_active ? "Ngừng sử dụng" : "Kích hoạt lại"}
                </button>
              </div>
            </article>
          ))}
        </section>

        <aside className="space-y-4">
          <form onSubmit={saveArea} className="rounded-lg border border-outline-variant/40 bg-white p-4 shadow-sm">
            <h2 className="flex items-center gap-2 font-extrabold"><MapPin size={18} /> Thêm xã</h2>
            <div className="mt-3 grid gap-3">
              <input required className="input-field" placeholder="Tên xã/phường/thị trấn" value={areaForm.name} onChange={e => setAreaForm(prev => ({ ...prev, name: e.target.value }))} />
              <input className="input-field" type="number" placeholder="Thứ tự" value={areaForm.sortOrder} onChange={e => setAreaForm(prev => ({ ...prev, sortOrder: e.target.value }))} />
              <button disabled={saving} className="btn-primary !w-full"><Plus size={18} /> Thêm xã</button>
            </div>
          </form>

          <form onSubmit={saveSubArea} className="rounded-lg border border-outline-variant/40 bg-white p-4 shadow-sm">
            <h2 className="flex items-center gap-2 font-extrabold"><Save size={18} /> Thêm xóm</h2>
            <div className="mt-3 grid gap-3">
              <select className="input-field" value={subAreaForm.areaId || selectedArea?.id || ""} onChange={e => setSubAreaForm(prev => ({ ...prev, areaId: e.target.value }))}>
                {areas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}
              </select>
              <input required className="input-field" placeholder="Tên xóm/thôn/khối" value={subAreaForm.name} onChange={e => setSubAreaForm(prev => ({ ...prev, name: e.target.value }))} />
              <input className="input-field" type="number" placeholder="Thứ tự" value={subAreaForm.sortOrder} onChange={e => setSubAreaForm(prev => ({ ...prev, sortOrder: e.target.value }))} />
              <button disabled={saving || areas.length === 0} className="btn-primary !w-full"><Plus size={18} /> Thêm xóm</button>
            </div>
          </form>

          {selectedArea && (
            <section className="rounded-lg border border-outline-variant/40 bg-white p-4 shadow-sm">
              <h2 className="font-extrabold">Xóm thuộc {selectedArea.name}</h2>
              <div className="mt-3 space-y-2">
                {(selectedArea.sub_areas || []).length === 0 ? (
                  <p className="text-sm text-on-surface-variant">Chưa có xóm.</p>
                ) : (selectedArea.sub_areas || []).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)).map(subArea => (
                  <div key={subArea.id} className="flex items-center justify-between gap-3 rounded-lg bg-surface-container-low p-3">
                    <div>
                      <p className="font-bold">{subArea.name}</p>
                      <p className="text-xs text-on-surface-variant">Thứ tự {subArea.sort_order}</p>
                    </div>
                    <button type="button" disabled={saving} onClick={() => void toggleSubArea(subArea)} className="btn-outline !w-auto !py-2 text-xs">
                      {subArea.is_active ? "Ngừng" : "Kích hoạt"}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <form onSubmit={saveAssignment} className="rounded-lg border border-outline-variant/40 bg-white p-4 shadow-sm">
            <h2 className="font-extrabold">Phân công người thu</h2>
            <div className="mt-3 grid gap-3">
              <input required className="input-field" placeholder="User ID người thu" value={assignmentForm.userId} onChange={e => setAssignmentForm(prev => ({ ...prev, userId: e.target.value }))} />
              <select className="input-field" value={assignmentForm.areaId} onChange={e => setAssignmentForm(prev => ({ ...prev, areaId: e.target.value, subAreaId: "" }))}>
                <option value="">Chọn xã</option>
                {areas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}
              </select>
              <select className="input-field" value={assignmentForm.subAreaId} onChange={e => setAssignmentForm(prev => ({ ...prev, subAreaId: e.target.value }))} disabled={!assignmentForm.areaId}>
                <option value="">Cả xã hoặc chọn xóm cụ thể</option>
                {(areas.find(area => area.id === assignmentForm.areaId)?.sub_areas || []).map(subArea => <option key={subArea.id} value={subArea.id}>{subArea.name}</option>)}
              </select>
              <button disabled={saving} className="btn-primary !w-full">Lưu phân công</button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}
