# Release Notes

## Worker Dashboard Today Label

Release date: 2026-07-13

### Features
- Worker dashboard today stats now show only the day number, keeping the stat cards shorter on mobile.

### Fixes
- No bug fixes included.

### Database Changes
- None.

### Upgrade Notes
- No migration is required.

## Worker Inventory Category Suggestions

Release date: 2026-07-13

### Features
- Inventory product category suggestions now follow the worker's specialties.
- Workers without a clear specialty see a compact fallback list instead of the full category set.
- Custom category entry remains available for each shop's own product grouping.

### Fixes
- Prevented the add/edit product category field from showing an overly broad global category list.

### Database Changes
- None.

### Upgrade Notes
- No migration is required.

## Worker Old Backlog Jobs

Release date: 2026-07-13

### Features
- Worker mobile navigation now shows `Tồn việc` for old unfinished jobs.
- The `Tồn việc` page lists only unfinished jobs from months before the current month.
- The mobile `+` button opens the existing quick job form on the worker dashboard.

### Fixes
- Removed the extra floating mobile quick job button to keep the 5-button mobile layout clean.
- Clarified the job backlog scope so current-month jobs do not appear in `Tồn việc`.

### Database Changes
- None.

### Upgrade Notes
- No migration is required.

## Worker Dashboard Mobile Stats Layout

Release date: 2026-07-12

### Features
- Worker dashboard stat cards now show the current month first and today's dated stats below it.
- Mobile worker dashboard now has a floating `Tạo việc` button for faster quick job creation.

### Fixes
- Reduced vertical space above the quick job form on mobile by removing the separate today stats row.

### Database Changes
- None.

### Upgrade Notes
- No migration is required.

## Worker Dashboard Today Stats

Release date: 2026-07-12

### Features
- Worker dashboard now shows today's customers, today's average rating, and today's total collected amount below the main stat cards.
- Revenue display uses compact values such as `350k` and `1.2tr` for cleaner layout.

### Fixes
- No bug fixes included.

### Database Changes
- None.

### Upgrade Notes
- No migration is required for this dashboard UI update.
