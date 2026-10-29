# 06_DATABASE_RELATIONSHIPS

## Overview
The EAMS system stores data in MongoDB using Mongoose. Relationships are defined via ObjectId references. Below is a concise map of how the primary collections relate to one another.

| Collection | References (One‑to‑Many / One‑to‑One) |
|------------|----------------------------------------|
| **User** | `company` → Company (many users belong to a company) |
| **Company** | `organisers` → User (users with role *organiser*) |
| **Event** | `company` → Company (owner)\n`zones` → Zone (embedded via separate collection) |
| **Zone** | `event` → Event (zone belongs to an event) |
| **Order** | `buyer` → User (buyer role)\n`event` → Event\n`tickets` → Ticket (array of ticket IDs) |
| **Ticket** | `event` → Event\n`order` → Order\n`attendee` → Attendee (optional)\n`inviteEmail`/`invitePhone` related to **Notification** via invite token |
| **Attendee** | `ticket` → Ticket (one‑to‑one); `event` → Event; `order` → Order; `rfidTag` → (String field used as unique identifier per event) |
| **PaymentSubmission** | `order` → Order\n`paymentMethod` (enum) |
| **RfidTag** | `event` → Event\n`attendee` → Attendee\n`ticket` → Ticket\n`assignedBy` → User |
| **ZoneLog** | `attendeeId` → Attendee\n`eventId` → Event\n`scannedBy` → User |
| **EntryLog** | `event` → Event\n`attendee` → Attendee\n`processedBy` → User |
| **AuditLog** | `user` → User (actor) |
| **Notification** | `user` → User (recipient)\n`relatedTicket` → Ticket (optional) |
| **ShortLink** | `event` → Event (maps short URL to event page) |
| **Sponsor** | `event` → Event |
| **SystemConfig** | No references – key/value store |
| **UserDevice** | `user` → User (device for push notifications) |
| **BankAccount** | `company` → Company |

### Example: Ticket → Event → Company
A **Ticket** references its **Event**, which in turn references the owning **Company**. This chain enables queries such as “find all tickets for a given company”.

### Loading Relations in Code
Mongoose `populate` is used throughout the service layer, e.g.:
```js
await Ticket.findById(id)
  .populate('event')
  .populate('attendee')
  .populate({ path: 'order', populate: { path: 'buyer' } })
```
All populate calls are defined in the respective controller/service files.

---

### Attendee QR/RFID State Fields

- `rfidTag` (String) – unique identifier used for RFID-based check-in and zone access.
- A sparse unique compound index `{ event: 1, rfidTag: 1 }` allows tags to be reused across different events while preventing duplicates within the same event.
- Access control state and history (like check-ins and zone access) are logged dynamically via `EntryLog` and `ZoneLog` collections rather than being persisted on the `Attendee` directly.
---
*All relationships are derived from the schema definitions in `backend/src/models/*.js`. No additional hidden links exist.*
