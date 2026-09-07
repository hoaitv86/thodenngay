-- Point APK backup downloads at the official GitHub Releases asset.
ALTER TABLE public.system_settings
ALTER COLUMN apk_backup_download_url
SET DEFAULT 'https://github.com/hoaitv86/thodenngay/releases/latest/download/thodenngay.apk';

UPDATE public.system_settings
SET apk_backup_download_url = 'https://github.com/hoaitv86/thodenngay/releases/latest/download/thodenngay.apk'
WHERE id = 'default'
  AND (
    COALESCE(apk_backup_download_url, '') = ''
    OR apk_backup_download_url = 'https://raw.githubusercontent.com/tuananh9201/alo-tho/master/public/downloads/thodenngay.apk'
    OR apk_backup_download_url ILIKE 'https://drive.google.com/%'
  );
