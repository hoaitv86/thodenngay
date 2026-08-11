"use client";

import { useMemo, useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { groupServicesForDisplay, getServicePathLabel, type ServiceHierarchyLike } from "@/lib/service-hierarchy";

type ServiceOption = ServiceHierarchyLike & {
  base_price?: number | string | null;
};

type Props<T extends ServiceOption> = {
  services: T[];
  value: string[];
  onChange: (serviceIds: string[]) => void;
  disabled?: boolean;
  showPrices?: boolean;
};

export function HierarchicalServiceSelector<T extends ServiceOption>({
  services,
  value,
  onChange,
  disabled = false,
  showPrices = true,
}: Props<T>) {
  const groups = useMemo(() => groupServicesForDisplay(services), [services]);
  const selectedIds = useMemo(() => new Set(value), [value]);
  const initiallyOpen = groups.find(group => group.services.some(service => selectedIds.has(service.id)))?.category.id
    || groups[0]?.category.id
    || "";
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(initiallyOpen ? [initiallyOpen] : []));

  const toggleGroup = (groupId: string) => {
    setOpenGroups(current => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const toggleService = (serviceId: string) => {
    if (disabled) return;
    onChange(
      selectedIds.has(serviceId)
        ? value.filter(id => id !== serviceId)
        : [...value, serviceId]
    );
  };

  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-outline-variant/60 bg-surface-container-low p-4 text-sm text-on-surface-variant">
        Chưa có dịch vụ khả dụng.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map(serviceId => {
            const service = services.find(item => item.id === serviceId);
            if (!service) return null;
            return (
              <span key={serviceId} className="inline-flex items-center gap-1.5 rounded-full bg-primary-fixed px-3 py-1.5 text-xs font-bold text-primary-container">
                <Check size={13} />
                {getServicePathLabel(service, services).replaceAll(" / ", " → ")}
              </span>
            );
          })}
        </div>
      )}

      <div className="max-h-[26rem] space-y-2 overflow-y-auto rounded-lg border border-outline-variant/40 bg-surface-container-low p-2">
        {groups.map(group => {
          const isOpen = openGroups.has(group.category.id);
          const selectedCount = group.services.filter(service => selectedIds.has(service.id)).length;

          return (
            <section key={group.category.id} className="overflow-hidden rounded-lg border border-outline-variant/30 bg-white">
              <button
                type="button"
                onClick={() => toggleGroup(group.category.id)}
                className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left"
                aria-expanded={isOpen}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-extrabold text-on-surface">{group.category.name}</span>
                  <span className="mt-0.5 block text-xs text-on-surface-variant">
                    {group.services.length} dịch vụ{selectedCount > 0 ? ` · đã chọn ${selectedCount}` : ""}
                  </span>
                </span>
                <ChevronRight size={18} className={`shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />
              </button>

              {isOpen && (
                <div className="space-y-3 border-t border-outline-variant/30 p-2">
                  {group.directServices.length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {group.directServices.map(service => (
                        <ServiceCheckbox
                          key={service.id}
                          service={service}
                          pathLabel={getServicePathLabel(service, services)}
                          selected={selectedIds.has(service.id)}
                          showPrice={showPrices}
                          disabled={disabled}
                          onToggle={toggleService}
                        />
                      ))}
                    </div>
                  )}
                  {group.childGroups.map(childGroup => (
                    <div key={childGroup.child.id} className="space-y-2">
                      <p className="px-1 text-xs font-bold uppercase text-on-surface-variant">{childGroup.child.name}</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {childGroup.services.map(service => (
                          <ServiceCheckbox
                            key={service.id}
                            service={service}
                            pathLabel={getServicePathLabel(service, services)}
                            selected={selectedIds.has(service.id)}
                            showPrice={showPrices}
                            disabled={disabled}
                            onToggle={toggleService}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ServiceCheckbox<T extends ServiceOption>({
  service,
  pathLabel,
  selected,
  showPrice,
  disabled,
  onToggle,
}: {
  service: T;
  pathLabel: string;
  selected: boolean;
  showPrice: boolean;
  disabled: boolean;
  onToggle: (serviceId: string) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      disabled={disabled}
      onClick={() => onToggle(service.id)}
      className={`flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
        selected
          ? "border-primary-container bg-primary-fixed text-primary-container"
          : "border-outline-variant/40 bg-white text-on-surface hover:border-primary/40"
      } disabled:opacity-50`}
    >
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${selected ? "border-primary-container bg-primary-container text-white" : "border-outline-variant bg-white"}`}>
        {selected && <Check size={14} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{service.name || "Dịch vụ"}</span>
        {pathLabel && pathLabel !== service.name && (
          <span className="mt-0.5 block truncate text-xs text-on-surface-variant">{pathLabel}</span>
        )}
        {showPrice && Number(service.base_price || 0) > 0 && (
          <span className="mt-0.5 block text-xs text-on-surface-variant">
            Từ {Number(service.base_price).toLocaleString("vi-VN")}đ
          </span>
        )}
      </span>
    </button>
  );
}
