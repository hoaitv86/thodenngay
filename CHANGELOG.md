# Changelog

## 2026-07-12 - Worker Dashboard Today Stats

### Added
- Added compact today statistics to the worker dashboard: customers, average rating, and total collected amount.

### Changed
- Made worker dashboard stat labels shorter and easier to scan.

### Database
- No database schema changes.

### Notes
- Today and monthly revenue prioritize paid payment records by `paid_at`; job amount is used only as a fallback when no paid payment records exist for the period.
