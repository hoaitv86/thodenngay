import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkflowData } from "@/config/serviceWorkflows";

export type JobServiceLink = {
  id?: string | null;
  name?: string | null;
  parent_service_id?: string | null;
};

export type JobWithWorkflow = {
  service_id?: string | null;
  service?: JobServiceLink | null;
  job_services?: Array<{ service?: JobServiceLink | null; service_id?: string | null }> | null;
  workflow_data?: WorkflowData | null;
};

export const normalizeServiceIds = (serviceId?: string | null, serviceIds?: string[] | null) => {
  const seen = new Set<string>();
  const ids = [...(serviceIds || []), ...(serviceId ? [serviceId] : [])]
    .map((id) => id.trim())
    .filter(Boolean)
    .filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  return ids;
};

export const getPrimaryServiceId = (serviceId?: string | null, serviceIds?: string[] | null) =>
  normalizeServiceIds(serviceId, serviceIds)[0] || serviceId || null;

export const getJobServices = (job: JobWithWorkflow): JobServiceLink[] => {
  const linked = (job.job_services || [])
    .map((item) => item.service || (item.service_id ? { id: item.service_id } : null))
    .filter((service): service is JobServiceLink => Boolean(service?.id));

  if (linked.length > 0) return linked;
  return job.service?.id ? [job.service] : [];
};

export async function attachJobServices(
  supabase: SupabaseClient,
  jobId: string,
  serviceIds: string[],
) {
  const rows = normalizeServiceIds(null, serviceIds).map((serviceId, index) => ({
    job_id: jobId,
    service_id: serviceId,
    sort_order: index,
  }));

  if (rows.length === 0) return;

  const { error } = await supabase.from("job_services").upsert(rows, {
    onConflict: "job_id,service_id",
  });

  if (error) {
    console.warn("[workflow] job_services is not ready; keeping legacy service_id only.", error.message);
  }
}

export function isMissingWorkflowColumn(errorMessage: string) {
  return /workflow_data|job_services|schema cache|column|relation/i.test(errorMessage);
}
