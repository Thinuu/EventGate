# 09_BUSINESS_LOGIC

## Overview
The core business logic of EAMS lives in the **service layer** (`backend/src/services`). Each service encapsulates a specific domain responsibility and is invoked by route controllers.

| Service | Primary Responsibilities |
|---------|--------------------------|
| `notificationService.js` | Build and send multi‑channel notifications (email, SMS, WhatsApp), create persistent `Notification` documents, handle cash‑reservation messaging. |
| `paymentService.js` | Integrate with Stripe and PayHere, verify webhooks, update `Order` status, generate PDF receipts. |
| `ticketDeliveryService.js` | Generate PDF tickets, send them via email, update ticket status after delivery. |
| `pdfService.js` | Helper for creating order summary PDFs using `pdfkit`. |
| `s3Service.js` | Upload and retrieve files from Azure Blob / S3 storage (used for attendee photos). |
| `smsService.js` / `whatsappService.js` | Wrapper around Twilio/WhatsApp APIs for sending transactional messages. |
| `shortLinkService.js` | Create short URLs that map to deep‑link routes (used in notifications). |
| `photoValidationService.js` | Validate attendee upload dimensions, file type, and size. |
| `finalConfirmationService.js` | Assemble final order confirmation details, trigger notifications, and mark tickets as **SOLD**. |
| `rfidService.js` | RFID tag normalization, validation (10-digit format), assignment to attendees, and unassignment. |

**Typical Flow (Buyer Order)**:
1. **Create Order** – `POST /buyer/orders` controller calls `orderService.createOrder` which stores the order and reserves tickets.
2. **Payment** – Webhook from Stripe/PayHere hits `paymentService.handleWebhook`, updates `Order.paymentStatus` and calls `notificationService.notifyOrderConfirmation`.
3. **Ticket Assignment** – Buyer assigns attendees via `POST /buyer/assign`. The controller updates `Ticket` documents, triggers `notificationService.notifyInvite` and `notifyBuyerTicketProgress`.
4. **Final Confirmation** – Once all tickets are `ASSIGNED`/`CONFIRMED`, `finalConfirmationService` marks them `SOLD`, sends final summary, and generates PDFs.

**RFID Assignment Workflow**:
1. Staff scans attendee QR code or performs manual search.
2. Backend validates the RFID tag format (10 digits) and checks availability.
3. RFID tag is assigned to the attendee via `rfidService.assignRfidToAttendee()`.
4. The tag's `status` changes from `AVAILABLE` to `ASSIGNED`, linking to the attendee and ticket.
5. Organizers can view all assigned RFID tags with attendee details through the RfidAssignmentView component (view-only registry).
6. Category information is resolved from the `Ticket.categoryName` field for accurate assignment records.

**Check-In/Check-Out Logic**:
The system supports both QR and RFID for entry/exit operations with proper state management:

1. **Entry Scanner (Main Entry)**:
   - `CHECK_IN`: Sets `attendee.checkedIn = true`, records `checkedInAt` timestamp
   - `CHECK_OUT`: Sets `attendee.checkedIn = false`, clears `checkedInAt`
   - **Credential Deduplication**: If attendee is already checked in, subsequent check-in attempts are denied with a suggestion to switch to exit mode
   - **Cross-Credential Support**: QR check-in → RFID check-out (and vice versa) is allowed for the same attendee

2. **Zone Scanner (Inner Zones)**:
   - Requires main entry check-in before allowing zone entry
   - Auto-toggles between ENTRY and EXIT based on current zone state
   - Logs each zone access attempt in `ZoneLog` with `ENTRY` or `EXIT` action
   - Zone exit is only allowed if attendee is currently in that zone

3. **State Validation**:
   - `ALREADY_CHECKED_IN`: Returned when attempting check-in for already checked-in attendee
   - `NOT_CHECKED_IN`: Returned when attempting check-out for not checked-in attendee
   - `suggestCheckOut` flag in response for UI to show "Switch to Exit Mode" button

4. **RFID Assignment Flow**:
   - Only available when `event.settings.rfidEnabled === true`
   - "RFID Not Assigned" prompt appears after successful scan for attendees without RFID
   - Backend rejects RFID assignment attempts for disabled events with 403 `RFID_DISABLED`

**SubOrganizer Dashboard Operations**:
Sub-organizers with appropriate permissions have access to:
- **Entry Scanner**: Check-in/out at assigned gates with QR/RFID support and RFID assignment
- **Zone Scanner**: Validate and record zone entry/exit for assigned zones
- **Manual Search**: Find attendees by name, phone, or email for manual operations
- **Real-time Statistics**: Today's operational metrics (Entry In/Out, Zone In/Out, QR Scans, RFID Scans, Denied)
- **Recent Scans Activity**: Live feed of all entry and zone scan events with attendee details

---
*All details extracted from the service files in `backend/src/services`.*
### QR/RFID Credential Synchronization

- **Unified State**: QR and RFID credentials are two representations of the same attendee. The system maintains a single `checkedIn` flag and timestamps regardless of which credential is used.
- **Cross‑Credential Support**: A check‑in performed with a QR code can be followed by a check‑out using the RFID tag (and vice‑versa). The backend validates that the attendee is not already in the target state and returns `ALREADY_CHECKED_IN` or `NOT_CHECKED_IN` as appropriate.
- **Deduplication Rule**: Once an attendee is checked in, any additional check‑in attempt—whether via QR or RFID—is denied with a suggestion to switch to exit mode.
- **Error Codes**: New error responses (`ALREADY_CHECKED_IN`, `NOT_CHECKED_IN`) are documented in the error handling guide.

---
