import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './context/AuthContext';
import { useMaintenanceMode } from './context/MaintenanceModeContext';
import { hasAnyRole } from './utils/rbac';
import { getPublicConfig } from './api/events';

// Public pages
import HomePage from './pages/public/HomePage';
import EventsListingPage from './pages/public/EventsListingPage';
import EventDetailPage from './pages/public/EventDetailPage';
import CheckoutPage from './pages/public/CheckoutPage';
import CashEntranceInstructionsPage from './pages/buyer/CashEntranceInstructionsPage';
import OrderConfirmationPage from './pages/public/OrderConfirmationPage';
import AttendeeIdentityConfirmPage from './pages/public/AttendeeIdentityConfirmPage';
import MaintenancePage from './pages/public/MaintenancePage';

// Auth
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import SignupSuccessPage from './pages/auth/SignupSuccessPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import VerifyEmailPage from './pages/auth/VerifyEmailPage';
import ChangeTempPasswordPage from './pages/auth/ChangeTempPasswordPage';
import PasswordChangePage from './pages/auth/PasswordChangePage';
import MfaSetupPage from './pages/auth/MfaSetupPage';
import Dashboard from './pages/Dashboard';
import UserDashboardPage from './pages/enhanced/UserDashboardPage';

// Buyer
import AttendeeConfirmPage from './pages/buyer/AttendeeConfirmPage';
import InviteAcceptPage from './pages/buyer/InviteAcceptPage';
import BuyerDashboardPage from './pages/buyer/BuyerDashboardPage';
import BuyerOrderDetailsPage from './pages/buyer/BuyerOrderDetailsPage';
import BuyerHomePage from './pages/buyer/BuyerHomePage';
import BuyerTicketsPage from './pages/buyer/BuyerTicketsPage';
import BuyerInvitesPage from './pages/buyer/BuyerInvitesPage';
import BuyerProfilePage from './pages/buyer/BuyerProfilePage';
import BuyerOrderHistoryPage from './pages/buyer/BuyerOrderHistoryPage';
import BuyerPaymentHistoryPage from './pages/buyer/BuyerPaymentHistoryPage';
import BuyerConfirmPassPage from './pages/buyer/BuyerConfirmPassPage';
import BankTransferInstructionsPage from './pages/buyer/BankTransferInstructionsPage';
import BankTransferSubmitPage from './pages/buyer/BankTransferSubmitPage';
import BankTransferThankYouPage from './pages/buyer/BankTransferThankYouPage';
import AttendeeDashboardPage from './pages/attendee/AttendeeDashboardPage';
import AttendeeTicketsPage from './pages/attendee/AttendeeTicketsPage';
import AttendeeTicketViewPage from './pages/attendee/AttendeeTicketViewPage';
import AttendeeConfirmationPage from './pages/attendee/AttendeeConfirmationPage';
import AttendeeEventsPage from './pages/attendee/AttendeeEventsPage';
import AttendeeProfilePage from './pages/attendee/AttendeeProfilePage';
import AttendeeNotificationsPage from './pages/attendee/AttendeeNotificationsPage';
import ResubmitPhotoPage from './pages/attendee/ResubmitPhotoPage';
import TicketWalletPage from './pages/buyer/TicketWalletPage';
import ResubmitPage from './pages/buyer/ResubmitPage';

// Admin
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminPaymentManagement from './pages/admin/AdminPaymentManagement';
import HardwarePage from './pages/admin/HardwarePage';
import AdminRfidInventoryPage from './pages/admin/AdminRfidInventoryPage';
import AdminRfidAssignmentsPage from './pages/admin/AdminRfidAssignmentsPage';
import AdminRfidAccessLogsPage from './pages/admin/AdminRfidAccessLogsPage';

// Organiser
import OrganiserDashboard from './pages/organiser/OrganiserDashboard';
import EntryLogsPage from './pages/organiser/EntryLogsPage';

// Sub-organiser
import SubOrgDashboard from './pages/suborg/SubOrgDashboard';
import SubOrgZonesPage from './pages/suborg/SubOrgZonesPage';
import SubOrgAttendees from './pages/suborg/SubOrgAttendees';
import SubOrgVerificationPage from './pages/suborg/SubOrgVerificationPage';
import SubOrgEntryScannerPage from './pages/suborg/SubOrgEntryScannerPage';
import SubOrgZoneScannerPage from './pages/suborg/SubOrgZoneScannerPage';
import SubOrgActivityLogsPage from './pages/suborg/SubOrgActivityLogsPage';
import SubOrgTeam from './pages/suborg/SubOrgTeam';
import SubOrgTickets from './pages/suborg/SubOrgTickets';
import BulkUploadPage from './pages/suborg/BulkUploadPage';
import SubOrgZoneManualSearchPage from './pages/suborg/SubOrgZoneManualSearchPage';
import SubOrgPayments from './pages/suborg/SubOrgPayments';
import SubOrgRfidAssignmentPage from './pages/suborg/SubOrgRfidAssignmentPage';
import SubOrgManualSearchPage from './pages/suborg/SubOrgManualSearchPage';
import EventEditPage from './pages/shared/EventEditPage';

// Entry
import EntryScannerPage from './pages/entry/EntryScannerPage';
import ZoneScannerPage from './pages/entry/ZoneScannerPage';
import StaffScanPage from './pages/staff/StaffScanPage';
import StaffZoneAccessPage from './pages/staff/StaffZoneAccessPage';
import StaffManualSearchPage from './pages/staff/StaffManualSearchPage';
import StaffZoneManualSearchPage from './pages/staff/StaffZoneManualSearchPage';
import StaffActivityLogPage from './pages/staff/StaffActivityLogPage';
import StaffDashboardPage from './pages/staff/StaffDashboardPage';
import StaffCashCollectionPage from './pages/staff/StaffCashCollectionPage';
import RfidAssignmentPage from './pages/staff/RfidAssignmentPage';

// Auditor
import AuditorDashboard from './pages/auditor/AuditorDashboard';
import AuditorLogsPage from './pages/auditor/AuditorLogsPage';
import AuditorSystemLogsPage from './pages/auditor/AuditorSystemLogsPage';
import AuditorReportsPage from './pages/auditor/AuditorReportsPage';
import SponsorDashboard from './pages/sponsor/SponsorDashboard';

// Shared real-time dashboard + reports
import LiveDashboard from './pages/shared/LiveDashboard';
import ReportsDashboard from './pages/shared/ReportsDashboard';

// 404
import NotFoundPage from './pages/NotFoundPage';
import ShortLinkRedirectPage from './pages/public/ShortLinkRedirectPage';

// Protected route wrapper
const Protected = ({ children, roles, redirectTo = '/login' }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"/>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !hasAnyRole(user.role, roles)) return <Navigate to={redirectTo} replace />;
  return children;
};

const AppRoutes = () => (
  <Routes>
    {/* Public */}
    <Route path="/" element={<HomePage />} />
    <Route path="/events" element={<EventsListingPage />} />
    <Route path="/events/:id" element={<EventDetailPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/signup" element={<SignupPage />} />
    <Route path="/signup-success" element={<SignupSuccessPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
    <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
    <Route path="/change-password" element={<ChangeTempPasswordPage />} />
    <Route path="/settings/security" element={<Protected redirectTo="/dashboard"><PasswordChangePage /></Protected>} />
    <Route path="/settings/mfa" element={<Protected redirectTo="/dashboard"><MfaSetupPage /></Protected>} />

    {/* Buyer confirmation flow - public links from email */}
    <Route path="/confirm/:inviteToken" element={<AttendeeIdentityConfirmPage />} />
    <Route path="/invite/:token" element={<InviteAcceptPage />} />
    <Route path="/resubmit/:token" element={<ResubmitPage />} />
    <Route path="/maintenance" element={<MaintenancePage />} />

    {/* Orders & Checkout */}
    <Route path="/checkout" element={<CheckoutPage />} />
    <Route path="/cash-entrance/instructions/:confirmationToken" element={<CashEntranceInstructionsPage />} />
    <Route path="/order/:token/confirm" element={<OrderConfirmationPage />} />

    <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
    <Route path="/dashboard/enhanced" element={<Protected><UserDashboardPage /></Protected>} />
    <Route path="/buyer/dashboard" element={<Protected roles={['BUYER']}><BuyerDashboardPage /></Protected>} />
    <Route path="/buyer/home" element={<Protected roles={['BUYER']}><BuyerHomePage /></Protected>} />
    <Route path="/buyer/tickets" element={<Protected roles={['BUYER']}><BuyerTicketsPage /></Protected>} />
    <Route path="/buyer/confirm/:ticketId" element={<Protected roles={['BUYER']}><BuyerConfirmPassPage /></Protected>} />
    <Route path="/bank-transfer/instructions/:orderId" element={<BankTransferInstructionsPage />} />
    <Route path="/bank-transfer/submit/:orderId" element={<BankTransferSubmitPage />} />
    <Route path="/bank-transfer/thank-you/:orderId" element={<BankTransferThankYouPage />} />
    <Route path="/buyer/assign/:orderId" element={<Protected roles={['BUYER']}><BuyerOrderDetailsPage /></Protected>} />
    <Route path="/buyer/orders/:orderId" element={<Protected roles={['BUYER']}><BuyerOrderDetailsPage /></Protected>} />
    <Route path="/buyer/payment-history" element={<Protected roles={['BUYER']}><BuyerPaymentHistoryPage /></Protected>} />
    <Route path="/buyer/invites" element={<Protected roles={['BUYER']}><BuyerInvitesPage /></Protected>} />
    <Route path="/buyer/profile" element={<Protected roles={['BUYER']}><BuyerProfilePage /></Protected>} />
    <Route path="/buyer/orders" element={<Protected roles={['BUYER']}><BuyerOrderHistoryPage /></Protected>} />
    <Route path="/attendee/dashboard" element={<Protected roles={['BUYER']}><AttendeeDashboardPage /></Protected>} />
                <Route path="/attendee/tickets" element={<Protected roles={['BUYER']}><AttendeeTicketsPage /></Protected>} />
                <Route path="/attendee/ticket/:ticketId" element={<Protected roles={['BUYER']}><AttendeeTicketViewPage /></Protected>} />
                <Route path="/attendee/events" element={<Protected roles={['BUYER']}><AttendeeEventsPage /></Protected>} />
                <Route path="/attendee/profile" element={<Protected roles={['BUYER']}><AttendeeProfilePage /></Protected>} />
                <Route path="/attendee/notifications" element={<Protected roles={['BUYER']}><AttendeeNotificationsPage /></Protected>} />
    <Route path="/attendee/resubmit-photo/:token" element={<ResubmitPhotoPage />} />
    <Route path="/ticket/:token" element={<TicketWalletPage />} />
    <Route path="/t/:code" element={<ShortLinkRedirectPage />} />

    {/* Admin */}
    <Route path="/admin/dashboard" element={<Protected roles={['MainAdmin']} redirectTo="/dashboard"><AdminDashboard /></Protected>} />
    <Route path="/admin/live"      element={<Protected roles={['MainAdmin']} redirectTo="/dashboard"><LiveDashboard /></Protected>} />
    <Route path="/admin/events" element={<Protected roles={['MainAdmin']} redirectTo="/dashboard"><Navigate to="/admin/dashboard?section=events" replace /></Protected>} />
    <Route path="/admin/events/new" element={<Protected roles={['MainAdmin']} redirectTo="/dashboard"><Navigate to="/admin/dashboard?section=events" replace /></Protected>} />
    <Route path="/admin/events/:id/edit" element={<Protected roles={['MainAdmin']} redirectTo="/dashboard"><Navigate to="/admin/dashboard?section=events" replace /></Protected>} />
    <Route path="/admin/hardware" element={<Protected roles={['MainAdmin','MainOrganiser']}><HardwarePage /></Protected>} />
    <Route path="/admin/rfid" element={<Protected roles={['MainAdmin','MainOrganiser']}><AdminRfidInventoryPage /></Protected>} />
    <Route path="/admin/rfid-assignments" element={<Protected roles={['MainAdmin','MainOrganiser']}><AdminRfidAssignmentsPage /></Protected>} />
    <Route path="/admin/rfid-access-logs" element={<Protected roles={['MainAdmin','MainOrganiser']}><AdminRfidAccessLogsPage /></Protected>} />
    <Route path="/admin/users" element={<Protected roles={['MainAdmin']} redirectTo="/dashboard"><Navigate to="/admin/dashboard?section=users" replace /></Protected>} />
    <Route path="/admin/settings" element={<Protected roles={['MainAdmin']} redirectTo="/dashboard"><Navigate to="/admin/dashboard?section=settings" replace /></Protected>} />
    <Route path="/admin/reports" element={<Protected roles={['MainAdmin']} redirectTo="/dashboard"><Navigate to="/admin/dashboard?section=reports" replace /></Protected>} />
    <Route path="/admin/verification" element={<Protected roles={['MainAdmin']} redirectTo="/dashboard"><Navigate to="/admin/dashboard?section=verification" replace /></Protected>} />
    <Route path="/admin/payments" element={<Protected roles={['MainAdmin']} redirectTo="/dashboard"><Navigate to="/admin/dashboard?section=payments" replace /></Protected>} />

    {/* Main Organiser */}
    <Route path="/organiser/dashboard" element={<Protected roles={['MainOrganiser']} redirectTo="/dashboard"><OrganiserDashboard /></Protected>} />
    <Route path="/organiser/live"      element={<Protected roles={['MainOrganiser']} redirectTo="/dashboard"><LiveDashboard /></Protected>} />
    <Route path="/organiser/events" element={<Protected roles={['MainOrganiser']} redirectTo="/dashboard"><OrganiserDashboard /></Protected>} />
    <Route path="/organiser/events/:id" element={<Protected roles={['MainOrganiser']} redirectTo="/dashboard"><EventEditPage /></Protected>} />
    <Route path="/organiser/attendees" element={<Protected roles={['MainOrganiser']} redirectTo="/dashboard"><OrganiserDashboard /></Protected>} />
    <Route path="/organiser/team" element={<Protected roles={['MainOrganiser']} redirectTo="/dashboard"><OrganiserDashboard /></Protected>} />
    <Route path="/organiser/suborganisers" element={<Protected roles={['MainOrganiser']} redirectTo="/dashboard"><OrganiserDashboard /></Protected>} />
    <Route path="/organiser/entry-logs" element={<Protected roles={['MainOrganiser']} redirectTo="/dashboard"><OrganiserDashboard /></Protected>} />
    <Route path="/organiser/reports" element={<Protected roles={['MainOrganiser']} redirectTo="/dashboard"><OrganiserDashboard /></Protected>} />
    <Route path="/organiser/settings" element={<Protected roles={['MainOrganiser']} redirectTo="/dashboard"><OrganiserDashboard /></Protected>} />
    <Route path="/organiser/upload" element={<Protected roles={['MainOrganiser']} redirectTo="/dashboard"><BulkUploadPage /></Protected>} />

    {/* Sub-Organiser */}
    <Route path="/suborg/dashboard" element={<Protected roles={['SubOrganiser']}><SubOrgDashboard /></Protected>} />
    <Route path="/suborg/zones" element={<Protected roles={['SubOrganiser']}><SubOrgZonesPage /></Protected>} />
    <Route path="/suborg/attendees" element={<Protected roles={['SubOrganiser']}><SubOrgAttendees /></Protected>} />
    <Route path="/suborg/verification" element={<Protected roles={['SubOrganiser']}><SubOrgVerificationPage /></Protected>} />
    <Route path="/suborg/entry" element={<Protected roles={['SubOrganiser', 'Staff']}><SubOrgEntryScannerPage /></Protected>} />
    <Route path="/suborg/zone-scan" element={<Protected roles={['SubOrganiser', 'Staff']}><SubOrgZoneScannerPage /></Protected>} />
    <Route path="/suborg/zone-search" element={<Protected roles={['SubOrganiser', 'Staff']}><SubOrgZoneManualSearchPage /></Protected>} />
    <Route path="/suborg/logs" element={<Protected roles={['SubOrganiser']}><SubOrgActivityLogsPage /></Protected>} />
    <Route path="/suborg/team" element={<Protected roles={['SubOrganiser']}><SubOrgTeam /></Protected>} />
    <Route path="/suborg/tickets" element={<Protected roles={['SubOrganiser']}><SubOrgTickets /></Protected>} />
    <Route path="/suborg/payments" element={<Protected roles={['SubOrganiser']}><SubOrgPayments /></Protected>} />
    <Route path="/suborg/rfid-assign" element={<Protected roles={['SubOrganiser']}><SubOrgRfidAssignmentPage /></Protected>} />
    <Route path="/suborg/manual-search" element={<Protected roles={['SubOrganiser', 'Staff']}><SubOrgManualSearchPage /></Protected>} />
    <Route path="/suborg/upload" element={<Protected roles={['SubOrganiser']}><BulkUploadPage /></Protected>} />
    <Route path="/suborg/verify" element={<Protected roles={['SubOrganiser']}><Navigate to="/suborg/verification" replace /></Protected>} />
    <Route path="/suborganiser/verify-photos" element={<Protected roles={['SubOrganiser','MainOrganiser','MainAdmin']}><SubOrgVerificationPage /></Protected>} />

    {/* Entry / Staff */}
    <Route path="/staff/dashboard" element={<Protected roles={['Staff', 'Volunteer']}><StaffDashboardPage /></Protected>} />
    <Route path="/staff/scan" element={<Protected roles={['Staff', 'Volunteer']}><StaffScanPage /></Protected>} />
    <Route path="/staff/zone-access" element={<Protected roles={['Staff', 'Volunteer']}><StaffZoneAccessPage /></Protected>} />
    <Route path="/staff/search" element={<Protected roles={['Staff', 'Volunteer']}><StaffManualSearchPage /></Protected>} />
    <Route path="/staff/zone-search" element={<Protected roles={['Staff', 'Volunteer']}><StaffZoneManualSearchPage /></Protected>} />
    <Route path="/staff/activity" element={<Protected roles={['Staff', 'Volunteer']}><StaffActivityLogPage /></Protected>} />
    <Route path="/staff/verification" element={<Protected roles={['Staff', 'Volunteer']}><SubOrgVerificationPage /></Protected>} />
    <Route path="/staff/upload" element={<Protected roles={['Staff', 'Volunteer']}><BulkUploadPage /></Protected>} />
    <Route path="/staff/cash-collection" element={<Protected roles={['MainAdmin','MainOrganiser','SubOrganiser','Staff','Volunteer']}><StaffCashCollectionPage /></Protected>} />
    <Route path="/staff/rfid-assign" element={<Protected roles={['Staff', 'Volunteer']}><RfidAssignmentPage /></Protected>} />
    <Route path="/entry" element={<Protected roles={['MainAdmin','MainOrganiser','SubOrganiser','Staff','Volunteer']}><EntryScannerPage /></Protected>} />
    <Route path="/entry-scan" element={<Protected roles={['MainAdmin','MainOrganiser','SubOrganiser','Staff','Volunteer']}><EntryScannerPage /></Protected>} />
    <Route path="/zone-scan" element={<Protected roles={['MainAdmin','MainOrganiser','SubOrganiser','Staff','Volunteer']}><ZoneScannerPage /></Protected>} />
    <Route path="/entry/logs" element={<Protected roles={['MainAdmin','MainOrganiser','Staff', 'Volunteer']}><EntryLogsPage /></Protected>} />

    {/* Auditor */}
    <Route path="/auditor/dashboard" element={<Protected roles={['Auditor']}><AuditorDashboard /></Protected>} />
    <Route path="/auditor/reports"   element={<Protected roles={['Auditor']}><AuditorReportsPage /></Protected>} />
    <Route path="/auditor/logs"      element={<Protected roles={['Auditor']}><AuditorLogsPage /></Protected>} />
    <Route path="/auditor/system-logs" element={<Protected roles={['Auditor']}><AuditorSystemLogsPage /></Protected>} />

    {/* Sponsor */}
    <Route path="/sponsor/dashboard" element={<Protected roles={['Sponsor']}><SponsorDashboard /></Protected>} />

    <Route path="*" element={<NotFoundPage />} />
  </Routes>
);
const App = () => {
  const { user, loading: authLoading, isAdmin, isOrganiser, isSubOrg, isStaff, isAuditor } = useAuth();
  const { maintenanceMode, loading: maintenanceLoading } = useMaintenanceMode();
  const [sysConfig, setSysConfig] = useState({ maintenanceMode: false, currency: 'LKR' });
  const [configLoading, setConfigLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await getPublicConfig();
        if (res.data?.success) {
          setSysConfig(res.data.data);
        }
      } catch (err) {
        console.error('Config fetch failed:', err);
      } finally {
        setConfigLoading(false);
      }
    };
    fetchConfig();

    const handleUnhandledRejection = (event) => {
      if (event?.reason?.response?.status === 403) {
        event.preventDefault();
        return;
      }
      console.error('Unhandled promise rejection:', event.reason);
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  }, []);

  if (authLoading || configLoading || maintenanceLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"/>
      </div>
    );
  }

  // Use the maintenanceMode from context
  const isInMaintenance = maintenanceMode;
  
  // Bypass maintenance mode for all authenticated internal roles
  const canBypassMaintenance = isAdmin || isOrganiser || isSubOrg || isStaff || isAuditor;

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Toaster position="top-right" toastOptions={{ duration: 3500, style: { fontSize: '14px' } }} />
      {isInMaintenance && !canBypassMaintenance ? (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<MaintenancePage />} />
        </Routes>
      ) : (
        <AppRoutes />
      )}
    </BrowserRouter>
  );
};

export default App;
