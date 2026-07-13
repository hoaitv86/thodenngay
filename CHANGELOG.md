# Changelog

## 2026-07-13 - Worker Availability Toggle

### Added
- Added an Online/Offline toggle to the worker dashboard.
- Added `workers.is_available` to let active workers pause receiving new jobs without changing account approval status.

### Changed
- Hidden new job feed items while a worker is Offline.
- Filtered admin manual assignment and worker job acceptance by worker availability.

### Database
- Added `supabase/migration_worker_availability.sql`.

## 2026-07-13 - Worker Dashboard Today Label

### Changed
- Shortened the worker dashboard today stat label to show only the day number.

### Database
- No database schema changes.

## 2026-07-13 - Worker Inventory Category Suggestions

### Changed
- Filtered inventory product category suggestions by the logged-in worker's specialties.
- Kept category suggestions compact for workers without clear specialties.
- Kept custom category entry available for shops with their own product grouping.

### Database
- No database schema changes.

## 2026-07-13 - Worker Old Backlog Jobs

### Added
- Added the worker `Tồn việc` view for unfinished jobs from previous months only.
- Added search across customer name, phone, job code, service, address, and description in the backlog view.

### Changed
- Renamed the mobile worker navigation item from `Công việc` to `Tồn việc`.
- Changed the middle mobile `+` action to open and scroll to the quick job form.
- Removed the floating mobile quick job button from the worker dashboard.

### Database
- No database schema changes.

## 2026-07-12 - Worker Dashboard Mobile Stats Layout

### Changed
- Merged today stats into the main worker dashboard stat cards.
- Changed period labels to show the current month, such as `Tháng 7`, and today's date, such as `Hôm nay 12/07`.
- Added a floating mobile `Tạo việc` button that opens and scrolls to the quick job form.

### Database
- No database schema changes.

## 2026-07-12 - Worker Dashboard Today Stats

### Added
- Added compact today statistics to the worker dashboard: customers, average rating, and total collected amount.

### Changed
- Made worker dashboard stat labels shorter and easier to scan.

### Database
- No database schema changes.

### Notes
- Today and monthly revenue prioritize paid payment records by `paid_at`; job amount is used only as a fallback when no paid payment records exist for the period.
