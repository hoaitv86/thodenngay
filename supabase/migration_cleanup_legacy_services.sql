-- Cleanup legacy/self-created services without hard-deleting rows.
-- Run after/with migration_standard_service_catalog_v1.sql.
-- The original service is preserved in jobs.service_detail_id before service_id is mapped.

ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS visible_to_customer BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS visible_to_admin BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS visible_to_worker BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS service_detail_id UUID REFERENCES public.services(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.service_catalog_legacy_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  old_service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  old_service_name TEXT NOT NULL,
  target_service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  target_service_name TEXT NOT NULL,
  job_count INTEGER NOT NULL DEFAULT 0,
  mapped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS service_catalog_legacy_audit_old_service_idx
ON public.service_catalog_legacy_audit (old_service_id);

WITH mapping(old_service_id, target_service_id, note) AS (
  VALUES
    ('a5c8c925-61e7-4e7d-af96-17b20178a1f3'::uuid, '4cd5389b-d046-5cc1-8d8f-6e26fd9fbecd'::uuid, 'Cai Dat -> May tinh / Cai dat'),
    ('52ce8019-a542-4823-b76b-d9329c58636e'::uuid, '7881f32a-24d8-5e84-94ae-fe80cc4f23ac'::uuid, 'Cai dat lai Camera -> Camera / Cai dat'),
    ('d5d17121-1845-4103-8efb-793daeda7b8e'::uuid, '4cd5389b-d046-5cc1-8d8f-6e26fd9fbecd'::uuid, 'Cai lai Windows -> May tinh / Cai dat'),
    ('a0dcc00b-fb8c-46c8-957c-9f73d4b14907'::uuid, '4cd5389b-d046-5cc1-8d8f-6e26fd9fbecd'::uuid, 'Cay dong bo -> May tinh / Cai dat'),
    ('0ebd7f89-db56-428e-9b6a-eb46d2cdf453'::uuid, '5aea9d65-16ad-49c7-865a-9ffb8fa69a6f'::uuid, 'Chuyen nha / van chuyen -> Khac'),
    ('d6961b57-f766-4990-bf45-7fe1e77592c7'::uuid, 'c0c7b1e4-6b77-5035-b342-ab329b174eff'::uuid, 'Chuyen vi tri -> Camera / Di doi'),
    ('11111111-0000-0000-0000-000000000004'::uuid, '5aea9d65-16ad-49c7-865a-9ffb8fa69a6f'::uuid, 'Co khi -> Khac'),
    ('11111111-0000-0000-0000-000000000001'::uuid, '5aea9d65-16ad-49c7-865a-9ffb8fa69a6f'::uuid, 'Dien -> Khac'),
    ('4082c7c6-993c-4887-8dd8-15b83f529e4c'::uuid, '5aea9d65-16ad-49c7-865a-9ffb8fa69a6f'::uuid, 'Dien Co -> Khac'),
    ('507c86a0-3ff5-473f-9db2-05d15285e0d3'::uuid, '5aea9d65-16ad-49c7-865a-9ffb8fa69a6f'::uuid, 'Dien Lanh -> Khac'),
    ('3032e970-0f7d-41cc-9a16-cde8059ec82d'::uuid, '5aea9d65-16ad-49c7-865a-9ffb8fa69a6f'::uuid, 'Dien Tu -> Khac'),
    ('f271655a-98ed-40a8-9688-b41923d5af92'::uuid, '1b366120-97a8-58b6-9ed4-45918f0edfc1'::uuid, 'Do Muc -> May in / Muc in'),
    ('35c4c1b5-fa59-4e49-92be-5b6ae47b609d'::uuid, '2fef3daa-db2b-510d-9b82-08ac4cc16b04'::uuid, 'Keo Mang Lan -> Mang Internet / Lap dat'),
    ('3b2657a3-8e24-4564-b916-5000bb383708'::uuid, '95fd5d41-d088-5f07-9264-8329f4e6c753'::uuid, 'Lap Dat -> Camera / Lap dat'),
    ('aa6ee17d-6d94-466e-9d1c-3f916442d831'::uuid, '95fd5d41-d088-5f07-9264-8329f4e6c753'::uuid, 'Lap dat Camera dau ghi -> Camera / Lap dat'),
    ('a8264a9f-fa6d-4794-a556-6279a1dddcf9'::uuid, '95fd5d41-d088-5f07-9264-8329f4e6c753'::uuid, 'Lap dat Camera wifi -> Camera / Lap dat'),
    ('ffbb1b41-559b-477b-af5f-a7790b934eb8'::uuid, '2fef3daa-db2b-510d-9b82-08ac4cc16b04'::uuid, 'Lap Moi -> Mang Internet / Lap dat'),
    ('19df5ce0-d7cb-4a45-9d7a-ef5c3279797a'::uuid, '4cd5389b-d046-5cc1-8d8f-6e26fd9fbecd'::uuid, 'Lap rap dung may moi -> May tinh / Cai dat'),
    ('fafe89b7-c90f-423c-9241-a49fa5037e33'::uuid, '2fef3daa-db2b-510d-9b82-08ac4cc16b04'::uuid, 'Mang lan cap quang -> Mang Internet / Lap dat'),
    ('4b87c63d-1453-4061-9e22-44393f264dcd'::uuid, '05feb2e9-3d0f-5898-afdd-f24cc72c0f08'::uuid, 'Mat Nguon -> May in / Sua chua'),
    ('708461de-4e36-4b5f-8a74-660b25f36cb8'::uuid, '1f6bc129-48bc-5441-9a77-3da3528eb7c6'::uuid, 'Mat Tin Hieu -> Mang Internet / Sua chua'),
    ('e8924bfb-3df5-4374-89db-0a239346f74a'::uuid, 'a063097a-0156-5d6d-9013-0ac678df6814'::uuid, 'May Moi -> May in / Lap dat'),
    ('cbd266f1-69db-4fb7-a04e-376a36d3d3bd'::uuid, '1f6bc129-48bc-5441-9a77-3da3528eb7c6'::uuid, 'Noi day -> Mang Internet / Sua chua'),
    ('11111111-0000-0000-0000-000000000002'::uuid, '5aea9d65-16ad-49c7-865a-9ffb8fa69a6f'::uuid, 'Nuoc -> Khac'),
    ('76371990-f505-4e5d-b252-85e7c23a3647'::uuid, 'e3d9f919-5251-58e8-af99-20250fb2e071'::uuid, 'Phan mem diet Virut -> May tinh / Bao tri'),
    ('ef7bc117-3784-43a8-a86d-db655722bbd5'::uuid, '5aea9d65-16ad-49c7-865a-9ffb8fa69a6f'::uuid, 'San Vuon -> Khac'),
    ('3da05a7e-e4c3-4253-938a-a71e152c5b2b'::uuid, '5aea9d65-16ad-49c7-865a-9ffb8fa69a6f'::uuid, 'Sua chua chung -> Khac'),
    ('6ed74dc6-a075-466a-be67-6c2589d61a03'::uuid, 'ad4b6acf-7505-5ff6-8c2d-868fb0a42288'::uuid, 'Sua Chua camera -> Camera / Sua chua'),
    ('f92bdc0f-39c4-4927-9154-c947ebf8de84'::uuid, '1f6bc129-48bc-5441-9a77-3da3528eb7c6'::uuid, 'Sua Chua wifi -> Mang Internet / Sua chua'),
    ('a1584915-6839-47f9-a291-04eca378658d'::uuid, '1f6bc129-48bc-5441-9a77-3da3528eb7c6'::uuid, 'Sua Chua mang -> Mang Internet / Sua chua'),
    ('382d1f31-62c3-42f5-9d1f-e0cde03bfd3a'::uuid, 'a819450f-80ce-5a03-8345-e79bed397532'::uuid, 'Sua chua Laptop -> May tinh / Sua chua'),
    ('1d88b000-cced-4fec-a79a-d323adb0b50d'::uuid, 'a819450f-80ce-5a03-8345-e79bed397532'::uuid, 'Sua Main bo mach -> May tinh / Sua chua'),
    ('37707a2b-cd38-4a2b-ad69-f2833c4536bf'::uuid, 'a819450f-80ce-5a03-8345-e79bed397532'::uuid, 'Sua Main PC -> May tinh / Sua chua'),
    ('240a3b4c-e3b6-48af-9d09-4f91af494c89'::uuid, '1b366120-97a8-58b6-9ed4-45918f0edfc1'::uuid, 'Thay Catrig -> May in / Muc in'),
    ('4803d1e4-9f46-4da3-8f83-86502dc7a4d8'::uuid, '1b366120-97a8-58b6-9ed4-45918f0edfc1'::uuid, 'Thay muc may in Canon 2900 -> May in / Muc in'),
    ('9d5a7a8e-9c50-4536-8850-070eeee8df4d'::uuid, '61400a30-fdad-5597-8676-51d956ab680c'::uuid, 'Thay o cung dau ghi Camera -> Camera / Nang cap'),
    ('19c6c7eb-5b47-447b-9efd-f66548d832fb'::uuid, 'ad4b6acf-7505-5ff6-8c2d-868fb0a42288'::uuid, 'Thay pin Cmos dau ghi -> Camera / Sua chua'),
    ('0a6faf96-1f87-48a1-9279-14d58ac68a27'::uuid, '61400a30-fdad-5597-8676-51d956ab680c'::uuid, 'Thay the nho camera wifi -> Camera / Nang cap'),
    ('f2a99a2b-cfd1-4e82-9b52-1d81fecf6344'::uuid, '1b366120-97a8-58b6-9ed4-45918f0edfc1'::uuid, 'Thay Truc Tu -> May in / Muc in'),
    ('679ab207-49a3-4252-a6e7-be166cf41d34'::uuid, '5aea9d65-16ad-49c7-865a-9ffb8fa69a6f'::uuid, 'Ve Sinh -> Khac'),
    ('7015fa60-406d-433a-b5cb-24f8c6b638cf'::uuid, '2fef3daa-db2b-510d-9b82-08ac4cc16b04'::uuid, 'Wifi -> Mang Internet / Lap dat'),
    ('aed8beb6-a4e0-4a0a-bd12-7dbc9eb4536c'::uuid, '2fef3daa-db2b-510d-9b82-08ac4cc16b04'::uuid, 'Wifi 4G -> Mang Internet / Lap dat'),
    ('faa03d76-3031-4c2a-80d0-77dc3529d534'::uuid, '1f6bc129-48bc-5441-9a77-3da3528eb7c6'::uuid, 'Wifi mat nguon -> Mang Internet / Sua chua'),
    ('2af66223-a6cb-4a5d-8750-404df588757e'::uuid, '5aea9d65-16ad-49c7-865a-9ffb8fa69a6f'::uuid, 'Xay dung / Noi That -> Khac'),
    ('487e7f4b-fa84-4cba-88b9-3e1707e1432f'::uuid, 'a194fa71-c2ee-5bbf-8b8b-1bae387971c2'::uuid, 'Xoa tai khoan Camera wifi -> Camera / Tai khoan')
),
job_counts AS (
  SELECT service_id, COUNT(*)::integer AS job_count
  FROM public.jobs
  GROUP BY service_id
),
valid_mapping AS (
  SELECT
    mapping.old_service_id,
    old_service.name AS old_service_name,
    mapping.target_service_id,
    target_service.name AS target_service_name,
    COALESCE(job_counts.job_count, 0) AS job_count,
    mapping.note
  FROM mapping
  JOIN public.services old_service ON old_service.id = mapping.old_service_id
  JOIN public.services target_service ON target_service.id = mapping.target_service_id
  LEFT JOIN job_counts ON job_counts.service_id = mapping.old_service_id
)
INSERT INTO public.service_catalog_legacy_audit (
  old_service_id,
  old_service_name,
  target_service_id,
  target_service_name,
  job_count,
  note
)
SELECT old_service_id, old_service_name, target_service_id, target_service_name, job_count, note
FROM valid_mapping
ON CONFLICT (old_service_id) DO UPDATE
SET old_service_name = EXCLUDED.old_service_name,
    target_service_id = EXCLUDED.target_service_id,
    target_service_name = EXCLUDED.target_service_name,
    job_count = EXCLUDED.job_count,
    mapped_at = NOW(),
    note = EXCLUDED.note;

WITH mapping(old_service_id, target_service_id) AS (
  SELECT old_service_id, target_service_id
  FROM public.service_catalog_legacy_audit
)
UPDATE public.jobs AS job
SET service_detail_id = COALESCE(job.service_detail_id, job.service_id),
    service_id = mapping.target_service_id,
    updated_at = NOW()
FROM mapping
WHERE job.service_id = mapping.old_service_id
  AND mapping.old_service_id <> mapping.target_service_id;

WITH legacy_services AS (
  SELECT old_service_id
  FROM public.service_catalog_legacy_audit
)
UPDATE public.services AS service
SET is_active = FALSE,
    visible_to_customer = FALSE,
    visible_to_worker = FALSE,
    visible_to_admin = TRUE,
    updated_at = NOW()
FROM legacy_services
WHERE service.id = legacy_services.old_service_id;
