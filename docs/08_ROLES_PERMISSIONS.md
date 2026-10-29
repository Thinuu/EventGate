# 08_ROLES_PERMISSIONS

## Role Definitions
| Role | Description | Primary Permissions |
|------|-------------|----------------------|
| **MainAdmin** | Full system administrator. Can manage users, companies, events, and system configuration. | `*` (all) |
| **MainOrganiser** | Owner of a company (organisation) and can create/manage events, zones, sponsors, and staff under that company. | Create/Update/Delete Events, Zones, Sponsors, Staff; View all tickets for their events; View RFID Assignment Registry (view-only) |
| **SubOrganiser** | Organiser with limited rights, typically assigned to a specific event. | Manage assigned event(s) – edit event details, zones, tickets; view attendees; RFID Assignment; Entry Scanner; Manual Search; Zone Scanner; View payments |
| **Staff** | Works for an organiser; handles day‑to‑day operations such as checking tickets, managing zones, and handling enquiries. | Access zone logs, entry logs, update ticket status (e.g., `CONFIRMED`, `CANCELLED`), send notifications; RFID Assignment; Entry Scanner; Zone Scanner; Manual Search; Bulk Upload; Activity Logs |
| **Volunteer** | Assists staff on‑site; limited to scanning tickets and viewing basic event info. | Read‑only access to ticket validation endpoints; cannot modify data |
| **Auditor** | Audits system activity; read‑only across the platform. | View audit logs, request logs, system logs; cannot modify any data |
| **Sponsor** | Company sponsoring an event; can view their own sponsorship details & promotional materials. | Read access to `sponsor` resources, upload assets |
| **Attendee** | End‑user purchasing tickets. | Create orders, assign tickets, view personal tickets, receive notifications |

## SubOrganiser Permissions Detail
SubOrganisers have scoped access to assigned events with the following capabilities:
- **RFID Assignment** - Assign RFID tags to attendees via QR-first flow or manual search (requires `event.settings.rfidEnabled`)
- **Entry Scanner** - Check-in/out attendees at assigned gates with QR/RFID support and real-time statistics
- **Zone Scanner** - Validate and record zone entry/exit for assigned zones with auto-toggle ENTRY/EXIT
- **Manual Search** - Search for attendees by name, email, phone, or ticket number
- **Bulk Upload** - Upload RFID tags in bulk via Excel
- **Activity Logs** - View entry and zone scan activity logs
- **Payments** - View payment submissions for assigned events

### Scanning Permissions
| Permission | Purpose |
|------------|---------|
| `canEntryAccess` / `canScanEntry` | Access to Entry Scanner for check-in/check-out operations |
| `canScanZone` / `canGateScanAccess` | Access to Zone Scanner for zone entry/exit operations |
| `canManualSearch` | Access to Manual Search for finding attendees |

These permissions are automatically granted if the SubOrganiser has assigned zones or gates.

## Permission Implementation
Permissions are enforced in controller functions via role checks, e.g.:
```js
if (!['MainAdmin', 'MainOrganiser'].includes(req.user.role)) {
  return res.status(403).json({ success: false, message: 'Insufficient permissions' });
}
```
A helper `authorize(allowedRoles)` middleware exists in `backend/src/middleware/authorize.js` that can be used as:
```js
router.post('/events', protect, authorize(['MainAdmin', 'MainOrganiser']), createEvent);
```
The `authorize` middleware simply verifies `allowedRoles.includes(req.user.role)` and returns 403 otherwise.

## Role Hierarchy
```
MainAdmin > MainOrganiser > SubOrganiser > Staff > Volunteer > Attendee
Auditor (parallel, read‑only)
Sponsor (parallel, limited read)
```
Higher roles inherit all permissions of the lower ones, except where explicitly overridden.

---
*Derived from the `User` model (`backend/src/models/User.js`) and the `authorize` middleware.*
