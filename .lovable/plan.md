## Goal
In the admin booking dialog, the "הוספת לקוחה חדשה" button currently sits inside the scrollable client list and is only visible after scrolling to the bottom. Make it always visible at the top of the popup, right under the search input — no scroll needed.

## Change
File: `src/pages/admin/AdminCalendar.tsx` (client picker `Popover`, ~lines 1345–1396).

- Move the "הוספת לקוחה חדשה" button out of `CommandList` so it doesn't scroll with the results.
- Place it directly between `CommandInput` and `CommandList`, with a bottom border separator, so it's always pinned at the top of the dropdown.
- Keep behavior identical: closes the popover and opens `ManualClientDialog`.

No changes to `AdminDashboard` (its "הוספת לקוחה" button is already a standalone top-level button) or to `ManualClientDialog` itself.
