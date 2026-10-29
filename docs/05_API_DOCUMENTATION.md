# 05_API_DOCUMENTATION

Generated API reference from backend route files.

## /api/auth  (from \backend/src/routes/auth.js)

| Method | Path |
|--------|------|
| POST | /api/auth/login |
| POST | /api/auth/register |
| POST | /api/auth/resend-verification |
| GET | /api/auth/verify-email/:token |
| POST | /api/auth/change-temp-password |
| POST | /api/auth/refresh-token |
| POST | /api/auth/logout |
| GET | /api/auth/me |
| POST | /api/auth/mfa/setup |
| POST | /api/auth/mfa/activate |
| POST | /api/auth/mfa/deactivate |
| PATCH | /api/auth/update-password |
| POST | /api/auth/forgot-password |
| POST | /api/auth/reset-password/:token |

## /api/users  (from \backend/src/routes/users.js)

| Method | Path |
|--------|------|
| GET | /api/users/ |
| POST | /api/users/ |
| PATCH | /api/users/:id |
| POST | /api/users/:id/resend-credentials |
| DELETE | /api/users/:id |

## /api/events  (from \backend/src/routes/events.js)

| Method | Path |
|--------|------|
| GET | /api/events/config/public |
| GET | /api/events/ |
| GET | /api/events/admin/all |
| GET | /api/events/my/events |
| GET | /api/events/manage/:eventId |
| POST | /api/events/ |
| PATCH | /api/events/:eventId/assign-organiser |
| PATCH | /api/events/:eventId/publish |
| GET | /api/events/:eventId/dashboard |
| PATCH | /api/events/:eventId |
| DELETE | /api/events/:eventId |
| GET | /api/events/:slug |
| POST | /api/events/:slug/validate-code |

## /api/orders  (from \backend/src/routes/orders.js)

| Method | Path |
|--------|------|
| POST | /api/orders/ |
| POST | /api/orders/finalize/:orderId |
| GET | /api/orders/confirm/:token |
| GET | /api/orders/:token |

## /api/confirm  (from \backend/src/routes/confirm.js)

| Method | Path |
|--------|------|
| GET | /api/confirm/:inviteToken |

## /api/attendees  (from \backend/src/routes/attendees.js)

| Method | Path |
|--------|------|
| POST | /api/attendees/confirm/:token |
| GET | /api/attendees/confirm/:token |
| GET | /api/attendees/ |
| GET | /api/attendees/export |
| POST | /api/attendees/ |
| POST | /api/attendees/bulk-upload |
| GET | /api/attendees/template |
| POST | /api/attendees/invite-by-ticket/:ticketId |
| POST | /api/attendees/:id/invite |
| PATCH | /api/attendees/:id/verify-photo |
| POST | /api/attendees/reject-photo |
| GET | /api/attendees/resubmit/:token |
| POST | /api/attendees/resubmit/photo |
| GET | /api/attendees/:id |
| POST | /api/attendees/:id/rfid |
| DELETE | /api/attendees/:id/rfid |
| PATCH | /api/attendees/:id |

## /api/rfid  (from \backend/src/routes/rfid.js)

| Method | Path |
|--------|------|
| GET | /api/rfid/inventory |
| POST | /api/rfid/inventory |
| POST | /api/rfid/inventory/bulk |
| POST | /api/rfid/assign |
| GET | /api/rfid/events/:eventId |
| POST | /api/rfid/events/:eventId/tags |
| POST | /api/rfid/events/:eventId/upload |
| DELETE | /api/rfid/events/:eventId/tags/:tagId |
| GET | /api/rfid/validate/:rfidTag |
| DELETE | /api/rfid/unassign/:rfidTag |
| GET | /api/rfid/assignment/:attendeeId |
| PATCH | /api/rfid/inventory/:rfidTag/disable |
| PATCH | /api/rfid/inventory/:rfidTag/enable |
| DELETE | /api/rfid/inventory/:rfidTag |

## /api/verification  (from \backend/src/routes/verification.js)

| Method | Path |
|--------|------|
| GET | /api/verification/pending |
| POST | /api/verification/approve |
| POST | /api/verification/reject |
| GET | /api/verification/stats |
| POST | /api/verification/cleanup-s3 |

## /api/tickets  (from \backend/src/routes/tickets.js)

| Method | Path |
|--------|------|
| POST | /api/tickets/assign |
| POST | /api/tickets/invite |
| POST | /api/tickets/:id/attendee |
| POST | /api/tickets/:id/invite |
| GET | /api/tickets/download/:token |
| GET | /api/tickets/order-download/:orderId |

## /api/invite  (from \backend/src/routes/invite.js)

| Method | Path |
|--------|------|
| GET | /api/invite/:token |
| POST | /api/invite/respond |
| POST | /api/invite/confirm |

## /api/sponsor  (from \backend/src/routes/sponsor.js)

| Method | Path |
|--------|------|
| GET | /api/sponsor/workspace |
| GET | /api/sponsor/team |
| POST | /api/sponsor/team |
| DELETE | /api/sponsor/team/:id |

## /api/entry  (from \backend/src/routes/entry.js)

| Method | Path |
|--------|------|
| POST | /api/entry/scan |
| GET | /api/entry/logs |
| GET | /api/entry/stats |
| GET | /api/entry/search |
| GET | /api/entry/attendee/:qrToken |
| GET | /api/entry/lookup |
| POST | /api/entry/checkin |
| POST | /api/entry/checkout |
| POST | /api/entry/receive-payment |
| POST | /api/entry/rfid-assign |
| GET | /api/entry/attendee-by-qr/:qrToken |
| GET | /api/entry/event-rfid-status/:eventId |

## /api/zone  (from \backend/src/routes/zone.js)

| Method | Path |
|--------|------|
| POST | /api/zone/scan |
| GET | /api/zone/logs |

## /api/dashboard  (from \backend/src/routes/dashboard.js)

| Method | Path |
|--------|------|
| GET | /api/dashboard/stats |
| GET | /api/dashboard/logs |
| GET | /api/dashboard/timeline |
| GET | /api/dashboard/denied |
| GET | /api/dashboard/export |
| GET | /api/dashboard/payments |

## /api/audit  (from \backend/src/routes/audit.js)

| Method | Path |
|--------|------|
| GET | /api/audit/logs |
| GET | /api/audit/reports |
| GET | /api/audit/export |
| GET | /api/audit/system-logs |

## /api/super-admin  (from \backend/src/routes/superAdmin.js)

| Method | Path |
|--------|------|
| GET | /api/super-admin/overview |
| GET | /api/super-admin/workspace |
| GET | /api/super-admin/search |
| POST | /api/super-admin/events |
| PATCH | /api/super-admin/events/:id |
| DELETE | /api/super-admin/events/:id |
| POST | /api/super-admin/organisers |
| PATCH | /api/super-admin/organisers/:id |
| DELETE | /api/super-admin/organisers/:id |
| POST | /api/super-admin/users |
| PATCH | /api/super-admin/users/:id |
| POST | /api/super-admin/users/:id/resend-credentials |
| DELETE | /api/super-admin/users/:id |
| PATCH | /api/super-admin/users/:id/status |
| POST | /api/super-admin/notifications/:id/resend |
| GET | /api/super-admin/reports/export |
| GET | /api/super-admin/settings |
| PATCH | /api/super-admin/settings |
| GET | /api/super-admin/logs |
| POST | /api/super-admin/companies |
| PATCH | /api/super-admin/companies/:id |
| DELETE | /api/super-admin/companies/:id |

## /api/user  (from \backend/src/routes/userPortal.js)

| Method | Path |
|--------|------|
| GET | /api/user/dashboard |
| GET | /api/user/events |
| GET | /api/user/tickets |
| GET | /api/user/ticket/:id |
| GET | /api/user/profile |
| PUT | /api/user/profile |
| GET | /api/user/notifications |
| PATCH | /api/user/notifications/:id/read |
| PATCH | /api/user/notifications/mark-all-read |
| DELETE | /api/user/notifications/:id |
| GET | /api/user/confirm/:token |
| POST | /api/user/confirm/:token |
| POST | /api/user/upload-photo |

## /api/short-links  (from \backend/src/routes/shortLinks.js)

| Method | Path |
|--------|------|
| GET | /api/short-links/:code |

## /api/organiser  (from \backend/src/routes/organiser.js)

| Method | Path |
|--------|------|
| GET | /api/organiser/workspace |
| GET | /api/organiser/attendees |
| POST | /api/organiser/attendees/bulk |
| PUT | /api/organiser/attendee/:id |
| DELETE | /api/organiser/attendee/:id |
| POST | /api/organiser/attendees/:id/invite |
| GET | /api/organiser/ticket-categories |
| POST | /api/organiser/ticket-categories |
| PUT | /api/organiser/ticket-categories/:categoryId |
| DELETE | /api/organiser/ticket-categories/:categoryId |
| GET | /api/organiser/sub-organisers |
| POST | /api/organiser/sub-organiser |
| PUT | /api/organiser/sub-organiser/:id |
| DELETE | /api/organiser/sub-organiser/:id |
| GET | /api/organiser/verification |
| POST | /api/organiser/verification/:attendeeId |
| GET | /api/organiser/invites |
| POST | /api/organiser/invites/:ticketId/resend |
| PATCH | /api/organiser/invites/:ticketId/cancel |
| GET | /api/organiser/event/:eventId/stats |
| GET | /api/organiser/event/:eventId/entry-logs |
| GET | /api/organiser/event/:eventId/zones/report |
| GET | /api/organiser/zones |
| POST | /api/organiser/zones |
| PUT | /api/organiser/zones/:zoneId |
| DELETE | /api/organiser/zones/:zoneId |
| PATCH | /api/organiser/zones/:zoneId/categories |
| GET | /api/organiser/notifications |
| POST | /api/organiser/notifications/:id/resend |
| PUT | /api/organiser/event-customization |
| GET | /api/organiser/settings |
| PUT | /api/organiser/settings |
| GET | /api/organiser/template |
| GET | /api/organiser/event/:eventId/export |
| GET | /api/organiser/sponsor-packages |
| POST | /api/organiser/sponsor-packages |
| PUT | /api/organiser/sponsor-packages/:packageId |
| DELETE | /api/organiser/sponsor-packages/:packageId |
| GET | /api/organiser/sponsors |
| POST | /api/organiser/sponsors |
| DELETE | /api/organiser/sponsors/:id |
| GET | /api/organiser/payments |

## /api/notifications  (from \backend/src/routes/notifications.js)

| Method | Path |
|--------|------|
| GET | /api/notifications/ |
| PATCH | /api/notifications/:id/read |
| PATCH | /api/notifications/mark-all-read |

## /api/buyer/payment-history  (from \backend/src/routes/buyerPaymentHistory.js)

| Method | Path |
|--------|------|
| GET | /api/buyer/payment-history/ |

## /api/buyer  (from \backend/src/routes/buyerRoutes.js)

| Method | Path |
|--------|------|
| GET | /api/buyer/orders |
| GET | /api/buyer/orders/:orderId |
| POST | /api/buyer/orders/:orderId/cancel |
| POST | /api/buyer/orders/:orderId/refund |
| GET | /api/buyer/tickets |
| GET | /api/buyer/invites |
| POST | /api/buyer/assign |
| POST | /api/buyer/tickets/:ticketId/assign-self |
| POST | /api/buyer/tickets/:ticketId/invite |
| POST | /api/buyer/tickets/:ticketId/resend-invite |

## /api/admin  (from \backend/src/routes/adminRoutes.js)

| Method | Path |
|--------|------|
| GET | /api/admin/workspace |
| GET | /api/admin/settings |
| PATCH | /api/admin/settings |
| GET | /api/admin/reports/export |
| GET | /api/admin/stats |
| GET | /api/admin/dashboard/stats |
| GET | /api/admin/events |
| POST | /api/admin/events |
| GET | /api/admin/events/:id |
| PATCH | /api/admin/events/:id |
| DELETE | /api/admin/events/:id |
| POST | /api/admin/events/:id/duplicate |
| GET | /api/admin/users |
| POST | /api/admin/users |
| PATCH | /api/admin/users/:id |
| GET | /api/admin/payments |

## /api/sub  (from \backend/src/routes/sub.js)

| Method | Path |
|--------|------|
| GET | /api/sub/dashboard |
| GET | /api/sub/zones |
| GET | /api/sub/attendees |
| GET | /api/sub/logs |
| POST | /api/sub/verify |
| POST | /api/sub/scan-entry |
| POST | /api/sub/scan-zone |
| POST | /api/sub/tickets |
| PATCH | /api/sub/tickets/:categoryId/regenerate |
| PATCH | /api/sub/tickets/:categoryId |
| DELETE | /api/sub/tickets/:categoryId |

## /api/staff  (from \backend/src/routes/staff.js)

| Method | Path |
|--------|------|
| POST | /api/staff/scan-entry |
| POST | /api/staff/scan-zone |
| GET | /api/staff/search |

## /api/payment  (from \backend/src/routes/payment.js)

| Method | Path |
|--------|------|
| GET | /api/payment/config/:eventId |
| POST | /api/payment/create-session |
| POST | /api/payment/stripe-webhook |
| POST | /api/payment/notify |
| POST | /api/payment/cash-reservation |
| GET | /api/payment/cash-instructions/:orderId |
| POST | /api/payment/cash-reservation/:orderId/info |
| POST | /api/payment/cash-confirm/:orderId |
| GET | /api/payment/cash-orders |

## /api/bank-transfer  (from \backend/src/routes/bankTransfer.js)

| Method | Path |
|--------|------|
| POST | /api/bank-transfer/order |
| GET | /api/bank-transfer/instructions/:orderIdOrToken |
| POST | /api/bank-transfer/submit/:orderIdOrToken |
| GET | /api/bank-transfer/payments |
| POST | /api/bank-transfer/payments/:submissionId/approve |
| POST | /api/bank-transfer/payments/:submissionId/reject |
| POST | /api/bank-transfer/payments/:submissionId/request-info |
| GET | /api/bank-transfer/receipt/:submissionId |
| GET | /api/bank-transfer/bank-accounts |
| POST | /api/bank-transfer/bank-accounts |
| PUT | /api/bank-transfer/bank-accounts/:accountId |
| DELETE | /api/bank-transfer/bank-accounts/:accountId |

## /api/payment-management  (from \backend/src/routes/paymentManagement.js)

| Method | Path |
|--------|------|
| GET | /api/payment-management/organizer |
| GET | /api/payment-management/organizer/statistics |
| GET | /api/payment-management/organizer/export |
| GET | /api/payment-management/organizer/:submissionId |
| POST | /api/payment-management/organizer/:submissionId/approve |
| POST | /api/payment-management/organizer/:submissionId/reject |
| POST | /api/payment-management/organizer/:submissionId/request-info |
| GET | /api/payment-management/admin |
| GET | /api/payment-management/admin/statistics |
| GET | /api/payment-management/admin/export |
| GET | /api/payment-management/admin/:submissionId |
| POST | /api/payment-management/admin/:submissionId/approve |
| POST | /api/payment-management/admin/:submissionId/reject |
| POST | /api/payment-management/admin/:submissionId/request-info |
| GET | /api/payment-management/super-admin/transactions |
| GET | /api/payment-management/super-admin/transactions/statistics |
| GET | /api/payment-management/super-admin/transactions/export |
| GET | /api/payment-management/super-admin/transactions/:transactionId |
| GET | /api/payment-management/super-admin/transactions/:transactionId/timeline |
| GET | /api/payment-management/super-admin/transactions/:transactionId/audit-log |

## /api/entrance  (from \backend/src/routes/entrance.js)

| Method | Path |
|--------|------|
| POST | /api/entrance/confirm/:orderId |

## /api/upload  (from \backend/src/routes/upload.js)

| Method | Path |
|--------|------|
| POST | /api/upload/profile-photo |
| POST | /api/upload/attendee-photo/:token |
| POST | /api/upload/system-asset |
| GET | /api/upload/file |

## /api/devices  (from \backend/src/routes/devices.js)

| Method | Path |
|--------|------|
| GET | /api/devices/ |
| POST | /api/devices/logout |
| GET | /api/devices/admin |
| PATCH | /api/devices/admin/:id/approve |
| PATCH | /api/devices/admin/:id/block |
| DELETE | /api/devices/admin/:id |
