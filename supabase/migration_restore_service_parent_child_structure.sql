-- Restore the service catalog tree without changing existing customers or jobs.
-- Existing jobs.service_id values are intentionally left untouched.

ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS parent_service_id UUID REFERENCES public.services(id) ON DELETE CASCADE;

-- Keep these rows as top-level categories or standalone services.
WITH root_services(id) AS (
  VALUES
    ('11111111-0000-0000-0000-000000000001'::uuid), -- Dien
    ('11111111-0000-0000-0000-000000000002'::uuid), -- Nuoc
    ('11111111-0000-0000-0000-000000000003'::uuid), -- Camera
    ('11111111-0000-0000-0000-000000000004'::uuid), -- Co khi
    ('507c86a0-3ff5-473f-9db2-05d15285e0d3'::uuid), -- Dien Lanh
    ('77a036fc-646c-43e5-87cb-40e02c0d1e9e'::uuid), -- Mang Internet
    ('1267f766-5082-4287-a5e9-a2c475753275'::uuid), -- May In
    ('c33238ad-121d-4315-aacd-b4f361cb8ad9'::uuid), -- May Tinh
    ('5aea9d65-16ad-49c7-865a-9ffb8fa69a6f'::uuid), -- Khac
    ('0ebd7f89-db56-428e-9b6a-eb46d2cdf453'::uuid), -- Chuyen Nha & Van Chuyen
    ('ef7bc117-3784-43a8-a86d-db655722bbd5'::uuid), -- San Vuon
    ('2af66223-a6cb-4a5d-8750-404df588757e'::uuid)  -- Xay dung & Noi That
)
UPDATE public.services AS service
SET parent_service_id = NULL,
    updated_at = NOW()
FROM root_services
WHERE service.id = root_services.id
  AND service.parent_service_id IS NOT NULL;

-- Reattach child categories and leaf services under the intended parent.
WITH hierarchy(child_id, parent_id) AS (
  VALUES
    -- Camera
    ('3b2657a3-8e24-4564-b916-5000bb383708'::uuid, '11111111-0000-0000-0000-000000000003'::uuid), -- Lap Dat -> Camera
    ('f92bdc0f-39c4-4927-9154-c947ebf8de84'::uuid, '11111111-0000-0000-0000-000000000003'::uuid), -- Sua Chua -> Camera
    ('aa6ee17d-6d94-466e-9d1c-3f916442d831'::uuid, '3b2657a3-8e24-4564-b916-5000bb383708'::uuid),
    ('a8264a9f-fa6d-4794-a556-6279a1dddcf9'::uuid, '3b2657a3-8e24-4564-b916-5000bb383708'::uuid),
    ('52ce8019-a542-4823-b76b-d9329c58636e'::uuid, 'f92bdc0f-39c4-4927-9154-c947ebf8de84'::uuid),
    ('d6961b57-f766-4990-bf45-7fe1e77592c7'::uuid, 'f92bdc0f-39c4-4927-9154-c947ebf8de84'::uuid),
    ('9d5a7a8e-9c50-4536-8850-070eeee8df4d'::uuid, 'f92bdc0f-39c4-4927-9154-c947ebf8de84'::uuid),
    ('19c6c7eb-5b47-447b-9efd-f66548d832fb'::uuid, 'f92bdc0f-39c4-4927-9154-c947ebf8de84'::uuid),
    ('0a6faf96-1f87-48a1-9279-14d58ac68a27'::uuid, 'f92bdc0f-39c4-4927-9154-c947ebf8de84'::uuid),
    ('487e7f4b-fa84-4cba-88b9-3e1707e1432f'::uuid, 'f92bdc0f-39c4-4927-9154-c947ebf8de84'::uuid),

    -- May Tinh
    ('6ed74dc6-a075-466a-be67-6c2589d61a03'::uuid, 'c33238ad-121d-4315-aacd-b4f361cb8ad9'::uuid), -- Sua Chua -> May Tinh
    ('a5c8c925-61e7-4e7d-af96-17b20178a1f3'::uuid, 'c33238ad-121d-4315-aacd-b4f361cb8ad9'::uuid),
    ('679ab207-49a3-4252-a6e7-be166cf41d34'::uuid, 'c33238ad-121d-4315-aacd-b4f361cb8ad9'::uuid),
    ('382d1f31-62c3-42f5-9d1f-e0cde03bfd3a'::uuid, '6ed74dc6-a075-466a-be67-6c2589d61a03'::uuid),
    ('37707a2b-cd38-4a2b-ad69-f2833c4536bf'::uuid, '6ed74dc6-a075-466a-be67-6c2589d61a03'::uuid),
    ('1d88b000-cced-4fec-a79a-d323adb0b50d'::uuid, '6ed74dc6-a075-466a-be67-6c2589d61a03'::uuid),

    -- May In
    ('f271655a-98ed-40a8-9688-b41923d5af92'::uuid, '1267f766-5082-4287-a5e9-a2c475753275'::uuid),
    ('240a3b4c-e3b6-48af-9d09-4f91af494c89'::uuid, 'f271655a-98ed-40a8-9688-b41923d5af92'::uuid),
    ('4803d1e4-9f46-4da3-8f83-86502dc7a4d8'::uuid, 'f271655a-98ed-40a8-9688-b41923d5af92'::uuid),
    ('f2a99a2b-cfd1-4e82-9b52-1d81fecf6344'::uuid, 'f271655a-98ed-40a8-9688-b41923d5af92'::uuid),

    -- Mang Internet
    ('ffbb1b41-559b-477b-af5f-a7790b934eb8'::uuid, '77a036fc-646c-43e5-87cb-40e02c0d1e9e'::uuid),
    ('7015fa60-406d-433a-b5cb-24f8c6b638cf'::uuid, '77a036fc-646c-43e5-87cb-40e02c0d1e9e'::uuid),
    ('a1584915-6839-47f9-a291-04eca378658d'::uuid, '77a036fc-646c-43e5-87cb-40e02c0d1e9e'::uuid),
    ('3939f5ad-6561-4ce5-8468-4efc6e50bc33'::uuid, 'ffbb1b41-559b-477b-af5f-a7790b934eb8'::uuid),
    ('aed8beb6-a4e0-4a0a-bd12-7dbc9eb4536c'::uuid, '7015fa60-406d-433a-b5cb-24f8c6b638cf'::uuid),
    ('faa03d76-3031-4c2a-80d0-77dc3529d534'::uuid, 'a1584915-6839-47f9-a291-04eca378658d'::uuid),
    ('cbd266f1-69db-4fb7-a04e-376a36d3d3bd'::uuid, 'a1584915-6839-47f9-a291-04eca378658d'::uuid),
    ('fafe89b7-c90f-423c-9241-a49fa5037e33'::uuid, 'a1584915-6839-47f9-a291-04eca378658d'::uuid)
)
UPDATE public.services AS child
SET parent_service_id = hierarchy.parent_id,
    updated_at = NOW()
FROM hierarchy
WHERE child.id = hierarchy.child_id
  AND EXISTS (
    SELECT 1
    FROM public.services AS parent
    WHERE parent.id = hierarchy.parent_id
  )
  AND child.parent_service_id IS DISTINCT FROM hierarchy.parent_id;
