# 12_NOTIFICATION_SYSTEM

## Overview
The notification system centralises all outbound communications (email, SMS, WhatsApp) and persists in‑app notifications. It lives in `backend/src/services/notificationService.js`.

### Core Functions
| Function | Channels | Description |
|----------|----------|-------------|
| `notifyOrderConfirmation` | email, SMS, WhatsApp | Sends order receipt after payment (except cash‑transfer). |
| `notifyInvite` | email, SMS, WhatsApp | Sends ticket invitation to an attendee. |
| `notifyFinalTicket` | email, SMS | Delivers final ticket PDF and creates a persistent `Notification`. |
| `notifyBuyerFinalSummary` | email, SMS | Summary of all attendees for the buyer. |
| `notifyConfirmationReminder` | email, SMS | Reminder for pending attendee confirmation. |
| `notifyStatusChange` | email, SMS | Updates attendee on ticket status changes. |
| `notifyPhotoRejection` / `notifyPhotoRejectionNotification` | email, SMS | Notifies attendee and buyer about a rejected photo. |
| `notifyBuyerTicketProgress` | email, SMS | Real‑time progress updates sent to the buyer during ticket lifecycle. |
| `notifyTicketInvalidationRefund` | email, SMS | Informs buyer and attendee of ticket invalidation & refund. |
| `notifyUserCredentials`, `notifyVerification`, `notifyPasswordReset`, `notifyOTP`, `notifyRoleAssignment` | email, SMS | Administrative communications (account creation, verification, password reset, MFA OTP, role changes). |
| `sendCashReservationEmail/SMS` & `sendCashPaymentConfirmedEmail` | email, SMS | Handles the *Cash at Entrance* flow (reservation and confirmation). |

### Channel Parsing
`parseChannels(notificationChannel, event)` reads global configuration from `SystemConfig` and per‑event overrides (`event.settings.communicationChannels`). It returns an array of enabled channels (`email`, `sms`, `whatsapp`).

### Persistent Notifications
`createNotification(userId, title, message, type, metadata)` stores a document in the `notifications` collection. These are displayed in the frontend via the `/api/notifications` endpoint.

### Extensibility
Adding a new channel (e.g., push notifications) requires:
1. Implement a send helper (e.g., `pushService.send`).
2. Extend `parseChannels` to include the new channel based on config.
3. Add calls to the new helper in the relevant notification functions.

---
*All information extracted from `backend/src/services/notificationService.js` and related utils.*
