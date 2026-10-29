import {
  HomeIcon,
  TicketIcon,
  UsersIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  UserGroupIcon,
  ClipboardDocumentListIcon,
  GlobeAltIcon,
  ArrowLeftOnRectangleIcon,
  ArrowUpTrayIcon,
  CheckBadgeIcon,
  SignalIcon,
  BuildingOffice2Icon,
  StarIcon,
  BanknotesIcon,
  IdentificationIcon,
} from '@heroicons/react/24/solid';
import { getCanonicalRole } from '../utils/rbac';

export const ROLE_NAVIGATION = {
  MainAdmin: {
    sections: [
      {
        title: 'Super Admin',
        items: [
          { to: '/admin/dashboard', label: 'Overview', icon: HomeIcon },
          { to: '/admin/live', label: 'Live Stream', icon: SignalIcon },
          { to: '/admin/dashboard?section=events', label: 'Events', icon: TicketIcon },
          { to: '/admin/dashboard?section=rfid', label: 'RFID Inventory', icon: IdentificationIcon },
          { to: '/admin/dashboard?section=organisations', label: 'Organizations', icon: BuildingOffice2Icon },
          { to: '/admin/dashboard?section=organisers', label: 'Organisers', icon: UserGroupIcon },
          { to: '/admin/dashboard?section=users', label: 'Users', icon: UsersIcon },
          { to: '/admin/dashboard?section=tickets', label: 'Tickets', icon: ClipboardDocumentListIcon },
          { to: '/admin/dashboard?section=bank-accounts', label: 'Bank Accounts', icon: BanknotesIcon },
          { to: '/admin/dashboard?section=payments', label: 'Payments', icon: BanknotesIcon },
          { to: '/admin/dashboard?section=verification', label: 'Verification', icon: CheckBadgeIcon },
          { to: '/admin/dashboard?section=entry-logs', label: 'Entry Logs', icon: ClipboardDocumentListIcon },
          { to: '/admin/dashboard?section=zone-activity', label: 'Zone Activity', icon: ShieldCheckIcon },
          { to: '/admin/dashboard?section=notifications', label: 'Notifications', icon: GlobeAltIcon },
          { to: '/admin/dashboard?section=system-logs', label: 'System Logs', icon: ClipboardDocumentListIcon },
          { to: '/admin/dashboard?section=reports', label: 'Reports', icon: ChartBarIcon },
          
        ],
      },
    ],
  },
  MainOrganiser: {
    sections: [
      {
        title: 'Event Control',
        items: [
          { to: '/organiser/dashboard', label: 'Overview', icon: HomeIcon },
          { to: '/organiser/live', label: 'Live Stream', icon: SignalIcon },
          { to: '/organiser/dashboard?section=customization', label: 'Event Customization', icon: ArrowUpTrayIcon },
          { to: '/organiser/dashboard?section=attendees', label: 'Attendees', icon: UserGroupIcon },
          { to: '/organiser/dashboard?section=tickets', label: 'Tickets', icon: TicketIcon },
          { to: '/organiser/dashboard?section=payments', label: 'Payments', icon: BanknotesIcon },
          { to: '/organiser/dashboard?section=zones', label: 'Zones & Areas', icon: ShieldCheckIcon },
          { to: '/organiser/dashboard?section=suborganisers', label: 'Team Management', icon: UsersIcon },
          { to: '/organiser/dashboard?section=sponsor-packages', label: 'Sponsor Packages', icon: ClipboardDocumentListIcon },
          { to: '/organiser/dashboard?section=sponsors', label: 'Manage Sponsors', icon: StarIcon },
          { to: '/organiser/dashboard?section=invites', label: 'Invites', icon: GlobeAltIcon },
          { to: '/organiser/upload', label: 'Bulk Upload', icon: ArrowUpTrayIcon },
          { to: '/organiser/dashboard?section=verification', label: 'Verification', icon: CheckBadgeIcon },
          { to: '/organiser/dashboard?section=logs', label: 'Access Logs', icon: ClipboardDocumentListIcon },
          { to: '/organiser/dashboard?section=rfid-assignments', label: 'RFID Assignments', icon: IdentificationIcon },
          { to: '/organiser/dashboard?section=system-logs', label: 'Activity Logs', icon: ClipboardDocumentListIcon },
          { to: '/organiser/dashboard?section=reports', label: 'Reports', icon: ChartBarIcon },
          { to: '/organiser/dashboard?section=notifications', label: 'Notifications', icon: GlobeAltIcon },
          
        ],
      },
    ],
  },
  SubOrganiser: {
    sections: [
      {
        title: 'Worklist',
        items: [
          { to: '/suborg/dashboard', label: 'Overview', icon: HomeIcon },
          { to: '/suborg/zones', label: 'My Zones', icon: ShieldCheckIcon },
          { to: '/suborg/tickets', label: 'Tickets', icon: TicketIcon },
          { to: '/suborg/payments', label: 'Payments', icon: BanknotesIcon },
          { to: '/suborg/attendees', label: 'Attendees', icon: UserGroupIcon },
          { to: '/suborg/team', label: 'Team Management', icon: UsersIcon },
          { to: '/suborg/verification', label: 'Verification', icon: CheckBadgeIcon },
        ],
      },
      {
        title: 'Operations',
        items: [
          { to: '/suborg/zone-scan', label: 'Zone Scanner', icon: ShieldCheckIcon },
          { to: '/suborg/rfid-assign', label: 'RFID Assignment', icon: IdentificationIcon },
          { to: '/suborg/manual-search', label: 'Manual Search', icon: UserGroupIcon },
          { to: '/suborg/zone-search', label: 'Zone Manual Search', icon: UserGroupIcon },
          { to: '/suborg/upload', label: 'Bulk Upload', icon: ArrowUpTrayIcon },
          { to: '/suborg/logs', label: 'Activity Logs', icon: ClipboardDocumentListIcon },
        ],
      },
    ],
  },
  Staff: {
    sections: [
      {
        title: 'Operations',
        items: [
          { to: '/staff/dashboard', label: 'Overview', icon: HomeIcon },
          { to: '/staff/scan', label: 'Scan Entry', icon: MagnifyingGlassIcon },
          { to: '/staff/rfid-assign', label: 'RFID Assignment', icon: IdentificationIcon },
          { to: '/staff/search', label: 'Manual Search', icon: UserGroupIcon },
          { to: '/staff/zone-access', label: 'Zone Access', icon: ShieldCheckIcon },
          { to: '/staff/zone-search', label: 'Zone Manual Search', icon: UserGroupIcon },
          { to: '/staff/verification', label: 'Verification', icon: CheckBadgeIcon },
          { to: '/staff/cash-collection', label: 'Cash Collection', icon: BanknotesIcon },
          { to: '/staff/upload', label: 'Bulk Upload', icon: ArrowUpTrayIcon },
          { to: '/staff/activity', label: 'Activity Log', icon: ClipboardDocumentListIcon },
        ],
      },
    ],
  },
  Volunteer: {
    sections: [
      {
        title: 'Operations',
        items: [
          { to: '/staff/dashboard', label: 'Overview', icon: HomeIcon },
          { to: '/staff/scan', label: 'Scan Entry', icon: MagnifyingGlassIcon },
          { to: '/staff/zone-access', label: 'Zone Access', icon: ShieldCheckIcon },
          { to: '/staff/cash-collection', label: 'Cash Collection', icon: BanknotesIcon },
          { to: '/staff/activity', label: 'Activity Log', icon: ClipboardDocumentListIcon },
        ],
      },
    ],
  },
  Auditor: {
    sections: [
      {
        title: 'Audit',
        items: [
          { to: '/auditor/dashboard', label: 'Dashboard', icon: HomeIcon },
          { to: '/auditor/reports', label: 'Reports', icon: ChartBarIcon },
          { to: '/auditor/logs', label: 'Entry Logs', icon: ClipboardDocumentListIcon },
          { to: '/auditor/system-logs', label: 'System Logs', icon: ClipboardDocumentListIcon },
        ],
      },
    ],
  },
  Sponsor: {
    sections: [
      {
        title: 'Sponsor Portal',
        items: [
          { to: '/sponsor/dashboard', label: 'Overview', icon: HomeIcon },
          { to: '/sponsor/dashboard?section=team', label: 'Team Members', icon: UserGroupIcon },
        ],
      },
    ],
  },
};

export const ROLE_LABELS = {
  MainAdmin: 'Super Admin',
  MainOrganiser: 'Main Organiser',
  SubOrganiser: 'Sub Organiser',
  Staff: 'Staff',
  Volunteer: 'Volunteer',
  Auditor: 'Auditor',
  Sponsor: 'Sponsor',
  Attendee: 'Buyer',
};

export const ROLE_COLORS = {
  MainAdmin: 'bg-teal-100 text-teal-700',
  MainOrganiser: 'bg-teal-100 text-teal-700',
  SubOrganiser: 'bg-teal-100 text-teal-700',
  Staff: 'bg-cyan-100 text-cyan-700',
  Volunteer: 'bg-teal-100 text-teal-700',
  Auditor: 'bg-amber-100 text-amber-700',
  Sponsor: 'bg-yellow-100 text-yellow-700',
  Attendee: 'bg-slate-100 text-slate-700',
};

export const PUBLIC_DASHBOARD_PATH = {
  MainAdmin: '/admin/dashboard',
  MainOrganiser: '/organiser/dashboard',
  SubOrganiser: '/suborg/dashboard',
  Staff: '/staff/dashboard',
  Volunteer: '/staff/dashboard',
  Auditor: '/auditor/dashboard',
  // BUYER role normalizes to Attendee; send them to the mobile user portal
  Sponsor: '/sponsor/dashboard',
  Attendee: '/buyer/home',
};

export const getRoleLabel = (role) => ROLE_LABELS[getCanonicalRole(role)] || getCanonicalRole(role);
export const getRoleColor = (role) => ROLE_COLORS[getCanonicalRole(role)] || 'bg-slate-100 text-slate-700';
export const getDashboardPathForRole = (role) => PUBLIC_DASHBOARD_PATH[getCanonicalRole(role)] || '/';

export const PUBLIC_NAV_ITEMS = [
  { to: '/', label: 'Public Site', icon: GlobeAltIcon },
  { to: '/login', label: 'Logout', icon: ArrowLeftOnRectangleIcon },
];
