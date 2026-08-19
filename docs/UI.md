# UI inventory

## Shared shell

- Property switcher, role badge, user identity, verified sign-out.
- Role-filtered sidebar.
- Sticky header with live-sync state, manual refresh, notifications placeholder, and global check-in action.
- Accessible modal system with Escape/backdrop close, labelled controls, inline errors, loading state, and success toast.
- Responsive tablet sidebar and bottom-sheet style mobile dialogs.

## Admin views

| View | Primary components and actions |
|---|---|
| Overview | Occupancy, room availability, check-ins, receipts, room pulse, activity, in-house guests. |
| Front desk | Check-in drawer, active/recent stay table, locked-stay manage dialog, room transfer, invoice and check-out launch. |
| Guests | Search, contact/location/stay totals, masked ID indicator, private proof link, audited edit dialog. |
| Billing | Outstanding/collected totals, pending-stay invoice action, invoice register, offline payment dialog, void dialog. |
| Team access | Admin-created verified-email access, role/access state, enable/disable dialog with reason. |
| Audit trail | Action, module, actor, reason, and timestamp table. |
| Settings | Property identity, state, GSTIN, default GST, audited settings form. |

## Manager views

| View | Primary components and actions |
|---|---|
| Overview | Live occupancy, room availability, today’s check-ins, active stays, read-only room pulse and recent records. |
| Front desk | Full guest check-in form and private ID upload; confirmed records show a lock instead of Manage. |

Billing, Guests, Team access, Audit trail, and Settings are omitted from manager navigation and protected independently by the server.

## Design system

- Calm hospitality palette: deep evergreen, warm off-white, mint operational states, amber warnings, and violet housekeeping.
- Compact information density for desktop front desks, with 44-pixel minimum primary touch targets.
- Status is always expressed with text in addition to color.
- Indian currency formatting and local date/time presentation.
- Realistic empty states explain the next operational action.
