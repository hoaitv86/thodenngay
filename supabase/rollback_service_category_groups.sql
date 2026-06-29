-- Rollback for migration_service_category_groups.sql.
-- Only removes the new consolidation tables and policies; existing Alotho data remains untouched.

drop policy if exists "Admins can manage service category mappings" on public.service_category_mappings;
drop policy if exists "Anyone can view service category mappings" on public.service_category_mappings;
drop table if exists public.service_category_mappings;

drop policy if exists "Admins can manage service category groups" on public.service_category_groups;
drop policy if exists "Anyone can view service category groups" on public.service_category_groups;
drop table if exists public.service_category_groups;
