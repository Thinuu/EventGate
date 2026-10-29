import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { io } from '../../utils/realtime';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { getSocketUrl, getAssetUrl } from '../../utils/backend';
import { formatDistanceToNow } from 'date-fns';
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import toast from 'react-hot-toast';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card, { CardHeader } from '../../components/ui/Card';
import { Table, Th, Td, Tr } from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import LoadingSkeleton from '../../components/shared/LoadingSkeleton';
import PermissionGuard from '../../components/auth/PermissionGuard';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { getMyEvents } from '../../api/events';
import {
  getOrganiserWorkspace,
  updateOrganiserAttendee,
  deleteOrganiserAttendee,
  inviteOrganiserAttendee,
  uploadOrganiserBulk,
  downloadOrganiserTemplate,
  createTicketCategory,
  updateTicketCategory,
  deleteTicketCategory,
  createSubOrganiser,
  updateSubOrganiser,
  deleteSubOrganiser,
  updateVerificationStatus,
  resendInvite,
  cancelInvite,
  createZone,
  updateZone,
  deleteZone,
  assignZoneCategories,
  exportOrganiserEventData,
  resendOrganiserNotification,
  updateOrganiserSettings,
  updateOrganiserEventCustomization,
  createSponsorPackage,
  updateSponsorPackage,
  deleteSponsorPackage,
  createSponsor,
  deleteSponsor,
} from '../../api/organiser';
import { getEventRfidStatus } from '../../api/entry';
import PaymentsDashboard from './PaymentsDashboard';
import RfidAssignmentView from '../../components/organiser/RfidAssignmentView';
import { TicketIcon, FireIcon, BanknotesIcon, CheckBadgeIcon, UsersIcon, MapPinIcon, TrashIcon, ChartBarIcon, ClockIcon, UserGroupIcon, CurrencyDollarIcon, ChartPieIcon, DocumentIcon, ArrowDownTrayIcon, ArrowPathIcon, ArrowUpTrayIcon, IdentificationIcon, QrCodeIcon } from '@heroicons/react/24/outline';

const statusColor = {
  pending: 'amber', confirmed: 'green', rejected: 'red', invited: 'blue',
  verified: 'green', PENDING: 'amber', ACCEPTED: 'green', DECLINED: 'red',
};

const emptyAttendee = { fullName: '', email: '', phone: '', nationalId: '', categoryId: '', notes: '' };
const emptyCategory = {
  name: '', description: '', price: 0, capacity: 0, allowedZones: [], benefits: [],
  isPrivate: false, maxUsage: null, assignedSubOrganisers: [], isVisible: true,
};
const emptySubOrg = {
  name: '', email: '', phone: '', password: '', role: 'SubOrganiser',
  permissions: {
    canEntryAccess: false,
    canScanZones: false,
    canAddAttendees: true,
    canVerifyPhotos: true,
    canBulkUpload: false,
    canInviteAttendees: true,
    canCollectCash: false,
  },
  assignedZones: [],
  assignedGates: [],
  assignedCategories: [],
};
const emptyZone = { name: '', description: '', capacity: 0, color: '#2563eb' };
const emptySponsorPackage = {
  name: '', level: 'Custom', description: '', capacity: 1, price: 0,
  benefits: [], contactNumber: '', isVisible: true, expiryDate: '',
};
const emptySponsor = {
  companyName: '', contactPerson: '', email: '', phone: '', packageId: '', notes: '',
};

const COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];
const getEventObjectId = (event) => event?._id || event?.id || '';

const downloadBlob = (blob, fileName) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const clampPage = (value, pages = 1) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return 1;
  return Math.min(Math.max(parsed, 1), Math.max(pages, 1));
};

const MetricCard = ({ title, value, subtitle, icon: Icon }) => (
  <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</p>
        <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl truncate">{value}</p>
        {subtitle && <p className="mt-1.5 text-xs text-slate-500 truncate">{subtitle}</p>}
      </div>
      {Icon && (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
          <Icon className="h-5 w-5" />
        </div>
      )}
    </div>
  </Card>
);

const Field = ({ label, children }) => (
  <label className="space-y-2">
    <span className="text-sm font-medium text-slate-700">{label}</span>
    {children}
  </label>
);

const Input = (props) => (
  <input
    {...props}
    className={`w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 ${props.className || ''}`}
  />
);

const Select = (props) => (
  <select
    {...props}
    className={`w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed disabled:pointer-events-none ${props.className || ''}`}
  />
);

const Pagination = ({ page = 1, pages = 1, total, pageKey = 'page', updateQuery }) => {
  if (!pages || pages <= 1) return null;
  const currentPage = clampPage(page, pages);
  const visiblePages = [];
  const maxVisible = 5;
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(pages, start + maxVisible - 1);
  if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
  for (let i = start; i <= end; i += 1) visiblePages.push(i);

  return (
    <div className="mt-auto flex flex-col gap-3 border-t border-slate-100 bg-slate-50/40 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" disabled={currentPage <= 1}
          onClick={() => updateQuery(pageKey, currentPage - 1)} className="h-8 rounded-lg px-3 text-xs">Prev</Button>
        <div className="mx-1 flex items-center gap-1">
          {visiblePages.map((item) => (
            <button key={item} type="button" onClick={() => updateQuery(pageKey, item)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition-all ${
                item === currentPage
                  ? 'bg-teal-600 text-white shadow-sm shadow-teal-200'
                  : 'text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-sm'
              }`}>{item}</button>
          ))}
        </div>
        <Button variant="outline" size="sm" disabled={currentPage >= pages}
          onClick={() => updateQuery(pageKey, currentPage + 1)} className="h-8 rounded-lg px-3 text-xs">Next</Button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Page</span>
        <span className="text-sm font-bold text-slate-900">{currentPage}</span>
        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">of</span>
        <span className="text-sm font-bold text-slate-900">{pages}</span>
        {Number.isFinite(total) && (
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">· {total} rows</span>
        )}
      </div>
    </div>
  );
};

const runAction = async (fn, { successMessage, errorMessage = 'Something went wrong', onSuccess } = {}) => {
  try {
    await fn();
    if (successMessage) toast.success(successMessage);
    if (onSuccess) onSuccess();
    return true;
  } catch (error) {
    toast.error(error?.response?.data?.message || errorMessage);
    return false;
  }
};


const parseBool = (value, fallback = true) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  return Boolean(value);
};

const normalizePaymentMethods = (source, fallbackAll = true) => {
  const pm =
    source?.paymentMethods ||
    source?.settings?.paymentMethods ||
    source?.event?.settings?.paymentMethods ||
    null;

  // If no paymentMethods object at all, use fallbackAll for each key
  if (!pm || typeof pm !== 'object') {
    return {
      card: fallbackAll,
      bank_transfer: fallbackAll,
      cash: fallbackAll,
    };
  }

  return {
    card: parseBool(pm.card, fallbackAll),
    bank_transfer: parseBool(pm.bank_transfer, fallbackAll),
    cash: parseBool(pm.cash, fallbackAll),
  };
};


/** Map admin/custom labels → detail form kind */
const resolveEventDetailKind = (eventType = '', customEventType = '') => {
  const raw = `${eventType || ''} ${customEventType || ''}`.toLowerCase().trim();
  // Sports / Match
  if (
    /cricket|match|sports?|football|soccer|rugby|tennis|hockey|basketball|game|tournament|league|fixture/.test(
      raw
    )
  ) {
    return 'match';
  }
  // Concert / Music
  if (
    /concert|music|musical|show|live|festival|gig|band|artist|performance|dj|singer|orchestra/.test(
      raw
    )
  ) {
    return 'concert';
  }
  // Workshop
  if (/workshop|class|course|training|bootcamp/.test(raw)) {
    return 'workshop';
  }
  // Conference / Business
  if (
    /conference|summit|seminar|meetup|talks?|expo|forum|convention|webinar|symposium/.test(
      raw
    )
  ) {
    return 'conference';
  }
  return null;
};

const OrganiserDashboard = () => {
  const { user } = useAuth();
  const { permissions } = usePermissions();
  const [params, setParams] = useSearchParams();
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState(localStorage.getItem('lastSelectedEventId') || '');
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(params.get('search') || '');
  const [status, setStatus] = useState(params.get('status') || '');
  const [category, setCategory] = useState(params.get('category') || '');
  const [attendeeModal, setAttendeeModal] = useState(null);
  const [categoryModal, setCategoryModal] = useState(null);
  const [subOrgModal, setSubOrgModal] = useState(false);
  const [zoneModal, setZoneModal] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [subOrgForm, setSubOrgForm] = useState(emptySubOrg);
  const [teamSearch, setTeamSearch] = useState('');
  const [teamRoleFilter, setTeamRoleFilter] = useState('');
  const [teamStatusFilter, setTeamStatusFilter] = useState('');
  const [deleteTeamModalOpen, setDeleteTeamModalOpen] = useState(false);
  const [teamMemberToDelete, setTeamMemberToDelete] = useState(null);
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(true);
  const [lastUpdateTime, setLastUpdateTime] = useState(new Date());
  const [autoUpdateInterval, setAutoUpdateInterval] = useState(15000);
  const [zoneAssignments, setZoneAssignments] = useState({});
  const [settingsForm, setSettingsForm] = useState(null);
  const [customizationForm, setCustomizationForm] = useState(null);

  const [customizationTab, setCustomizationTab] = useState('general');
  const [coverImageFile, setCoverImageFile] = useState(null);
  const [logoImageFile, setLogoImageFile] = useState(null);
  const [bannerImageFile, setBannerImageFile] = useState(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [removeBanner, setRemoveBanner] = useState(false);
  const [removeCover, setRemoveCover] = useState(false);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState(null);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [bulkUploadModal, setBulkUploadModal] = useState(false);
  const [bulkUploadFile, setBulkUploadFile] = useState(null);
  const [eventRfidStatus, setEventRfidStatus] = useState(null);
  // Tracks unsaved gate edits so soft-refresh does not overwrite typing,
  // but server gates ARE applied when the form is clean (fixes stale UI after DB save).
  const gatesDirtyRef = useRef(false);
  // Dedicated gates state (per current event) — NOT stored only inside customizationForm,
  // so workspace reloads cannot silently replace saved gates with stale API data.
  const [eventGates, setEventGates] = useState([]);
  const eventGatesEventIdRef = useRef(''); // which eventId eventGates belongs to
  const gatesLockedUntilRef = useRef(0); // after save, ignore server gates briefly
  const lastSavedGatesRef = useRef(null);

  useEffect(() => {
    if (!logoImageFile) {
      setLogoPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(logoImageFile);
    setLogoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [logoImageFile]);

  useEffect(() => {
    if (!coverImageFile) {
      setCoverPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(coverImageFile);
    setCoverPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [coverImageFile]);

  useEffect(() => {
    if (!bannerImageFile) {
      setBannerPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(bannerImageFile);
    setBannerPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [bannerImageFile]);

  const [sponsorPackageModal, setSponsorPackageModal] = useState(null);
  const [sponsorModal, setSponsorModal] = useState(null);

  const activeSection = params.get('section') || 'overview';

  const rememberSelectedEvent = (nextEventId) => {
    if (!nextEventId) {
      localStorage.removeItem('lastSelectedEventId');
      setEventId('');
      gatesDirtyRef.current = false;
      gatesLockedUntilRef.current = 0;
      lastSavedGatesRef.current = null;
      setEventGates([]);
      eventGatesEventIdRef.current = '';
      setCustomizationForm(null);
      return '';
    }

    setEventId((prev) => {
      if (prev && prev !== nextEventId) {
        gatesDirtyRef.current = false;
        gatesLockedUntilRef.current = 0;
        lastSavedGatesRef.current = null;
        setEventGates([]);
        eventGatesEventIdRef.current = '';
        setCustomizationForm(null);
      }
      return nextEventId;
    });
    localStorage.setItem('lastSelectedEventId', nextEventId);
    return nextEventId;
  };

  const getValidEventId = (preferredId) => {
    const eventIds = events.map(getEventObjectId).filter(Boolean);
    const candidate = preferredId && preferredId !== 'undefined' ? preferredId : '';
    const current = eventId && eventId !== 'undefined' ? eventId : '';
    const isValidObjectId = (id) => /^[a-f\d]{24}$/i.test(id);
    const nextEventId = isValidObjectId(candidate)
      ? candidate
      : isValidObjectId(current)
        ? current
        : eventIds.includes(candidate)
          ? candidate
          : eventIds.includes(current)
            ? current
            : eventIds[0] || candidate || current;

    if (nextEventId && nextEventId !== eventId) {
      rememberSelectedEvent(nextEventId);
    }

    return nextEventId;
  };

  const normalizeVenue = (event) => {
  const v = event?.venue;
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return {
      name: v.name || v.venueName || '',
      address: v.address || v.venueAddress || v.location || '',
      city: v.city || '',
      country: v.country || '',
      mapUrl: v.mapUrl || v.mapURL || v.map_url || v.googleMapsUrl || '',
    };
  }
  if (typeof v === 'string') {
    return {
      name: v,
      address: event?.venueAddress || event?.address || '',
      city: event?.city || '',
      country: event?.country || '',
      mapUrl: event?.mapUrl || event?.mapURL || '',
    };
  }
  return {
    name: event?.venueName || '',
    address: event?.venueAddress || event?.address || '',
    city: event?.city || '',
    country: event?.country || '',
    mapUrl: event?.mapUrl || event?.mapURL || '',
  };
};

  const loadWorkspace = async (selectedEventId = eventId, options = {}) => {
    if (!selectedEventId) return;
    const soft = !!options.soft;
    if (!soft) setLoading(true);
    try {
      const response = await getOrganiserWorkspace({
        eventId: selectedEventId,
        search: params.get('search') || undefined,
        status: params.get('status') || undefined,
        category: params.get('category') || undefined,
        page: params.get('page') || undefined,
        invitesPage: params.get('invitesPage') || undefined,
        entryLogsPage: params.get('entryLogsPage') || undefined,
        notificationsPage: params.get('notificationsPage') || undefined,
        zoneLogsPage: params.get('zoneLogsPage') || undefined,
        teamPage: params.get('teamPage') || undefined,
        verificationPage: params.get('verificationPage') || undefined,
        limit: params.get('limit') || undefined,
      });
      const nextData = response.data?.data || null;
      if (!nextData) return;

      // Gates for THIS event only (from server)
      const serverGates = Array.isArray(nextData?.event?.gates)
        ? nextData.event.gates
            .map((g) => (typeof g === 'string' ? g : g?.name || ''))
            .map((g) => String(g).trim())
            .filter(Boolean)
        : [];

      setWorkspace(nextData);
      const loadedEventId = getEventObjectId(nextData?.event);
      if (loadedEventId && loadedEventId !== selectedEventId) {
        rememberSelectedEvent(loadedEventId);
      }

      // Sync dedicated gates state (never cross-event; never overwrite mid-edit or post-save lock)
      const gatesBelongToThisEvent = String(eventGatesEventIdRef.current) === String(selectedEventId);
      const locked =
        Date.now() < gatesLockedUntilRef.current &&
        Array.isArray(lastSavedGatesRef.current) &&
        gatesBelongToThisEvent;

      if (locked) {
        // Keep what we just saved
        setEventGates([...lastSavedGatesRef.current]);
      } else if (!gatesDirtyRef.current || !gatesBelongToThisEvent) {
        setEventGates([...serverGates]);
        eventGatesEventIdRef.current = String(selectedEventId);
      }

      const rawSettings = nextData?.settings || {};
      const sectionNow =
        (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('section')) ||
        '';
      const isInCustomization = sectionNow === 'customization';

      // Soft + customization + user is mid-edit → keep local form fields
      // Gates come from eventGates state (synced above)
      const keepLocalEdits = soft && isInCustomization && gatesDirtyRef.current;

      const buildCustomizationForm = () => ({
        basicInfo: {
          name: nextData?.event?.name || '',
          description: nextData?.event?.description || '',
          eventType: nextData?.event?.eventType || '',
          customEventType: nextData?.event?.customEventType || '',
          venue: normalizeVenue(nextData?.event),
          // Mirror dedicated gates into form for any code still reading basicInfo.gates
          gates: (!gatesDirtyRef.current || !gatesBelongToThisEvent) ? [...serverGates] : (nextData?.event?.gates || []),
          currency: nextData?.settings?.currency || nextData?.event?.settings?.currency || 'LKR',
        },
        branding: {
          themeColor: nextData?.event?.branding?.themeColor || '#2563EB',
          logoImage: nextData?.event?.branding?.logoImage || nextData?.event?.logoImage || '',
          bannerImage: nextData?.event?.branding?.bannerImage || nextData?.event?.bannerImage || '',
          coverImage: nextData?.event?.coverImage || '',
        },
        paymentMethods: normalizePaymentMethods(nextData, true),
        accessRules: {
          whoCanEnter: (nextData?.settings?.accessRules?.whoCanEnter || []).join(', '),
          entryWindowStart: nextData?.settings?.accessRules?.entryWindowStart || '',
          entryWindowEnd: nextData?.settings?.accessRules?.entryWindowEnd || '',
          restrictedZones: (nextData?.settings?.accessRules?.restrictedZones || []).join(', '),
        },
        status: nextData?.event?.status || 'draft',
      });

      if (keepLocalEdits) {
        // Do not touch customizationForm — user is typing / editing gates
        setSettingsForm((prev) =>
          prev
            ? prev
            : {
                ...rawSettings,
                emailTemplates: rawSettings.emailTemplates || {},
                smsTemplates: rawSettings.smsTemplates || {},
              }
        );
      } else {
        setSettingsForm({
          ...rawSettings,
          emailTemplates: rawSettings.emailTemplates || {},
          smsTemplates: rawSettings.smsTemplates || {},
        });
        setCustomizationForm(buildCustomizationForm());
        gatesDirtyRef.current = false;
      }

      const zoneMap = {};
      (nextData?.event?.zones || []).forEach((zone) => {
        zoneMap[zone.id] = (nextData?.tickets || [])
          .filter((ticket) => (ticket.allowedZones || []).includes(zone.id))
          .map((ticket) => ticket.id);
      });
      setZoneAssignments(zoneMap);
    } catch (error) {
      if (error.response?.status === 404) {
        const fallbackEventId = events
          .map(getEventObjectId)
          .find((id) => id && id !== selectedEventId);
        if (fallbackEventId) {
          rememberSelectedEvent(fallbackEventId);
          return;
        }
        rememberSelectedEvent('');
      }
      toast.error(error.response?.data?.message || 'Failed to load organiser workspace');
    } finally {
      setLoading(false);
    }
  };

  const loadWorkspaceRef = useRef(loadWorkspace);
  useEffect(() => {
    loadWorkspaceRef.current = loadWorkspace;
  });
  
  // General auto-update for the entire dashboard
  // Disable auto-refresh when in customization mode to prevent form data reset
  useAutoRefresh(
    () => {
      if (!autoUpdateEnabled || activeSection === 'customization') return;
      loadWorkspaceRef.current(eventId, { soft: true, fromRefresh: true });
      setLastUpdateTime(new Date());
    },
    {
      enabled: autoUpdateEnabled,
      interval: autoUpdateInterval,
      immediate: false,
      deps: [autoUpdateEnabled, autoUpdateInterval, activeSection],
    }
  );

  useEffect(() => {
    getMyEvents().then((res) => {
      const list = res.data?.data?.events || [];
      setEvents(list);
      const storedEventId = localStorage.getItem('lastSelectedEventId') || eventId;
      const storedEventExists = list.some((event) => getEventObjectId(event) === storedEventId);
      const firstEventId = storedEventExists ? storedEventId : getEventObjectId(list[0]);
      if (firstEventId) {
        rememberSelectedEvent(firstEventId);
      } else {
        rememberSelectedEvent('');
      }
    }).catch(() => {
      toast.error('Failed to load your assigned events');
    });
  }, []);

  useEffect(() => {
    if (!eventId) return;
    // One load path only — avoids race between parallel forceRefresh + soft calls
    // that was painting old gates after save.
    const section = params.get('section') || '';
    loadWorkspace(eventId, {
      // Soft only when already editing customization (keep unsaved gate edits)
      soft: section === 'customization' && gatesDirtyRef.current,
    });
  }, [eventId, params.toString()]);

  // Fetch RFID status for current event
  useEffect(() => {
    if (!eventId) {
      setEventRfidStatus(null);
      return;
    }
    getEventRfidStatus(eventId)
      .then((response) => {
        setEventRfidStatus(response.data?.data || { rfidEnabled: false });
      })
      .catch(() => {
        setEventRfidStatus({ rfidEnabled: false });
      });
  }, [eventId]);

  useEffect(() => {
    const onSearch = (event) => {
      const nextSearch = String(event.detail || '');
      setSearch(nextSearch);
      setParams((current) => {
        const next = new URLSearchParams(current);
        if (nextSearch) next.set('search', nextSearch);
        else next.delete('search');
        return next;
      });
    };

    const onEvent = (event) => {
      const nextEventId = event.detail ? String(event.detail) : '';
      if (!nextEventId || nextEventId === 'undefined') return;
      rememberSelectedEvent(nextEventId);
    };

    window.addEventListener('entrynex:search', onSearch);
    window.addEventListener('entrynex:event-select', onEvent);
    return () => {
      window.removeEventListener('entrynex:search', onSearch);
      window.removeEventListener('entrynex:event-select', onEvent);
    };
  }, [setParams]);

  useEffect(() => {
    if (!eventId) return undefined;
    const socket = io(getSocketUrl(), {
      path: '/socket.io',
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const joinDashboardRoom = () => {
      socket.emit('join_dashboard', { eventId });
    };

    socket.on('connect', joinDashboardRoom);
    socket.on('connect_error', (error) => {
      console.error('OrganiserDashboard socket connection error:', error);
    });

    joinDashboardRoom();

    const refresh = () => {
      // Don't refresh when in customization mode to prevent form data loss
      if (activeSection === 'customization') return;
      loadWorkspaceRef.current(eventId, { soft: true, fromRefresh: true });
    };
    socket.on('entry_update', refresh);
    socket.on('zone_update', refresh);
    socket.on('payment_approved', refresh);
    socket.on('payment_rejected', refresh);
    socket.on('payment_info_request', refresh);
    socket.on('cash_payment_confirmed', refresh);
    socket.on('event_update', refresh);
    return () => socket.disconnect();
  }, [eventId, activeSection]);

  const setQuery = (key, value) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      if (['search', 'status', 'category', 'limit'].includes(key)) {
        ['page', 'invitesPage', 'entryLogsPage', 'notificationsPage', 'zoneLogsPage', 'teamPage', 'verificationPage', 'ticketsPage', 'sponsorPackagesPage', 'sponsorsPage', 'activityFeedPage'].forEach((pageKey) => next.delete(pageKey));
      }
      return next;
    });
  };

  const selectedEvent = workspace?.event;
  const eventCurrency =
    selectedEvent?.settings?.currency ||
    workspace?.event?.settings?.currency ||
    customizationForm?.basicInfo?.currency ||
    'LKR';
  const categories = workspace?.tickets || [];
  const attendees = workspace?.attendees?.rows || [];
  const verificationQueue = workspace?.verificationQueue || [];
  const invites = workspace?.invites || [];
  const zoneLogs = workspace?.zoneLogs || [];
  const notifications = workspace?.notifications || [];
  const stats = workspace?.overview || {};
  const rawTeamMembers = [
    ...(Array.isArray(workspace?.teamMembers?.rows)
      ? workspace.teamMembers.rows
      : Array.isArray(workspace?.teamMembers)
      ? workspace.teamMembers
      : []),
    ...(Array.isArray(workspace?.subOrganisers?.rows)
      ? workspace.subOrganisers.rows
      : Array.isArray(workspace?.subOrganisers)
      ? workspace.subOrganisers
      : []),
  ];
  const teamMembers = Array.from(
    new Map(rawTeamMembers.filter(Boolean).map((m) => [String(m._id || m.id), m])).values()
  );
  const sponsorPackages = selectedEvent?.sponsorPackages || [];
  const sponsors = workspace?.sponsors || [];
  const totalTicketsCount = Number(stats.totalTickets || 0);
  const ticketsSoldCount = Number(stats.ticketsSold || 0);
  const confirmedAttendeesCount = Number(stats.confirmedAttendees || 0);
  const checkedInCount = Number(stats.checkedInCount || 0);
  
  const formatCurrency = (amount) => {
    const currency = selectedEvent?.settings?.currency || workspace?.event?.settings?.currency || 'LKR';
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };
  
  // Calculate revenue from orders if not available in stats
  const calculateRevenue = () => {
    if (stats.revenue && stats.revenue > 0) return stats.revenue;
    
    // Calculate from orders if available
    const orders = workspace?.orders || [];
    if (orders.length > 0) {
      const revenue = orders.reduce((total, order) => {
        if (order.status !== 'CANCELLED' && order.totalAmount) {
          return total + Number(order.totalAmount);
        }
        return total;
      }, 0);
      if (revenue > 0) return revenue;
    }
    
    // Calculate from attendees if tickets have prices
    const attendeesWithTickets = attendees.filter(a => a.ticketId && a.ticketPrice);
    if (attendeesWithTickets.length > 0) {
      const revenue = attendeesWithTickets.reduce((total, attendee) => {
        return total + Number(attendee.ticketPrice || 0);
      }, 0);
      if (revenue > 0) return revenue;
    }
    
    // Calculate from ticket categories
    if (categories.length > 0) {
      const revenue = categories.reduce((total, cat) => {
        const sold = cat.soldCount || cat.quantitySold || 0;
        return total + (sold * (cat.price || 0));
      }, 0);
      if (revenue > 0) return revenue;
    }
    
    return 0;
  };
  
  // Calculate average ticket price
  const calculateAverageTicketPrice = () => {
    const ticketCategoriesData = categories || [];
    if (ticketCategoriesData.length > 0) {
      const totalPrice = ticketCategoriesData.reduce((sum, cat) => sum + Number(cat.price || 0), 0);
      return totalPrice / ticketCategoriesData.length;
    }
    return 1000; // Default fallback
  };
  
  const eventStats = {
    totalAttendees: confirmedAttendeesCount,
    revenue: calculateRevenue(),
    checkedIn: checkedInCount,
    totalTickets: totalTicketsCount,
    ticketsSold: ticketsSoldCount,
    ticketsAvailable: totalTicketsCount - ticketsSoldCount,
    confirmationRate: confirmedAttendeesCount > 0 ? ((confirmedAttendeesCount / ticketsSoldCount) * 100).toFixed(1) : 0,
    checkInRate: checkedInCount > 0 ? ((checkedInCount / confirmedAttendeesCount) * 100).toFixed(1) : 0,
  };
  const clampPercent = (value) => Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
  const soldProgress = totalTicketsCount > 0 ? clampPercent((ticketsSoldCount / totalTicketsCount) * 100) : 0;
  const checkInProgressBase = confirmedAttendeesCount > 0 ? confirmedAttendeesCount : ticketsSoldCount;
  const checkInProgress = checkInProgressBase > 0 ? clampPercent((checkedInCount / checkInProgressBase) * 100) : 0;
  const pageSize = Math.min(Math.max(parseInt(params.get('limit') || '10', 10) || 10, 1), 50);
  const paginateLocal = (rows, pageKey) => {
    const pages = Math.ceil((rows?.length || 0) / pageSize) || 1;
    const page = clampPage(params.get(pageKey), pages);
    return {
      rows: (rows || []).slice((page - 1) * pageSize, page * pageSize),
      page,
      pages,
      total: rows?.length || 0,
      pageKey,
    };
  };
  const ticketPage = paginateLocal(categories, 'ticketsPage');
  const sponsorPackagePage = paginateLocal(sponsorPackages, 'sponsorPackagesPage');
  const sponsorPage = paginateLocal(sponsors, 'sponsorsPage');
  const activityFeedPage = paginateLocal(workspace?.activityFeed || [], 'activityFeedPage');
  const canViewPrivateTicketCode = (ticket) => {
    if (!ticket?.isPrivate) return false;
    if (user?.role === 'MainOrganiser') return true;
    const ticketCreatorId = String(ticket?.createdBy?._id || ticket?.createdBy || '');
    const currentUserId = String(user?._id || '');
    return !!ticketCreatorId && !!currentUserId && ticketCreatorId === currentUserId;
  };
  const getTicketCreatorLabel = (ticket) => {
    const creatorId = String(ticket?.createdBy?._id || ticket?.createdBy || '');
    if (!creatorId) return 'Unknown';
    if (creatorId === String(user?._id || '')) return `${user?.name || 'You'} (You)`;
    const teamMember = teamMembers.find((member) => String(member?._id || '') === creatorId);
    if (teamMember?.name) return teamMember.name;
    return 'Unknown';
  };

  const teamCounts = useMemo(() => {
    const counts = { SubOrganiser: 0, Staff: 0, Volunteer: 0, Auditor: 0, total: teamMembers.length };
    teamMembers.forEach((m) => {
      if (counts[m.role] !== undefined) {
        counts[m.role]++;
      }
    });
    return counts;
  }, [teamMembers]);

  const handleManualRefresh = () => {
    gatesDirtyRef.current = false;
    loadWorkspaceRef.current(eventId, { soft: false });
    setLastUpdateTime(new Date());
    toast.success('Analytics updated successfully');
  };

  const filteredTeamMembers = useMemo(() => {
    return teamMembers.filter((member) => {
      const searchStr = teamSearch.toLowerCase();
      const nameMatch = !teamSearch || 
        member.name?.toLowerCase().includes(searchStr) || 
        member.email?.toLowerCase().includes(searchStr) || 
        member.phone?.includes(teamSearch);
      const roleMatch = !teamRoleFilter || member.role === teamRoleFilter;
      const statusMatch = !teamStatusFilter || member.status === teamStatusFilter;
      return nameMatch && roleMatch && statusMatch;
    });
  }, [teamMembers, teamSearch, teamRoleFilter, teamStatusFilter]);

  const groupedTeamMembers = useMemo(() => {
    const groups = new Map();
    const directMembers = [];

    // Filtered sub-organisers
    filteredTeamMembers.forEach((member) => {
      if (member.role === 'SubOrganiser') {
        groups.set(String(member._id), { lead: member, members: [] });
      }
    });

    // Children and direct members
    filteredTeamMembers.forEach((member) => {
      if (member.role === 'SubOrganiser') return;
      const ownerId = member.createdBy?._id || member.createdBy;
      if (ownerId && groups.has(String(ownerId))) {
        groups.get(String(ownerId)).members.push(member);
      } else {
        directMembers.push(member);
      }
    });

    return {
      groups: Array.from(groups.values()),
      directMembers,
    };
  }, [filteredTeamMembers]);
  const attendeeCategoryOptions = useMemo(() => categories.map((item) => ({ value: item.id, label: item.name })), [categories]);

  const saveAttendee = () => {
    if (!attendeeModal) return;
    const attendeeId = attendeeModal._id || attendeeModal.id;
    if (!attendeeId) {
      toast.error('Creating a single attendee is not supported here. Use Bulk Upload or invite an existing attendee.');
      return;
    }
    return runAction(() => updateOrganiserAttendee(attendeeId, { ...attendeeModal, eventId }), {
      successMessage: 'Attendee updated',
      errorMessage: 'Failed to update attendee',
      onSuccess: () => {
        setAttendeeModal(null);
        loadWorkspace();
      },
    });
  };

  const removeAttendee = (id) =>
    runAction(() => deleteOrganiserAttendee(id, eventId), {
      successMessage: 'Attendee removed',
      errorMessage: 'Failed to remove attendee',
      onSuccess: loadWorkspace,
    });

  const toggleAttendeeDisabled = (attendee) =>
    runAction(
      () =>
        updateOrganiserAttendee(attendee._id, {
          eventId,
          isDisabled: !attendee.isDisabled,
        }),
      {
        successMessage: attendee.isDisabled ? 'Ticket enabled' : 'Ticket disabled',
        errorMessage: 'Failed to update ticket status',
        onSuccess: loadWorkspace,
      }
    );

  const resendAttendeeInvite = (attendeeId) =>
    runAction(() => inviteOrganiserAttendee(attendeeId, eventId), {
      successMessage: 'Invite resent',
      errorMessage: 'Failed to resend invite',
      onSuccess: loadWorkspace,
    });

  const handleBulkUpload = async (file) => {
    if (!file) {
      toast.error('Please select a file to upload');
      return;
    }
    if (!eventId) {
      toast.error('Select an event before bulk upload');
      return;
    }
    const formData = new FormData();
    formData.append('eventId', eventId);
    formData.append('file', file);
    const ok = await runAction(() => uploadOrganiserBulk(formData), {
      successMessage: 'Bulk upload complete',
      errorMessage: 'Bulk upload failed',
      onSuccess: loadWorkspace,
    });
    if (ok) {
      setBulkUploadModal(false);
      setBulkUploadFile(null);
    }
  };

  const handleDownloadTemplate = async () => {
    if (!eventId) {
      toast.error('Select an event first');
      return;
    }
    await runAction(
      async () => {
        const res = await downloadOrganiserTemplate(eventId);
        const blob = res?.data instanceof Blob ? res.data : new Blob([res.data]);
        downloadBlob(blob, `attendee-template-${eventId}.csv`);
      },
      { successMessage: 'Template downloaded', errorMessage: 'Failed to download template' }
    );
  };

  const saveCategory = () =>
    runAction(
      () => {
        const payload = { ...categoryModal, eventId };
        return categoryModal.id ? updateTicketCategory(categoryModal.id, payload) : createTicketCategory(payload);
      },
      {
        successMessage: categoryModal.id ? 'Category updated' : 'Category created',
        errorMessage: 'Failed to save ticket category',
        onSuccess: () => {
          setCategoryModal(null);
          loadWorkspace();
        },
      }
    );

  const removeCategory = (categoryId) =>
    runAction(() => deleteTicketCategory(categoryId, eventId), {
      successMessage: 'Category deleted',
      errorMessage: 'Failed to delete category',
      onSuccess: loadWorkspace,
    });

  const saveSubOrganiser = async () => {
    if (!eventId) {
      toast.error('Select an event before creating a sub-organiser');
      return;
    }
    if (!subOrgForm.name.trim() || !subOrgForm.email.trim() || !subOrgForm.phone.trim()) {
      toast.error('Name, email, and phone are required');
      return;
    }

    await runAction(() => createSubOrganiser({ ...subOrgForm, eventId }), {
      successMessage: 'Team member created',
      errorMessage: 'Failed to create team member',
      onSuccess: () => {
        setSubOrgModal(false);
        setSubOrgForm(emptySubOrg);
        loadWorkspace();
      },
    });
  };

  const handleEditTeamMember = (member) => {
  const toId = (value) => {
    if (value == null) return '';
    if (typeof value === 'object') return String(value._id || value.id || '');
    return String(value);
  };

  // Zones: merge assignedZones + responsibilities.zoneIds, normalize to string ids
  const zoneIdSet = new Set();
  [...(member.assignedZones || []), ...(member.responsibilities?.zoneIds || [])].forEach((z) => {
    const id = toId(z);
    if (id) zoneIdSet.add(id);
  });
  // Also resolve zone names → ids when stored as names
  (selectedEvent?.zones || []).forEach((zone) => {
    const zid = toId(zone.id || zone._id);
    const zname = String(zone.name || '');
    if (
      (member.assignedZones || []).some((z) => toId(z) === zid || String(z) === zname) ||
      (member.responsibilities?.zoneIds || []).some((z) => toId(z) === zid || String(z) === zname)
    ) {
      if (zid) zoneIdSet.add(zid);
    }
  });

  // Gates: get assigned gates
  const gateSet = new Set(member.assignedGates || []);

  // Categories: from ticket.assignedSubOrganisers AND member.assignedCategories
  const memberIdStr = toId(member._id || member.id);
  const catIdSet = new Set();

  categories.forEach((cat) => {
    const cid = toId(cat.id || cat._id);
    if (!cid) return;
    const assignedTo = cat.assignedSubOrganisers || cat.assignedSubOrganiserIds || [];
    const isOnCategory = assignedTo.some((id) => toId(id) === memberIdStr);
    if (isOnCategory) catIdSet.add(cid);
  });

  (member.assignedCategories || member.categoryIds || []).forEach((c) => {
    const cid = toId(c);
    if (cid) catIdSet.add(cid);
    // resolve by name if needed
    const byName = categories.find((cat) => String(cat.name) === String(c));
    if (byName) catIdSet.add(toId(byName.id || byName._id));
  });

  setSubOrgForm({
    ...emptySubOrg,
    ...member,
    role: member.role || 'SubOrganiser',
    permissions: { ...emptySubOrg.permissions, ...(member.permissions || {}) },
    assignedZones: Array.from(zoneIdSet),
    assignedGates: Array.from(gateSet),
    assignedCategories: Array.from(catIdSet),
    _id: member._id || member.id,
  });
  setSubOrgModal(true);
};

  const saveTeamMemberAccess = async () => {
    if (!subOrgForm._id) {
      await saveSubOrganiser();
      return;
    }
    const response = await updateSubOrganiser(subOrgForm._id, { ...subOrgForm, eventId });
    const updatedUser = response.data?.data?.user;
    if (updatedUser) {
      // Immediately update local state with fresh server data
      setWorkspace(prev => {
        if (!prev?.teamMembers) return prev;
        return {
          ...prev,
          teamMembers: (prev.teamMembers || []).map(member => {
            if (String(member._id) === String(updatedUser._id)) {
              return {
                ...member,
                ...updatedUser,
                permissions: updatedUser.permissions || member.permissions,
              };
            }
            return member;
          }),
        };
      });
    }
    setSubOrgModal(false);
    setSubOrgForm(emptySubOrg);
    toast.success('Team member updated');
    // Force fresh data load to ensure persistence
    loadWorkspace();
  };

  const toggleTeamMemberStatus = (member) =>
    runAction(
      () => updateSubOrganiser(member._id, { eventId, status: member.status === 'Active' ? 'Inactive' : 'Active' }),
      {
        successMessage: 'Status updated',
        errorMessage: 'Failed to update status',
        onSuccess: loadWorkspace,
      }
    );

  const handleDeleteTeamMember = (member) => {
    setTeamMemberToDelete(member);
    setDeleteTeamModalOpen(true);
  };

  const confirmDeleteTeamMember = async () => {
    if (!teamMemberToDelete) return;
    
    try {
      await deleteSubOrganiser(teamMemberToDelete._id);
      toast.success('Team member deleted successfully');
      setDeleteTeamModalOpen(false);
      setTeamMemberToDelete(null);
      loadWorkspace();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete team member');
    }
  };

  const saveZone = () =>
    runAction(
      () => {
        const payload = { ...zoneModal, eventId };
        return zoneModal.id ? updateZone(zoneModal.id, payload) : createZone(payload);
      },
      {
        successMessage: zoneModal.id ? 'Zone updated' : 'Zone created',
        errorMessage: 'Failed to save zone',
        onSuccess: () => {
          setZoneModal(null);
          loadWorkspace();
        },
      }
    );

  const removeZone = (zoneId) =>
    runAction(() => deleteZone(zoneId, eventId), {
      successMessage: 'Zone deleted',
      errorMessage: 'Failed to delete zone',
      onSuccess: loadWorkspace,
    });

  const updateZoneAssignment = (zoneId, ticketId, checked) => {
    const next = checked
      ? [...new Set([...(zoneAssignments[zoneId] || []), ticketId])]
      : (zoneAssignments[zoneId] || []).filter((item) => item !== ticketId);
    setZoneAssignments((current) => ({ ...current, [zoneId]: next }));
    runAction(() => assignZoneCategories(zoneId, { eventId, categoryIds: next }), {
      successMessage: 'Zone assignments updated',
      errorMessage: 'Failed to update zone assignments',
      onSuccess: loadWorkspace,
    });
  };

  const saveCustomization = async () => {
    if (!customizationForm) return;

    const activeEventId = getValidEventId(getEventObjectId(workspace?.event));
    if (!activeEventId) {
      toast.error('Select an event before saving customization');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('eventId', activeEventId);

      // Gates source of truth = dedicated eventGates state
      const normalizedGates = [
        ...new Set(
          (Array.isArray(eventGates) ? eventGates : [])
            .map((g) => (typeof g === 'string' ? g : g?.name || '').trim())
            .filter(Boolean)
        ),
      ];
      console.log('[saveCustomization] eventId=', activeEventId, 'gates=', normalizedGates);

      const basicInfoPayload = {
        name: customizationForm.basicInfo?.name || '',
        description: customizationForm.basicInfo?.description || '',
        eventType: customizationForm.basicInfo?.eventType || '',
        customEventType: customizationForm.basicInfo?.customEventType || '',
        venue: customizationForm.basicInfo?.venue || {},
        currency: customizationForm.basicInfo?.currency || 'LKR',
        gates: normalizedGates,
      };
      formData.append('basicInfo', JSON.stringify(basicInfoPayload));
      formData.append('gates', JSON.stringify(normalizedGates));
      formData.append('eventGates', JSON.stringify(normalizedGates));

      // Branding (files are sent separately)
      const brandingPayload = { ...customizationForm.branding };
      delete brandingPayload.logoImage;
      delete brandingPayload.coverImage;
      delete brandingPayload.bannerImage;
      formData.append('branding', JSON.stringify(brandingPayload));

      // Payment methods
      const paymentMethodsPayload = {
        card: parseBool(customizationForm.paymentMethods?.card, false),
        bank_transfer: parseBool(customizationForm.paymentMethods?.bank_transfer, false),
        cash: parseBool(customizationForm.paymentMethods?.cash, false),
      };
      formData.append('paymentMethods', JSON.stringify(paymentMethodsPayload));

      // Access rules
      formData.append(
        'accessRules',
        JSON.stringify({
          whoCanEnter: (customizationForm.accessRules?.whoCanEnter || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
          entryWindowStart: customizationForm.accessRules?.entryWindowStart || '',
          entryWindowEnd: customizationForm.accessRules?.entryWindowEnd || '',
          restrictedZones: (customizationForm.accessRules?.restrictedZones || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
        })
      );

      formData.append('status', customizationForm.status || 'draft');

      if (customizationForm.eventDetails) {
        formData.append('eventDetails', JSON.stringify(customizationForm.eventDetails));
      }

      // ─── Event-type specific details ───
      const detailKind = resolveEventDetailKind(
        customizationForm.basicInfo?.eventType,
        customizationForm.basicInfo?.customEventType
      );

      if (detailKind === 'match') {
        formData.append(
          'matchDetails',
          JSON.stringify({
            teamA: customizationForm.eventDetails?.match?.teamA?.name || '',
            teamB: customizationForm.eventDetails?.match?.teamB?.name || '',
            matchType: customizationForm.eventDetails?.match?.matchType || '',
            series: customizationForm.eventDetails?.match?.tournament || '',
          })
        );
        formData.append(
          'eventDetails',
          JSON.stringify({
            match: {
              teamA: {
                name: customizationForm.eventDetails?.match?.teamA?.name || '',
                shortName: customizationForm.eventDetails?.match?.teamA?.shortName || ''
              },
              teamB: {
                name: customizationForm.eventDetails?.match?.teamB?.name || '',
                shortName: customizationForm.eventDetails?.match?.teamB?.shortName || ''
              },
              matchType: customizationForm.eventDetails?.match?.matchType || '',
              tournament: customizationForm.eventDetails?.match?.tournament || '',
              matchNumber: customizationForm.eventDetails?.match?.matchNumber || '',
              venue: customizationForm.eventDetails?.match?.venue || '',
              matchDate: customizationForm.eventDetails?.match?.matchDate || '',
              matchTime: customizationForm.eventDetails?.match?.matchTime || ''
            }
          })
        );
      } else if (detailKind === 'concert') {
        formData.append(
          'concertDetails',
          JSON.stringify({
            mainArtist: customizationForm.eventDetails?.concert?.artistOrPerformer || '',
            supportingBands: customizationForm.eventDetails?.concert?.supportingArtist ? customizationForm.eventDetails.concert.supportingArtist.split(',').map((s) => s.trim()).filter(Boolean) : [],
            genre: customizationForm.eventDetails?.concert?.genre || '',
            tourName: customizationForm.eventDetails?.concert?.performanceType || '',
          })
        );
        formData.append(
          'eventDetails',
          JSON.stringify({
            concert: {
              artistOrPerformer: customizationForm.eventDetails?.concert?.artistOrPerformer || '',
              supportingArtist: customizationForm.eventDetails?.concert?.supportingArtist || '',
              genre: customizationForm.eventDetails?.concert?.genre || '',
              performanceType: customizationForm.eventDetails?.concert?.performanceType || '',
              ageRestriction: customizationForm.eventDetails?.concert?.ageRestriction || ''
            }
          })
        );
      } else if (detailKind === 'conference') {
        formData.append(
          'conferenceDetails',
          JSON.stringify({
            theme: customizationForm.eventDetails?.conference?.conferenceName || '',
            speakers: customizationForm.eventDetails?.conference?.speakers ? customizationForm.eventDetails.conference.speakers.split(',').map((s) => s.trim()).filter(Boolean) : [],
            scheduleUrl: customizationForm.eventDetails?.conference?.registrationInfo || '',
          })
        );
        formData.append(
          'eventDetails',
          JSON.stringify({
            conference: {
              conferenceName: customizationForm.eventDetails?.conference?.conferenceName || '',
              speakers: customizationForm.eventDetails?.conference?.speakers || '',
              keynoteSpeaker: customizationForm.eventDetails?.conference?.keynoteSpeaker || '',
              sessionType: customizationForm.eventDetails?.conference?.sessionType || '',
              organizerName: customizationForm.eventDetails?.conference?.organizerName || '',
              registrationInfo: customizationForm.eventDetails?.conference?.registrationInfo || ''
            }
          })
        );
      }

      // Image files
      if (coverImageFile) formData.append('coverImage', coverImageFile);
      if (logoImageFile) formData.append('logoImage', logoImageFile);
      if (bannerImageFile) formData.append('bannerImage', bannerImageFile);

      // Removal flags
      if (removeCover && !coverImageFile) formData.append('removeCoverImage', 'true');
      if (removeLogo && !logoImageFile) formData.append('removeLogoImage', 'true');
      if (removeBanner && !bannerImageFile) formData.append('removeBannerImage', 'true');

      // ─── Save ───
      const response = await updateOrganiserEventCustomization(formData);

      toast.success('Event customization updated');

      // Optimistic UI — dedicated eventGates is the only gates UI source
      const gatesToKeep = [...normalizedGates];
      setEventGates(gatesToKeep);
      eventGatesEventIdRef.current = String(activeEventId);
      lastSavedGatesRef.current = gatesToKeep;
      gatesLockedUntilRef.current = Date.now() + 30000; // 30s ignore stale GET
      gatesDirtyRef.current = false;

      setCoverImageFile(null);
      setLogoImageFile(null);
      setBannerImageFile(null);
      setRemoveCover(false);
      setRemoveLogo(false);
      setRemoveBanner(false);

      const savedEvent = response?.data?.data?.event || response?.data?.event || null;

      setCustomizationForm((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          basicInfo: {
            ...prev.basicInfo,
            gates: gatesToKeep,
          },
        };
      });

      setWorkspace((prev) => {
        if (!prev?.event) return prev;
        return {
          ...prev,
          event: {
            ...prev.event,
            ...(savedEvent || {}),
            gates: gatesToKeep,
          },
        };
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update event customization');
    }
  };

  const saveSponsorPackage = async () => {
    if (!eventId) {
      toast.error('Select an event before saving sponsor package');
      return;
    }
    if (!sponsorPackageModal?.name?.trim()) {
      toast.error('Sponsor package name is required');
      return;
    }
    try {
      const payload = {
        ...sponsorPackageModal,
        eventId,
        capacity: Number(sponsorPackageModal.capacity || 1),
        price: Number(sponsorPackageModal.price || 0),
        benefits: (sponsorPackageModal.benefits || []).filter(Boolean),
      };
      if (sponsorPackageModal.id) {
        await updateSponsorPackage(sponsorPackageModal.id, payload, { eventId });
        toast.success('Sponsor package updated');
      } else {
        await createSponsorPackage(payload, { eventId });
        toast.success('Sponsor package created');
      }
      setSponsorPackageModal(null);
      loadWorkspace(eventId);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save sponsor package');
    }
  };

  const saveSponsor = async () => {
    if (!eventId) {
      toast.error('Select an event before creating sponsor');
      return;
    }
    if (!sponsorModal?.companyName?.trim() || !sponsorModal?.contactPerson?.trim() || !sponsorModal?.email?.trim() || !sponsorModal?.packageId) {
      toast.error('Company, contact person, email, and package are required');
      return;
    }
    try {
      const payload = {
        ...sponsorModal,
        eventId,
      };
      await createSponsor(payload, { eventId });
      toast.success('Sponsor created');
      setSponsorModal(null);
      loadWorkspace(eventId);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create sponsor');
    }
  };

    const removeSponsorPackage = async (packageId) => {
      try {
        await deleteSponsorPackage(packageId, eventId);
        toast.success('Sponsor package deleted');
        setDeleteConfirm(null);
        loadWorkspace(eventId);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to delete sponsor package');
      }
    };

    const removeSponsor = async (id) => {
      try {
        await deleteSponsor(id, eventId);
        toast.success('Sponsor deleted');
        setDeleteConfirm(null);
        loadWorkspace(eventId);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to delete sponsor');
      }
    };

    const confirmDelete = () => {
      if (!deleteConfirm) return;
      if (deleteConfirm.type === 'package') removeSponsorPackage(deleteConfirm.id);
      else if (deleteConfirm.type === 'sponsor') removeSponsor(deleteConfirm.id);
    };

  const approveVerification = (attendeeId) =>
    runAction(() => updateVerificationStatus(attendeeId, { eventId, status: 'verified' }), {
      successMessage: 'Photo approved',
      errorMessage: 'Failed to approve photo',
      onSuccess: loadWorkspace,
    });

  const rejectVerification = () =>
    runAction(
      () => updateVerificationStatus(rejecting._id, { eventId, status: 'rejected', reason: rejecting.reason || '' }),
      {
        successMessage: 'Photo rejected',
        errorMessage: 'Failed to reject photo',
        onSuccess: () => {
          setRejecting(null);
          loadWorkspace();
        },
      }
    );

  const doResendInvite = (inviteId) =>
    runAction(() => resendInvite(inviteId, eventId), {
      successMessage: 'Invite resent',
      errorMessage: 'Failed to resend invite',
      onSuccess: loadWorkspace,
    });

  const doCancelInvite = (inviteId) =>
    runAction(() => cancelInvite(inviteId, eventId), {
      successMessage: 'Invite cancelled',
      errorMessage: 'Failed to cancel invite',
      onSuccess: loadWorkspace,
    });

  const doResendNotification = (notificationId) =>
    runAction(() => resendOrganiserNotification(notificationId, eventId), {
      successMessage: 'Notification re-queued',
      errorMessage: 'Failed to resend notification',
    });

  const saveSettings = () => {
    const activeEventId = getValidEventId(getEventObjectId(selectedEvent));
    if (!activeEventId) {
      toast.error('Select an event before saving settings');
      return;
    }
    runAction(
      () => updateOrganiserSettings({ eventId: activeEventId, name: selectedEvent?.name, venue: selectedEvent?.venue, settings: settingsForm }),
      { successMessage: 'Settings updated', errorMessage: 'Failed to update settings' }
    );
  };

  const doExport = (report) =>
    runAction(
      async () => {
        const res = await exportOrganiserEventData(eventId, { type: report.exportType });
        downloadBlob(res.data, `${report.id}-${eventId}.csv`);
      },
      { errorMessage: 'Failed to export report' }
    );

  if (loading && !workspace) {
    return <DashboardLayout><LoadingSkeleton /></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-20">
        {/* ── Header — OVERVIEW ONLY ── */}
        {(activeSection === 'overview' || activeSection === '') && (
          <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-6 sm:px-8 sm:py-7">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/15 animate-pulse" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Organiser Workspace</p>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-medium text-slate-500">Live</span>
                  </div>
                  <h1 className="mt-2.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 truncate">
                    {selectedEvent?.name || 'Assigned Event'}
                  </h1>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        selectedEvent?.status === 'published' || selectedEvent?.status === 'ongoing'
                          ? 'bg-emerald-500'
                          : selectedEvent?.status === 'draft'
                          ? 'bg-amber-400'
                          : 'bg-slate-400'
                      }`} />
                      {selectedEvent?.status || 'draft'}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                      <MapPinIcon className="h-3.5 w-3.5 text-slate-400" />
                      <span className="truncate max-w-[180px]">{selectedEvent?.venue?.name || 'Venue TBD'}</span>
                    </span>
                  </div>
                </div>
                <div className="flex gap-3 shrink-0">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 min-w-[100px] text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Team</p>
                    <p className="mt-0.5 text-xl font-bold text-slate-900">{teamMembers.length || 0}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 min-w-[100px] text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Categories</p>
                    <p className="mt-0.5 text-xl font-bold text-slate-900">{categories.length || 0}</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {(activeSection === 'overview' || activeSection === '') && (
          <>
            {/* KPI cards */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard title="Total Tickets" value={stats.totalTickets || 0} subtitle={soldProgress ? 'On sale' : 'Not yet on sale'} icon={TicketIcon} />
              <MetricCard title="Tickets Sold" value={stats.ticketsSold || 0} subtitle={`${soldProgress}% of capacity`} icon={FireIcon} />
              <MetricCard
                title="Total Revenue"
                value={`${eventCurrency} ${Number(stats.totalRevenue || eventStats.revenue || 0).toLocaleString()}`}
                subtitle="Confirmed order value"
                icon={BanknotesIcon}
              />
              <MetricCard title="Checked-In" value={stats.checkedInCount || 0} subtitle={`${checkInProgress}% check-in rate`} icon={CheckBadgeIcon} />
            </section>

            {/* Quick control cards */}
            <section className="grid gap-4 xl:grid-cols-3">
              {[
                { title: 'Ticket Control', sub: 'Categories & sales', count1: categories.length || 0, label1: 'Categories', count2: stats.ticketsSold || 0, label2: 'Sold', section: 'tickets' },
                { title: 'Zone Control', sub: 'Areas & movement', count1: selectedEvent?.zones?.length || 0, label1: 'Zones', count2: zoneLogs.length || 0, label2: 'Logs', section: 'zones' },
                { title: 'Team Control', sub: 'Staff & sub-organisers', count1: teamMembers.length || 0, label1: 'Members', count2: verificationQueue.length || 0, label2: 'Pending', section: 'suborganisers' },
              ].map((item) => (
                <Card key={item.title} className="rounded-2xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{item.sub}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-teal-50/80 border border-teal-100/70 px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-600/80">{item.label1}</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">{item.count1}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{item.label2}</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">{item.count2}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => setQuery('section', item.section)}
                      className="border-slate-200 text-slate-700 hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50">
                      Open
                    </Button>
                  </div>
                </Card>
              ))}
            </section>

            {/* RFID Operations Section - Only show for RFID-enabled events */}
            {eventRfidStatus?.rfidEnabled && (permissions?.canManageRfid || permissions?.canAssignRfid || permissions?.canAccessRfidScanner) && (
              <section className="grid gap-4 xl:grid-cols-3">
                <Card className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                          <IdentificationIcon className="h-5 w-5" />
                        </div>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                          RFID Enabled
                        </span>
                      </div>
                      <h3 className="mt-3 text-base font-bold text-slate-900">RFID Operations</h3>
                      <p className="mt-1 text-xs text-slate-500">Manage RFID assignments and scanning</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {permissions?.canAssignRfid && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        onClick={() => window.location.href = '/staff/rfid-assign'}
                      >
                        <QrCodeIcon className="mr-2 h-4 w-4" />
                        QR-to-RFID Assignment
                      </Button>
                    )}
                    {permissions?.canAccessRfidScanner && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => setQuery('section', 'entry-logs')}
                        >
                          <ClockIcon className="mr-2 h-4 w-4" />
                          Entry Logs
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => window.location.href = '/staff/scan'}
                        >
                          <IdentificationIcon className="mr-2 h-4 w-4" />
                          RFID Scanner
                        </Button>
                      </>
                    )}
                  </div>
                </Card>

                <Card className="rounded-2xl border border-teal-200/80 bg-white shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                      <UsersIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">RFID Inventory</h3>
                      <p className="text-xs text-slate-500">Tags available and assigned</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-teal-50 border border-teal-100 px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-600/80">Available</p>
                      <p className="mt-1 text-xl font-bold text-slate-900">
                        {workspace?.rfidStats?.availableTags || 0}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Assigned</p>
                      <p className="mt-1 text-xl font-bold text-slate-900">
                        {workspace?.rfidStats?.assignedTags || 0}
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="rounded-2xl border border-amber-200/80 bg-white shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                      <ClockIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Today's RFID Activity</h3>
                      <p className="text-xs text-slate-500">Check-ins via RFID</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-2xl font-bold text-amber-600">
                      {workspace?.rfidStats?.todayRfidCheckins || 0}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">RFID-based entries today</p>
                  </div>
                </Card>
              </section>
            )}

            {/* Charts */}
            <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
              <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <CardHeader title="Check-ins Over Time" subtitle="Live event flow" />
                <div className="h-64 sm:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={workspace?.charts?.checkinsOverTime || []}>
                      <defs>
                        <linearGradient id="checkinsFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                      <Area type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2.5} fill="url(#checkinsFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <CardHeader title="Revenue by Category" subtitle="Distribution across tiers" />
                <div className="h-64 sm:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={workspace?.charts?.revenueByCategory || []} cx="50%" cy="50%"
                        innerRadius={52} outerRadius={78} paddingAngle={4} dataKey="value">
                        {(workspace?.charts?.revenueByCategory || []).map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                            formatter={(value) => `${eventCurrency} ${Number(value).toLocaleString()}`} />
                      <Legend verticalAlign="bottom" height={32} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </section>

            {/* Activity feed */}
            <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <CardHeader title="Activity Feed" subtitle="Recent operations" />
              <div className="space-y-2">
                {(workspace?.activityFeed || []).length > 0
                  ? (workspace.activityFeed || []).slice(0, 8).map((item) => (
                      <div key={item.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                        <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                          <p className="mt-0.5 text-sm text-slate-600 line-clamp-1">{item.message}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))
                  : (
                    <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                      No recent activity.
                    </div>
                  )}
              </div>
            </Card>
          </>
        )}

        {activeSection === 'customization' && customizationForm && (
          <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <CardHeader
              title="Event Customization"
              subtitle="Public details, branding & payment options"
              action={
                <Button
                  onClick={saveCustomization}
                  className="bg-teal-600 hover:bg-teal-500"
                >
                  Save Customization
                </Button>
              }
            />

            {/* Tabs */}
            <div className="mb-6 flex gap-6 border-b border-slate-200">
              {['general', 'branding', 'payment', 'gates'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setCustomizationTab(tab)}
                  className={`pb-3 text-sm font-semibold capitalize ${
                    customizationTab === tab
                      ? 'border-b-2 border-teal-600 text-teal-600'
                      : 'text-slate-500'
                  }`}
                >
                  {tab === 'gates' ? 'Gates' : tab}
                </button>
              ))}
            </div>

            {/* ==================== GENERAL TAB ==================== */}
            {customizationTab === 'general' && (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4">
                  <Field label="Event name">
                    <Input
                      value={customizationForm.basicInfo.name}
                      readOnly
                      className="bg-gray-100 text-gray-700 border border-gray-300 rounded-md"
                    />
                  </Field>

                  <Field label="Description">
                    <textarea
                      rows={5}
                      value={customizationForm.basicInfo.description}
                      onChange={(e) =>
                        setCustomizationForm((c) => ({
                          ...c,
                          basicInfo: { ...c.basicInfo, description: e.target.value },
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                    />
                  </Field>

                </div>

                <div className="space-y-4">
                  <Field label="Venue name">
                    <Input
                      value={customizationForm.basicInfo.venue?.name || ''}
                      readOnly
                      className="bg-gray-100 text-gray-700 border border-gray-300 rounded-md"
                    />
                  </Field>
                  
                  <Field label="Event type">
                    <Input
                      value={
                        customizationForm.basicInfo.eventType ||
                        customizationForm.basicInfo.customEventType ||
                        'Not set'
                      }
                      readOnly
                      className="bg-gray-100 text-gray-700 border border-gray-300 rounded-md"
                    />
                  </Field>

                  <Field label="Currency">
                    <Input
                      value={customizationForm.basicInfo.currency || eventCurrency}
                      readOnly
                      aria-readonly="true"
                      title="Currency can only be changed by admin"
                      className="bg-gray-100 text-gray-700 border border-gray-300 rounded-md"
                    />
                  </Field>

                  {/* Main Organizer Display */}
                  {selectedEvent?.mainOrganisers && selectedEvent.mainOrganisers.length > 0 && (
                    <Field label="Main Organizer">
                      <div className="flex flex-wrap gap-2 mt-1">
                        {selectedEvent.mainOrganisers.map((org, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 bg-teal-50 text-teal-700 text-sm font-medium px-3 py-1.5 rounded-lg border border-teal-100"
                          >
                            {org.name || org.email || 'Organizer'}
                          </span>
                        ))}
                      </div>
                    </Field>
                  )}
                </div>
                </div>
            )}

            {/* ==================== BRANDING TAB ==================== */}
            {customizationTab === 'branding' && (
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Logo */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
                    <div className="h-2 w-2 rounded-full bg-teal-500" />
                    Logo
                  </h3>
                  <div className="flex items-start gap-4">
                    <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50">
                      {logoPreviewUrl ? (
                        <img
                          src={logoPreviewUrl}
                          alt="Logo Preview"
                          className="h-full w-full object-cover"
                        />
                      ) : customizationForm.branding.logoImage && !removeLogo ? (
                        <img
                          src={getAssetUrl(customizationForm.branding.logoImage)}
                          alt="Logo"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-slate-400">No logo</span>
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <label className="inline-block cursor-pointer rounded-lg bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-100">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              setLogoImageFile(e.target.files[0]);
                              setRemoveLogo(false);
                            }
                          }}
                        />
                        Upload Logo
                      </label>
                      {(logoImageFile ||
                        (customizationForm.branding.logoImage && !removeLogo)) && (
                        <button
                          type="button"
                          onClick={() => {
                            setLogoImageFile(null);
                            setRemoveLogo(true);
                          }}
                          className="ml-2 text-sm text-rose-500 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                      <p className="text-xs text-slate-500">
                        Recommended: Square image, max 2MB (PNG/JPG)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Banner */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
                  <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
                    <div className="h-2 w-2 rounded-full bg-teal-500" />
                    Banner Image
                  </h3>
                  <div className="space-y-4">
                    <div className="relative flex h-32 w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50">
                      {bannerPreviewUrl ? (
                        <img
                          src={bannerPreviewUrl}
                          alt="Banner Preview"
                          className="h-full w-full object-cover"
                        />
                      ) : customizationForm.branding.bannerImage && !removeBanner ? (
                        <img
                          src={getAssetUrl(customizationForm.branding.bannerImage)}
                          alt="Banner"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-slate-400">No banner</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="inline-block cursor-pointer rounded-lg bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-100">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              setBannerImageFile(e.target.files[0]);
                              setRemoveBanner(false);
                            }
                          }}
                        />
                        Upload Banner
                      </label>
                      {(bannerImageFile ||
                        (customizationForm.branding.bannerImage && !removeBanner)) && (
                        <button
                          type="button"
                          onClick={() => {
                            setBannerImageFile(null);
                            setRemoveBanner(true);
                          }}
                          className="text-sm text-rose-500 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Cover Image - Public Event Page */}
                <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-5 shadow-sm lg:col-span-2">
                  <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
                    <div className="h-2 w-2 rounded-full bg-teal-500" />
                    Cover Image (Public Event Page)
                  </h3>
                  <p className="text-sm text-teal-600 mb-4">
                    This image appears at the top of the public event detail page where customers browse and purchase tickets.
                  </p>
                  <div className="space-y-4">
                    <div className="relative flex h-40 w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50">
                      {coverPreviewUrl ? (
                        <img
                          src={coverPreviewUrl}
                          alt="Cover Preview"
                          className="h-full w-full object-cover"
                        />
                      ) : customizationForm.branding.coverImage && !removeCover ? (
                        <img
                          src={getAssetUrl(customizationForm.branding.coverImage)}
                          alt="Cover"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-slate-400">No cover image</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="inline-block cursor-pointer rounded-lg bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-100">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              setCoverImageFile(e.target.files[0]);
                              setRemoveCover(false);
                            }
                          }}
                        />
                        Upload Cover
                      </label>
                      {(coverImageFile ||
                        (customizationForm.branding.coverImage && !removeCover)) && (
                        <button
                          type="button"
                          onClick={() => {
                            setCoverImageFile(null);
                            setRemoveCover(true);
                          }}
                          className="text-sm text-rose-500 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* ==================== PAYMENT TAB ==================== */}
          {customizationTab === 'payment' && (
            <div className="space-y-8">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-1 text-sm font-bold uppercase tracking-wider text-slate-500">
                  Payment Methods
                </h3>
                <p className="mb-5 text-sm text-slate-500">
                  Choose which methods buyers can use at checkout.
                </p>

                <div className="space-y-3">
                  {[
                    {
                      key: 'card',
                      label: 'Card',
                      desc: 'Accept credit/debit card payments',
                    },
                    {
                      key: 'bank_transfer',
                      label: 'Bank Transfer',
                      desc: 'Allow offline bank transfer payments',
                    },
                    {
                      key: 'cash',
                      label: 'Cash',
                      desc: 'Allow cash on delivery or at venue',
                    },
                  ].map(({ key, label, desc }) => {
                    const enabled = parseBool(customizationForm?.paymentMethods?.[key], false);

                    const toggle = () => {
                      setCustomizationForm((c) => ({
                        ...c,
                        paymentMethods: {
                          card: parseBool(c.paymentMethods?.card, true),
                          bank_transfer: parseBool(c.paymentMethods?.bank_transfer, true),
                          cash: parseBool(c.paymentMethods?.cash, true),
                          [key]: !parseBool(c.paymentMethods?.[key], false),
                        },
                      }));
                    };

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={toggle}
                        className={`flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-left transition ${
                          enabled
                            ? 'border-teal-200 bg-teal-50/40'
                            : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                        }`}
                      >
                        <div className="min-w-0 pr-4">
                          <p
                            className={`font-semibold ${
                              enabled ? 'text-teal-900' : 'text-slate-900'
                            }`}
                          >
                            {label}
                          </p>
                          <p className="text-sm text-slate-500">{desc}</p>
                        </div>

                        <span
                          role="switch"
                          aria-checked={enabled}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                            enabled ? 'bg-teal-600' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                              enabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {customizationTab === 'gates' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="bg-teal-50 p-4 rounded-xl border border-teal-100 mb-6">
                  <h4 className="text-sm font-semibold text-teal-900 mb-2">Main Entry Gates</h4>
                  <p className="text-xs text-teal-700">
                    Configure the physical gates at the venue entrance where attendees check in/out.
                    Changes are saved when you click <strong>Save Customization</strong>.
                  </p>
                </div>

                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-semibold text-slate-700">Gate Names</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      gatesDirtyRef.current = true;
                      setEventGates((gates) => {
                        const list = Array.isArray(gates) ? gates : [];
                        const nextIndex = list.length;
                        const label = `Gate ${String.fromCharCode(65 + (nextIndex % 26))}${nextIndex >= 26 ? Math.floor(nextIndex / 26) : ''}`;
                        return [...list, label];
                      });
                    }}
                  >
                    + Add Gate
                  </Button>
                </div>

                <div className="space-y-3">
                  {eventGates.map((gate, idx) => (
                    <div
                      key={`gate-row-${idx}`}
                      className="p-4 border border-slate-200 rounded-lg bg-slate-50 flex gap-3 items-center"
                    >
                      <div className="flex-1">
                        <label className="block text-xs text-slate-500 mb-1">Gate Name *</label>
                        <input
                          required
                          value={typeof gate === 'string' ? gate : (gate?.name || '')}
                          onChange={(e) => {
                            const val = e.target.value;
                            gatesDirtyRef.current = true;
                            setEventGates((list) => {
                              const next = [...(list || [])];
                              next[idx] = val;
                              return next;
                            });
                          }}
                          className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                          placeholder="e.g., Gate A, Main Entrance, VIP Entry"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          gatesDirtyRef.current = true;
                          setEventGates((list) => {
                            const next = [...(list || [])];
                            next.splice(idx, 1);
                            return next;
                          });
                        }}
                        className="text-red-500 hover:text-red-700"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>

                {eventGates.length === 0 && (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    No gates configured. Click &quot;+ Add Gate&quot; to add the first gate.
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      )}
        {activeSection === 'attendees' && (
          <PermissionGuard permission="canViewAttendees" fallback={null}>
            <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden" padding={false}>
              <div className="flex flex-col gap-3 px-5 pt-5 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Attendee Management</h2>
                  <p className="text-sm text-slate-500">Search, filter, edit & resend</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <PermissionGuard permission="canAddAttendees">
                    <Button size="sm" onClick={() => setAttendeeModal({ ...emptyAttendee })}>Add Attendee</Button>
                  </PermissionGuard>
                  <PermissionGuard permission="canExcelBulkImports">
                    <Button size="sm" variant="outline" onClick={() => { setBulkUploadModal(true); }}>
                      <ArrowUpTrayIcon className="w-4 h-4 mr-2" />
                      Bulk Upload
                    </Button>
                  </PermissionGuard>
                </div>
              </div>

            <div className="px-5 mb-4 grid gap-3 md:grid-cols-4">
              <Input value={search} onChange={(e) => { setSearch(e.target.value); setQuery('search', e.target.value); }} placeholder="Search by name, email, phone" />
              <Select value={status} onChange={(e) => { setStatus(e.target.value); setQuery('status', e.target.value); }}>
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="rejected">Rejected</option>
              </Select>
              <Select value={category} onChange={(e) => { setCategory(e.target.value); setQuery('category', e.target.value); }}>
                <option value="">All categories</option>
                {categories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
              </Select>
              <Select value={params.get('limit') || '10'} onChange={(e) => setQuery('limit', e.target.value)}>
                <option value="10">10 rows</option>
                <option value="20">20 rows</option>
                <option value="50">50 rows</option>
              </Select>
            </div>

            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <thead>
                  <Tr><Th>Name</Th><Th>Category</Th><Th>Status</Th><Th>Photo</Th><Th>Actions</Th></Tr>
                </thead>
                <tbody>
                  {attendees.map((attendee) => {
                    const isBulkUploadAttendee = attendee?.addedVia === 'bulk_upload';
                    return (
                      <Tr key={attendee._id}>
                        <Td>
                          <p className="font-semibold text-slate-900">{attendee.fullName}</p>
                          <p className="text-xs text-slate-500">{attendee.email || attendee.phone || '-'}</p>
                        </Td>
                        <Td>{attendee.categoryName || '-'}</Td>
                        <Td>
                          <div className="flex flex-wrap gap-2">
                            <Badge color={statusColor[attendee.confirmationStatus] || 'gray'}>{attendee.confirmationStatus}</Badge>
                            {attendee.isDisabled && <Badge color="red">disabled</Badge>}
                          </div>
                        </Td>
                        <Td><Badge color={statusColor[attendee.photoVerificationStatus] || 'gray'}>{attendee.photoVerificationStatus}</Badge></Td>
                        <Td className="whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="sm" onClick={() => setAttendeeModal({ ...emptyAttendee, ...attendee })}>Edit</Button>
                            <Button variant="outline" size="sm" onClick={() => toggleAttendeeDisabled(attendee)}>{attendee.isDisabled ? 'Enable' : 'Disable'}</Button>
                            {isBulkUploadAttendee && (
                              <Button variant="outline" size="sm" className="text-rose-500 border-rose-100 hover:bg-rose-50" onClick={() => removeAttendee(attendee._id)}>Delete</Button>
                            )}
                            <Button variant="outline" size="sm" onClick={() => resendAttendeeInvite(attendee._id)}>Resend Invite</Button>
                          </div>
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
            <Pagination
              page={workspace?.attendees?.page}
              pages={workspace?.attendees?.pages}
              total={workspace?.attendees?.total}
              pageKey="page"
              updateQuery={setQuery}
            />
          </Card>
          </PermissionGuard>
        )}

        {activeSection === 'tickets' && (
          <PermissionGuard permission="canViewTickets" fallback={null}>
            <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden" padding={false}>
              <div className="flex flex-col gap-3 px-5 pt-5 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Ticket Management</h2>
                  <p className="text-sm text-slate-500">Categories, capacity, pricing & assignments</p>
                </div>
                <PermissionGuard permission="canEditTickets">
                  <Button onClick={() => setCategoryModal({ ...emptyCategory })} className="bg-teal-600 hover:bg-teal-500 shrink-0">
                    + Add Category
                  </Button>
                </PermissionGuard>
              </div>
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <thead>
                  <Tr>
                    <Th>Name</Th><Th>Price</Th><Th>Capacity</Th><Th>Sold</Th>
                    <Th>Assigned / Unassigned</Th><Th>Created By</Th><Th>Private Code</Th><Th>Actions</Th>
                  </Tr>
                </thead>
                <tbody>
                  {ticketPage.rows.map((ticket) => (
                    <Tr key={ticket.id}>
                      <Td className="font-medium text-slate-900">{ticket.name}</Td>
                      <Td>{selectedEvent?.settings?.currency || 'LKR'} {Number(ticket.price || 0).toLocaleString()}</Td>
                      <Td>{ticket.capacity}</Td>
                      <Td>{ticket.soldCount}</Td>
                      <Td>{ticket.assignedCount} / {ticket.unassignedCount}</Td>
                      <Td>{getTicketCreatorLabel(ticket)}</Td>
                      <Td>
                        {ticket.isPrivate
                          ? (canViewPrivateTicketCode(ticket) ? (ticket.accessCode || 'AUTO-GENERATED') : 'Hidden')
                          : '-'}
                      </Td>
                      <Td>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setCategoryModal(ticket)}>Edit</Button>
                          <Button variant="outline" size="sm" className="text-rose-500 border-rose-100 hover:bg-rose-50"
                            onClick={() => removeCategory(ticket.id)}>Delete</Button>
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
            {ticketPage.rows.length === 0 && (
              <div className="px-5 py-12 text-center text-sm text-slate-500">No ticket categories yet.</div>
            )}
            <Pagination {...ticketPage} updateQuery={setQuery} />
          </Card>
          </PermissionGuard>
        )}

        {activeSection === 'sponsor-packages' && (
          <div className="space-y-5">
            {/* Summary metrics */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  label: 'Packages',
                  value: sponsorPackages.length || 0,
                  accent: 'text-slate-900',
                  bg: 'bg-slate-50',
                  border: 'border-slate-200/80',
                },
                {
                  label: 'Visible',
                  value: sponsorPackages.filter((p) => p.isVisible).length || 0,
                  accent: 'text-emerald-600',
                  bg: 'bg-emerald-50/70',
                  border: 'border-emerald-100',
                },
                {
                  label: 'Sponsors',
                  value: sponsors.length || 0,
                  accent: 'text-teal-600',
                  bg: 'bg-teal-50/70',
                  border: 'border-teal-100',
                },
                {
                  label: 'Total Value',
                  value: `${selectedEvent?.settings?.currency || eventCurrency || 'LKR'} ${sponsorPackages
                    .reduce(
                      (sum, p) =>
                        sum + Number(p.price || 0) * Number(p.capacity || 1),
                      0
                    )
                    .toLocaleString()}`,
                  accent: 'text-teal-600',
                  bg: 'bg-teal-50/70',
                  border: 'border-teal-100',
                },
              ].map(({ label, value, accent, bg, border }) => (
                <div
                  key={label}
                  className={`rounded-2xl border ${border} ${bg} px-4 py-3.5 shadow-sm`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {label}
                  </p>
                  <p className={`mt-1 text-xl font-bold truncate ${accent}`}>
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <Card
              className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden"
              padding={false}
            >
              <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                    <BanknotesIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Sponsor Packages
                    </h2>
                    <p className="text-sm text-slate-500">
                      Create tiers and pricing for sponsors
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() =>
                    setSponsorPackageModal({ ...emptySponsorPackage })
                  }
                  className="bg-teal-600 hover:bg-teal-500 shrink-0"
                >
                  + Add Package
                </Button>
              </div>

              {/* Empty state OUTSIDE the table */}
              {sponsorPackages.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
                    <BanknotesIcon className="h-7 w-7" />
                  </div>
                  <p className="text-base font-semibold text-slate-800">
                    No packages yet
                  </p>
                  <p className="mt-1.5 max-w-sm text-sm text-slate-500">
                    Create a package to define pricing, capacity, and benefits for
                    sponsors.
                  </p>
                  <Button
                    onClick={() =>
                      setSponsorPackageModal({ ...emptySponsorPackage })
                    }
                    className="mt-6 bg-teal-600 hover:bg-teal-500"
                    size="sm"
                  >
                    + Create first package
                  </Button>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table className="min-w-[700px]">
                      <thead>
                        <Tr>
                          <Th>Name</Th>
                          <Th>Level</Th>
                          <Th>Price</Th>
                          <Th>Capacity</Th>
                          <Th>Visible</Th>
                          <Th className="text-right">Actions</Th>
                        </Tr>
                      </thead>
                      <tbody>
                        {sponsorPackagePage.rows.map((pkg) => {
                          const levelColor =
                            pkg.level === 'Platinum'
                              ? 'bg-slate-800 text-white'
                              : pkg.level === 'Gold'
                              ? 'bg-amber-100 text-amber-800'
                              : pkg.level === 'Silver'
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-teal-50 text-teal-700';

                          return (
                            <Tr key={pkg.id || pkg._id}>
                              <Td>
                                <p className="font-semibold text-slate-900">
                                  {pkg.name}
                                </p>
                                {pkg.description && (
                                  <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                                    {pkg.description}
                                  </p>
                                )}
                              </Td>
                              <Td>
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${levelColor}`}
                                >
                                  {pkg.level || 'Custom'}
                                </span>
                              </Td>
                              <Td className="font-medium text-slate-800">
                                {selectedEvent?.settings?.currency ||
                                  eventCurrency ||
                                  'LKR'}{' '}
                                {Number(pkg.price || 0).toLocaleString()}
                              </Td>
                              <Td>
                                <span className="rounded-full border border-slate-100 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600">
                                  {pkg.capacity}
                                </span>
                              </Td>
                              <Td>
                                <Badge color={pkg.isVisible ? 'green' : 'gray'}>
                                  {pkg.isVisible ? 'Yes' : 'No'}
                                </Badge>
                              </Td>
                              <Td className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-teal-200 text-teal-700 hover:bg-teal-50"
                                    onClick={() => setSponsorPackageModal(pkg)}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-rose-100 text-rose-500 hover:bg-rose-50"
                                    onClick={() =>
                                      setDeleteConfirm({
                                        type: 'package',
                                        id: pkg.id || pkg._id,
                                        label: pkg.name,
                                      })
                                    }
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </Td>
                            </Tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </div>
                  <Pagination {...sponsorPackagePage} updateQuery={setQuery} />
                </>
              )}
            </Card>
          </div>
        )}

        {activeSection === 'sponsors' && (
          <div className="space-y-5">
            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: 'Total Sponsors', value: sponsors.length || 0, accent: 'text-slate-900', bg: 'bg-slate-50', border: 'border-slate-200/80' },
                { label: 'Packages Used', value: new Set(sponsors.map((s) => s.packageId).filter(Boolean)).size, accent: 'text-teal-600', bg: 'bg-teal-50/70', border: 'border-teal-100' },
                { label: 'Available Packages', value: sponsorPackages.length || 0, accent: 'text-teal-600', bg: 'bg-teal-50/70', border: 'border-teal-100' },
              ].map(({ label, value, accent, bg, border }) => (
                <div key={label} className={`rounded-2xl border ${border} ${bg} px-4 py-3.5 shadow-sm`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                  <p className={`mt-1 text-2xl font-bold ${accent}`}>{value}</p>
                </div>
              ))}
            </div>

            <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden" padding={false}>
              {/* Header — always shown */}
              <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                    <UsersIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Manage Sponsors</h2>
                    <p className="text-sm text-slate-500">Onboard sponsors &amp; assign packages</p>
                  </div>
                </div>
                <Button
                  onClick={() =>
                    setSponsorModal({
                      ...emptySponsor,
                      packageId: sponsorPackages?.[0]?.id || '',
                    })
                  }
                  className="bg-teal-600 hover:bg-teal-500 shrink-0"
                  disabled={sponsorPackages.length === 0}
                >
                  + Add Sponsor
                </Button>
              </div>

              {/* Empty state — outside table so it centers properly */}
              {sponsors.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
                    <UsersIcon className="h-7 w-7" />
                  </div>
                  <p className="text-base font-semibold text-slate-800">No sponsors yet</p>
                  <p className="mt-1.5 max-w-sm text-sm text-slate-500">
                    {sponsorPackages.length === 0
                      ? 'Create a sponsor package first, then add sponsors.'
                      : 'Add your first sponsor and assign a package.'}
                  </p>
                  {sponsorPackages.length > 0 ? (
                    <Button
                      onClick={() =>
                        setSponsorModal({
                          ...emptySponsor,
                          packageId: sponsorPackages[0]?.id || '',
                        })
                      }
                      className="mt-6 bg-teal-600 hover:bg-teal-500"
                      size="sm"
                    >
                      + Add first sponsor
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setQuery('section', 'sponsor-packages')}
                      variant="outline"
                      className="mt-6"
                      size="sm"
                    >
                      Go to packages
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table className="min-w-[800px]">
                      <thead>
                        <Tr>
                          <Th>Company</Th>
                          <Th>Contact</Th>
                          <Th>Email</Th>
                          <Th>Phone</Th>
                          <Th>Package</Th>
                          <Th>Actions</Th>
                        </Tr>
                      </thead>
                      <tbody>
                        {sponsorPage.rows.map((sponsor) => {
                          const pkg = sponsorPackages.find((p) => p.id === sponsor.packageId);
                          const initials = (sponsor.companyName || '?')
                            .split(' ')
                            .map((w) => w[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase();
                          return (
                            <Tr key={sponsor._id}>
                              <Td>
                                <div className="flex items-center gap-2.5">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-teal-700">
                                    {initials}
                                  </div>
                                  <p className="font-semibold text-slate-900">{sponsor.companyName}</p>
                                </div>
                              </Td>
                              <Td className="text-sm text-slate-700">{sponsor.contactPerson}</Td>
                              <Td className="text-sm text-slate-600">{sponsor.email}</Td>
                              <Td className="text-sm text-slate-600">{sponsor.phone || '—'}</Td>
                              <Td>
                                {pkg ? (
                                  <span className="inline-flex rounded-full bg-teal-50 border border-teal-100 px-2.5 py-0.5 text-[11px] font-semibold text-teal-700">
                                    {pkg.name}
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400">{sponsor.packageId || '—'}</span>
                                )}
                              </Td>
                              <Td>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-rose-500 border-rose-100 hover:bg-rose-50"
                                  onClick={() =>
                                    setDeleteConfirm({
                                      type: 'sponsor',
                                      id: sponsor._id,
                                      label: sponsor.companyName,
                                    })
                                  }
                                >
                                  Delete
                                </Button>
                              </Td>
                            </Tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </div>
                  <Pagination {...sponsorPage} updateQuery={setQuery} />
                </>
              )}
            </Card>
          </div>
        )}

        {activeSection === 'suborganisers' && (
          <PermissionGuard permission="canViewUsers" fallback={null}>
            <div className="space-y-5">
            {/* Role summary metrics */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {[
                { label: 'Total', value: teamCounts.total, accent: 'text-slate-900', bg: 'bg-slate-50', border: 'border-slate-200/80' },
                { label: 'Sub-Organisers', value: teamCounts.SubOrganiser, accent: 'text-teal-600', bg: 'bg-teal-50/70', border: 'border-teal-100' },
                { label: 'Staff', value: teamCounts.Staff, accent: 'text-teal-600', bg: 'bg-teal-50/70', border: 'border-teal-100' },
                { label: 'Volunteers', value: teamCounts.Volunteer, accent: 'text-cyan-600', bg: 'bg-cyan-50/70', border: 'border-cyan-100' },
                { label: 'Auditors', value: teamCounts.Auditor, accent: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200/80' },
              ].map(({ label, value, accent, bg, border }) => (
                <div key={label} className={`rounded-2xl border ${border} ${bg} px-4 py-3.5 shadow-sm`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                  <p className={`mt-1 text-2xl font-bold ${accent}`}>{value || 0}</p>
                </div>
              ))}
            </div>

            {/* Toolbar */}
            <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                    <UsersIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Team Control Centre</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Roles, scopes &amp; delegation</p>
                  </div>
                </div>
                <Button
                  onClick={() => { setSubOrgForm(emptySubOrg); setSubOrgModal(true); }}
                  className="bg-teal-600 hover:bg-teal-500 shrink-0"
                >
                  + Create Team Member
                </Button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Input
                  value={teamSearch}
                  onChange={(e) => setTeamSearch(e.target.value)}
                  placeholder="Search name, email, phone..."
                />
                <Select value={teamRoleFilter} onChange={(e) => setTeamRoleFilter(e.target.value)}>
                  <option value="">All Roles</option>
                  <option value="SubOrganiser">Sub-Organisers</option>
                  <option value="Staff">Staff</option>
                  <option value="Volunteer">Volunteers</option>
                  <option value="Auditor">Auditors</option>
                </Select>
                <Select value={teamStatusFilter} onChange={(e) => setTeamStatusFilter(e.target.value)}>
                  <option value="">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </Select>
              </div>
            </Card>

            {filteredTeamMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-16 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
                  <UsersIcon className="h-7 w-7" />
                </div>
                <p className="text-base font-semibold text-slate-800">No team members match your filters</p>
                <p className="mt-1.5 max-w-sm text-sm text-slate-500">
                  Try adjusting search or filters, or create a new team member.
                </p>
                {(teamSearch || teamRoleFilter || teamStatusFilter) ? (
                  <button
                    type="button"
                    onClick={() => { setTeamSearch(''); setTeamRoleFilter(''); setTeamStatusFilter(''); }}
                    className="mt-5 text-sm font-bold text-teal-600 hover:underline"
                  >
                    Reset Filters
                  </button>
                ) : (
                  <Button
                    onClick={() => { setSubOrgForm(emptySubOrg); setSubOrgModal(true); }}
                    className="mt-5 bg-teal-600 hover:bg-teal-500"
                    size="sm"
                  >
                    + Create Team Member
                  </Button>
                )}
              </div>
            ) : (teamSearch || teamRoleFilter || teamStatusFilter) ? (
              <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden" padding={false}>
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/40 px-5 py-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Search Results</h2>
                    <p className="text-sm text-slate-500">{filteredTeamMembers.length} matching members</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <Table className="min-w-[800px]">
                    <thead>
                      <Tr>
                        <Th>Member</Th>
                        <Th>Role</Th>
                        <Th>Status</Th>
                        <Th>Scope</Th>
                        <Th>Actions</Th>
                      </Tr>
                    </thead>
                    <tbody>
                      {filteredTeamMembers.map((member) => {
                        const ownerName =
                          member.role !== 'SubOrganiser' &&
                          teamMembers.find((m) => m._id === (member.createdBy?._id || member.createdBy))?.name;
                        const initials = (member.name || '?')
                          .split(' ')
                          .map((p) => p[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase();
                        return (
                          <Tr key={member._id}>
                            <Td>
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-teal-700">
                                  {initials}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-900 truncate">{member.name}</p>
                                  <p className="text-xs text-slate-500 truncate">
                                    {member.email} · {member.phone}
                                  </p>
                                  {ownerName && (
                                    <p className="text-[10px] font-semibold text-teal-500 mt-0.5">
                                      Lead: {ownerName}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </Td>
                            <Td>
                              <span
                                className={`inline-flex text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                                  member.role === 'SubOrganiser'
                                    ? 'bg-teal-100 text-teal-700'
                                    : member.role === 'Staff'
                                    ? 'bg-teal-100 text-teal-700'
                                    : member.role === 'Volunteer'
                                    ? 'bg-cyan-100 text-cyan-700'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {member.role}
                              </span>
                            </Td>
                            <Td>
                              <Badge color={member.status === 'Active' ? 'green' : 'gray'}>
                                {member.status}
                              </Badge>
                            </Td>
                            <Td className="text-xs text-slate-600">
                              {/* Show only gates/zones that belong to current event */}
                              {(() => {
                                const currentEventGates = selectedEvent?.gates || [];
                                const currentEventZones = selectedEvent?.zones || [];
                                const memberGates = (member.assignedGates || []).filter(g =>
                                  currentEventGates.includes(g)
                                );
                                const memberZones = (member.assignedZones || []).filter(z =>
                                  currentEventZones.some(z2 => (z2.id || z2.name) === z)
                                );
                                const display = [...memberGates, ...memberZones];
                                return display.length > 0 ? display.join(', ') : 'General';
                              })()}
                            </Td>
                            <Td>
                              <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleEditTeamMember(member)}>
                                  Edit
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => toggleTeamMemberStatus(member)}>
                                  Toggle
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-rose-500 border-rose-100 hover:bg-rose-50"
                                  onClick={() => handleDeleteTeamMember(member)}
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </Button>
                              </div>
                            </Td>
                          </Tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              </Card>
            ) : (
              <div className="space-y-5">
                {groupedTeamMembers.groups.map(({ lead, members }) => {
                  const leadInitials = (lead.name || '?')
                    .split(' ')
                    .map((p) => p[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();
                  return (
                    <Card
                      key={lead._id}
                      className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all hover:border-teal-200 hover:shadow-md"
                    >
                      <div className="absolute inset-y-0 left-0 w-1 rounded-l-2xl bg-teal-500" />
                      <div className="pl-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between mb-4">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-50 text-sm font-bold text-teal-700 ring-2 ring-teal-100">
                              {leadInitials}
                            </div>
                            <div className="min-w-0">
                              <span className="inline-flex text-[10px] font-bold uppercase tracking-wider text-teal-600 bg-teal-50 border border-teal-100 px-2.5 py-0.5 rounded-full">
                                Sub-Organiser
                              </span>
                              <h3 className="mt-1.5 text-xl font-bold text-slate-900 truncate">{lead.name}</h3>
                              <p className="text-sm text-slate-500 truncate">
                                {lead.email} · {lead.phone}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Badge color={lead.status === 'Active' ? 'green' : 'gray'}>{lead.status}</Badge>
                                <span className="inline-flex items-center rounded-full bg-teal-50 border border-teal-100 px-2.5 py-0.5 text-[11px] font-semibold text-teal-700">
                                  {members.length} {members.length === 1 ? 'member' : 'members'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 shrink-0">
                            <Button variant="outline" size="sm" onClick={() => handleEditTeamMember(lead)}>
                              Edit
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => toggleTeamMemberStatus(lead)}>
                              Toggle
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-rose-500 border-rose-100 hover:bg-rose-50"
                              onClick={() => handleDeleteTeamMember(lead)}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {members.length > 0 && (
                          <div className="overflow-x-auto rounded-xl border border-slate-100">
                            <Table className="min-w-[700px]">
                              <thead>
                                <Tr>
                                  <Th>Member</Th>
                                  <Th>Role</Th>
                                  <Th>Scope</Th>
                                  <Th>Zones / Gates</Th>
                                  <Th>Actions</Th>
                                </Tr>
                              </thead>
                              <tbody>
                                {members.map((member) => {
                                  const mInitials = (member.name || '?')
                                    .split(' ')
                                    .map((p) => p[0])
                                    .join('')
                                    .slice(0, 2)
                                    .toUpperCase();
                                  return (
                                    <Tr key={member._id}>
                                      <Td>
                                        <div className="flex items-center gap-2.5">
                                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
                                            {mInitials}
                                          </div>
                                          <div className="min-w-0">
                                            <p className="font-semibold text-slate-900 truncate">{member.name}</p>
                                            <p className="text-xs text-slate-500 truncate">{member.email}</p>
                                          </div>
                                        </div>
                                      </Td>
                                      <Td>
                                        <span
                                          className={`inline-flex text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                                            member.role === 'Staff'
                                              ? 'bg-teal-100 text-teal-700'
                                              : member.role === 'Volunteer'
                                              ? 'bg-cyan-100 text-cyan-700'
                                              : 'bg-slate-100 text-slate-700'
                                          }`}
                                        >
                                          {member.role}
                                        </span>
                                      </Td>
                                      <Td>
                                        <div className="flex flex-wrap gap-1">
                                          {(member.assignedGates || []).filter(g =>
                                            (selectedEvent?.gates || []).includes(g)
                                          ).length > 0 && (
                                            <span className="rounded-full bg-teal-50 border border-teal-100 px-2 py-0.5 text-[10px] font-medium text-teal-700">
                                              Entry
                                            </span>
                                          )}
                                          {(member.assignedZones || []).filter(z =>
                                            (selectedEvent?.zones || []).some(z2 => (z2.id || z2.name) === z)
                                          ).length > 0 && (
                                            <span className="rounded-full bg-teal-50 border border-teal-100 px-2 py-0.5 text-[10px] font-medium text-teal-700">
                                              Zone
                                            </span>
                                          )}
                                          {!(member.assignedGates || []).filter(g =>
                                            (selectedEvent?.gates || []).includes(g)
                                          ).length && !(member.assignedZones || []).filter(z =>
                                            (selectedEvent?.zones || []).some(z2 => (z2.id || z2.name) === z)
                                          ).length && (
                                              <span className="text-xs text-slate-400">General</span>
                                            )}
                                        </div>
                                      </Td>
                                      <Td className="text-xs text-slate-600">
                                        {[
                                          (member.assignedGates || []).filter(g =>
                                            (selectedEvent?.gates || []).includes(g)
                                          ).length
                                            ? `Gates: ${(member.assignedGates || []).filter(g =>
                                                (selectedEvent?.gates || []).includes(g)
                                              ).join(', ')}`
                                            : '',
                                          (member.assignedZones || []).filter(z =>
                                            (selectedEvent?.zones || []).some(z2 => (z2.id || z2.name) === z)
                                          ).length
                                            ? `Zones: ${(member.assignedZones || []).filter(z =>
                                                (selectedEvent?.zones || []).some(z2 => (z2.id || z2.name) === z)
                                              ).join(', ')}`
                                            : '',
                                        ]
                                          .filter(Boolean)
                                          .join(' | ') || 'No zone access'}
                                      </Td>
                                      <Td>
                                        <div className="flex flex-wrap gap-2">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleEditTeamMember(member)}
                                          >
                                            Edit
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => toggleTeamMemberStatus(member)}
                                          >
                                            Toggle
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-rose-500 border-rose-100 hover:bg-rose-50"
                                            onClick={() => handleDeleteTeamMember(member)}
                                          >
                                            <TrashIcon className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </Td>
                                    </Tr>
                                  );
                                })}
                              </tbody>
                            </Table>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}

                {groupedTeamMembers.directMembers.length > 0 && (
                  <Card
                    className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden"
                    padding={false}
                  >
                    <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/40 px-5 py-4">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                        <UsersIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">Direct Event Team</h2>
                        <p className="text-sm text-slate-500">Assigned by Main Organiser</p>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <Table className="min-w-[700px]">
                        <thead>
                          <Tr>
                            <Th>Member</Th>
                            <Th>Role</Th>
                            <Th>Status</Th>
                            <Th>Scope</Th>
                            <Th>Actions</Th>
                          </Tr>
                        </thead>
                        <tbody>
                          {groupedTeamMembers.directMembers.map((member) => {
                            const dInitials = (member.name || '?')
                              .split(' ')
                              .map((p) => p[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase();
                            return (
                              <Tr key={member._id}>
                                <Td>
                                  <div className="flex items-center gap-2.5">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
                                      {dInitials}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-semibold text-slate-900 truncate">{member.name}</p>
                                      <p className="text-xs text-slate-500 truncate">{member.email}</p>
                                    </div>
                                  </div>
                                </Td>
                                <Td>
                                  <span
                                    className={`inline-flex text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                                      member.role === 'Staff'
                                        ? 'bg-teal-100 text-teal-700'
                                        : member.role === 'Volunteer'
                                        ? 'bg-cyan-100 text-cyan-700'
                                        : 'bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    {member.role}
                                  </span>
                                </Td>
                                <Td>
                                  <Badge color={member.status === 'Active' ? 'green' : 'gray'}>
                                    {member.status}
                                  </Badge>
                                </Td>
                                <Td className="text-xs text-slate-600">
                                  {[
                                    (member.assignedGates || []).filter(g =>
                                      (selectedEvent?.gates || []).includes(g)
                                    ).length
                                      ? `Gates: ${(member.assignedGates || []).filter(g =>
                                          (selectedEvent?.gates || []).includes(g)
                                        ).join(', ')}`
                                      : '',
                                    (member.assignedZones || []).filter(z =>
                                      (selectedEvent?.zones || []).some(z2 => (z2.id || z2.name) === z)
                                    ).length
                                      ? `Zones: ${(member.assignedZones || []).filter(z =>
                                          (selectedEvent?.zones || []).some(z2 => (z2.id || z2.name) === z)
                                        ).join(', ')}`
                                      : '',
                                  ]
                                    .filter(Boolean)
                                    .join(' | ') || 'No zone access'}
                                </Td>
                                <Td>
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleEditTeamMember(member)}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => toggleTeamMemberStatus(member)}
                                    >
                                      Toggle
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-rose-500 border-rose-100 hover:bg-rose-50"
                                      onClick={() => handleDeleteTeamMember(member)}
                                    >
                                      <TrashIcon className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </Td>
                              </Tr>
                            );
                          })}
                        </tbody>
                      </Table>
                    </div>
                  </Card>
                )}
              </div>
            )}

            <Pagination
              page={workspace?.teamPage}
              pages={workspace?.teamPages}
              total={workspace?.teamTotal}
              pageKey="teamPage"
              updateQuery={setQuery}
            />
          </div>
          </PermissionGuard>
        )}

        {activeSection === 'verification' && (
          <PermissionGuard permission="canPhotoVerification" fallback={null}>
            <div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {verificationQueue.map((attendee) => (
                <Card key={attendee._id} className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                  <div className="h-44 overflow-hidden rounded-xl bg-slate-100">
                    {attendee.photo
                      ? <img src={attendee.photo} alt={attendee.fullName} className="h-full w-full object-cover" />
                      : <div className="flex h-full items-center justify-center text-sm text-slate-400">No photo</div>}
                  </div>
                  <h3 className="mt-3 font-semibold text-slate-900">{attendee.fullName}</h3>
                  <p className="text-sm text-slate-500 truncate">{attendee.email || attendee.phone || '-'}</p>
                  <div className="mt-3 flex gap-2">
                    <Button className="flex-1 bg-teal-600 hover:bg-teal-500" onClick={() => approveVerification(attendee._id)}>Approve</Button>
                    <Button variant="outline" className="flex-1 text-rose-500 border-rose-100 hover:bg-rose-50" onClick={() => setRejecting(attendee)}>Reject</Button>
                  </div>
                </Card>
              ))}
              {verificationQueue.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
                  No pending photo verifications.
                </div>
              )}
            </div>
            <Pagination page={workspace?.verificationPage} pages={workspace?.verificationPages} total={workspace?.verificationTotal} pageKey="verificationPage" updateQuery={setQuery} />
          </div>
          </PermissionGuard>
        )}

        {activeSection === 'invites' && (
          <PermissionGuard permission="canSendInvitations" fallback={null}>
            <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden" padding={false}>
            <div className="px-5 pt-5 pb-3">
              <h2 className="text-lg font-bold text-slate-900">Invite Management</h2>
              <p className="text-sm text-slate-500">Pending, accepted & declined</p>
            </div>
            <div className="overflow-x-auto">
              <Table className="min-w-[800px]">
                <thead><Tr><Th>Attendee</Th><Th>Category</Th><Th>Status</Th><Th>History</Th><Th>Actions</Th></Tr></thead>
                <tbody>
                  {invites.map((invite) => (
                    <Tr key={invite._id}>
                      <Td>
                        <p className="font-medium text-slate-900">{invite.attendee?.fullName || 'Unassigned'}</p>
                        <p className="text-xs text-slate-500">{invite.attendee?.email || '-'}</p>
                      </Td>
                      <Td>{invite.categoryName}</Td>
                      <Td><Badge color={statusColor[invite.inviteStatus] || 'gray'}>{invite.inviteStatus}</Badge></Td>
                      <Td className="text-xs text-slate-500">
                        {invite.inviteHistory?.map((item) => `${item.type} ${formatDistanceToNow(new Date(item.at), { addSuffix: true })}`).join(' · ') || 'No history'}
                      </Td>
                      <Td>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => doResendInvite(invite._id)}>Resend</Button>
                          <Button variant="outline" size="sm" className="text-rose-500 border-rose-100 hover:bg-rose-50" onClick={() => doCancelInvite(invite._id)}>Cancel</Button>
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
            {invites.length === 0 && <div className="px-5 py-12 text-center text-sm text-slate-500">No invites yet.</div>}
            <Pagination page={workspace?.invitesPage} pages={workspace?.invitesPages} pageKey="invitesPage" updateQuery={setQuery} />
          </Card>
          </PermissionGuard>
        )}

        {activeSection === 'logs' && (
          <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden" padding={false}>
            <div className="px-5 pt-5 pb-3">
              <h2 className="text-lg font-bold text-slate-900">Entry Logs</h2>
              <p className="text-sm text-slate-500">Real-time access activity</p>
            </div>
            <div className="overflow-x-auto">
              <Table className="min-w-[700px]">
                <thead><Tr><Th>Name</Th><Th>Time</Th><Th>Gate</Th><Th>Status</Th></Tr></thead>
                <tbody>
                  {(workspace?.entryLogs || []).map((log) => (
                    <Tr key={log._id}>
                      <Td>{log.attendee?.fullName || log.snapshot?.fullName || '-'}</Td>
                      <Td className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleString()}</Td>
                      <Td>{log.gateName || log.zoneName || '-'}</Td>
                      <Td><Badge color={log.accessGranted ? 'green' : 'red'}>{log.accessGranted ? 'Allowed' : 'Denied'}</Badge></Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <Pagination page={workspace?.entryLogsPage} pages={workspace?.entryLogsPages} pageKey="entryLogsPage" updateQuery={setQuery} />
          </Card>
        )}

        {activeSection === 'system-logs' && (
          <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden" padding={false}>
            <div className="px-5 pt-5 pb-3">
              <h2 className="text-lg font-bold text-slate-900">Activity Logs</h2>
              <p className="text-sm text-slate-500">All recent operations</p>
            </div>
            <div className="overflow-x-auto">
              <Table className="min-w-[700px]">
                <thead><Tr><Th>Event</Th><Th>Details</Th><Th>Time</Th></Tr></thead>
                <tbody>
                  {activityFeedPage.rows.map((item) => (
                    <Tr key={item.id}>
                      <Td className="font-medium text-slate-900">{item.title}</Td>
                      <Td className="text-sm text-slate-600">{item.message}</Td>
                      <Td className="text-xs text-slate-500">{new Date(item.timestamp).toLocaleString()}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <Pagination {...activityFeedPage} updateQuery={setQuery} />
          </Card>
        )}

        {activeSection === 'rfid-assignments' && (
          <div className="space-y-5">
            <RfidAssignmentView embedded />
          </div>
        )}

        {activeSection === 'zones' && (
          <PermissionGuard permission="canViewZones" fallback={null}>
            <div className="space-y-5">
            {/* Summary strip */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  label: 'Total Zones',
                  value: selectedEvent?.zones?.length || 0,
                  accent: 'text-slate-900',
                  bg: 'bg-slate-50',
                  border: 'border-slate-200/80',
                },
                {
                  label: 'Ticket Categories',
                  value: categories.length || 0,
                  accent: 'text-teal-600',
                  bg: 'bg-teal-50/70',
                  border: 'border-teal-100',
                },
                {
                  label: 'Assignments',
                  value: Object.values(zoneAssignments).reduce((sum, ids) => sum + (ids?.length || 0), 0),
                  accent: 'text-teal-600',
                  bg: 'bg-teal-50/70',
                  border: 'border-teal-100',
                },
                {
                  label: 'Zone Logs',
                  value: zoneLogs.length || 0,
                  accent: 'text-teal-600',
                  bg: 'bg-teal-50/70',
                  border: 'border-teal-100',
                },
              ].map(({ label, value, accent, bg, border }) => (
                <div
                  key={label}
                  className={`rounded-2xl border ${border} ${bg} px-4 py-3.5 shadow-sm`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                  <p className={`mt-1 text-2xl font-bold ${accent}`}>{value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-5 xl:grid-cols-[1fr_1.05fr]">
              {/* Zone Access Control */}
              <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <CardHeader
                  title="Zone Access Control"
                  subtitle="Define areas and map ticket categories to them"
                  action={
                    <Button
                      onClick={() => setZoneModal({ ...emptyZone })}
                      className="bg-teal-600 hover:bg-teal-500"
                      size="sm"
                    >
                      + Add Zone
                    </Button>
                  }
                />

                <div className="space-y-3">
                  {(selectedEvent?.zones || []).map((zone) => {
                    const assignedIds = zoneAssignments[zone.id] || [];
                    const assignedCount = assignedIds.length;
                    const zoneColor = zone.color || '#2563eb';

                    return (
                      <div
                        key={zone.id}
                        className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 transition-all hover:border-teal-200 hover:shadow-md"
                      >
                        {/* Left color accent bar */}
                        <div
                          className="absolute inset-y-0 left-0 w-1 rounded-l-2xl"
                          style={{ backgroundColor: zoneColor }}
                        />

                        <div className="pl-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className="inline-flex h-3 w-3 shrink-0 rounded-full ring-2 ring-white shadow-sm"
                                  style={{ backgroundColor: zoneColor }}
                                  title={zoneColor}
                                />
                                <p className="truncate text-base font-bold text-slate-900">{zone.name}</p>
                                {zone.capacity > 0 && (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                    Cap {zone.capacity}
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-sm text-slate-500 line-clamp-1">
                                {zone.description || 'No description'}
                              </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-1.5">
                              <span className="mr-1 hidden rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold text-teal-700 sm:inline-flex">
                                {assignedCount} {assignedCount === 1 ? 'category' : 'categories'}
                              </span>
                              <Button variant="outline" size="sm" onClick={() => setZoneModal(zone)}>
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-rose-500 border-rose-100 hover:bg-rose-50"
                                onClick={() => removeZone(zone.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>

                          {/* Category assignment chips */}
                          <div className="mt-3.5">
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Allowed ticket categories
                            </p>
                            {categories.length === 0 ? (
                              <p className="text-xs italic text-slate-400">No ticket categories yet</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {categories.map((ticket) => {
                                  const isAssigned = assignedIds.includes(ticket.id);
                                  return (
                                    <label
                                      key={ticket.id}
                                      className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                                        isAssigned
                                          ? 'border-teal-200 bg-teal-50 text-teal-800 shadow-sm'
                                          : 'border-slate-200 bg-slate-50/80 text-slate-600 hover:border-teal-200 hover:bg-teal-50/50 hover:text-teal-700'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isAssigned}
                                        onChange={(e) =>
                                          updateZoneAssignment(zone.id, ticket.id, e.target.checked)
                                        }
                                        className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                      />
                                      {ticket.name}
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {(selectedEvent?.zones || []).length === 0 && (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-14 text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
                        <MapPinIcon className="h-6 w-6" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">No zones configured yet</p>
                      <p className="mt-1 max-w-xs text-xs text-slate-500">
                        Create zones to control which ticket categories can access specific areas of the venue.
                      </p>
                      <Button
                        onClick={() => setZoneModal({ ...emptyZone })}
                        className="mt-5 bg-teal-600 hover:bg-teal-500"
                        size="sm"
                      >
                        + Create first zone
                      </Button>
                    </div>
                  )}
                </div>
              </Card>

              {/* Zone Logs */}
              <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden" padding={false}>
                <div className="flex flex-col gap-1 border-b border-slate-100 bg-slate-50/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Zone Logs</h2>
                    <p className="text-sm text-slate-500">Entry and exit activity by zone</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Live
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <Table className="min-w-[600px]">
                    <thead>
                      <Tr>
                        <Th>Attendee</Th>
                        <Th>Zone</Th>
                        <Th>Action</Th>
                        <Th>Time</Th>
                      </Tr>
                    </thead>
                    <tbody>
                      {zoneLogs.length === 0 ? (
                        <Tr>
                          <Td colSpan={4} className="py-12 text-center text-sm text-slate-500">
                            No zone activity recorded yet.
                          </Td>
                        </Tr>
                      ) : (
                        zoneLogs.map((log) => (
                          <Tr key={log._id}>
                            <Td className="font-medium text-slate-900">
                              {log.attendeeId?.fullName || '-'}
                            </Td>
                            <Td>
                              <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
                                <MapPinIcon className="h-3 w-3 text-slate-400" />
                                {log.zoneName || '-'}
                              </span>
                            </Td>
                            <Td>
                              <Badge color={log.action === 'ENTRY' ? 'blue' : 'gray'}>
                                {log.action}
                              </Badge>
                            </Td>
                            <Td className="text-xs text-slate-500">
                              {new Date(log.timestamp).toLocaleString()}
                            </Td>
                          </Tr>
                        ))
                      )}
                    </tbody>
                  </Table>
                </div>
                <Pagination
                  page={workspace?.zoneLogsPage}
                  pages={workspace?.zoneLogsPages}
                  pageKey="zoneLogsPage"
                  updateQuery={setQuery}
                />
              </Card>
            </div>
          </div>
          </PermissionGuard>
        )}

        {activeSection === 'reports' && (
          <PermissionGuard permission="canViewReports" fallback={null}>
            <div className="space-y-6">
            {/* Header Section */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Reports & Analytics</h2>
                <p className="text-sm text-slate-500 mt-1">Export comprehensive data for analysis and reporting</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg">
                  <div className={`w-2 h-2 rounded-full ${autoUpdateEnabled ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
                  <span className="font-medium">Auto-update: {autoUpdateEnabled ? 'Active' : 'Paused'}</span>
                  <span className="text-slate-400">•</span>
                  <span>Every {autoUpdateInterval / 1000}s</span>
                  <span className="text-slate-400">•</span>
                  <span>Last: {lastUpdateTime.toLocaleTimeString()}</span>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setAutoUpdateEnabled(!autoUpdateEnabled)}
                    className="flex items-center gap-2"
                  >
                    {autoUpdateEnabled ? (
                      <>
                        <ClockIcon className="w-4 h-4" />
                        Pause
                      </>
                    ) : (
                      <>
                        <ClockIcon className="w-4 h-4" />
                        Resume
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleManualRefresh}
                    className="flex items-center gap-2"
                  >
                    <ArrowPathIcon className="w-4 h-4" />
                    Refresh
                  </Button>
                </div>
              </div>
            </div>

            {/* Enhanced Analytics Overview */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
              {[
                { label: 'Total Reports', value: (workspace?.reports?.available || []).length, icon: DocumentIcon, color: 'text-teal-600 bg-teal-50' },
                { label: 'Total Attendees', value: eventStats?.totalAttendees || 0, icon: UserGroupIcon, color: 'text-green-600 bg-green-50' },
                { label: 'Revenue', value: formatCurrency(eventStats?.revenue || 0), icon: CurrencyDollarIcon, color: 'text-amber-600 bg-amber-50' },
                { label: 'Checked In', value: eventStats?.checkedIn || 0, icon: CheckBadgeIcon, color: 'text-purple-600 bg-purple-50' },
                { label: 'Tickets Sold', value: eventStats?.ticketsSold || 0, icon: TicketIcon, color: 'text-cyan-600 bg-cyan-50' },
                { label: 'Available', value: eventStats?.ticketsAvailable || 0, icon: FireIcon, color: 'text-rose-600 bg-rose-50' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${color} mb-2`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
                </div>
              ))}
            </div>

            {/* Performance Metrics */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { 
                  label: 'Confirmation Rate', 
                  value: `${eventStats?.confirmationRate || 0}%`, 
                  icon: CheckBadgeIcon, 
                  color: eventStats?.confirmationRate >= 80 ? 'text-green-600 bg-green-50' : eventStats?.confirmationRate >= 50 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50',
                  description: 'Confirmed attendees vs sold tickets'
                },
                { 
                  label: 'Check-in Rate', 
                  value: `${eventStats?.checkInRate || 0}%`, 
                  icon: UsersIcon, 
                  color: eventStats?.checkInRate >= 80 ? 'text-green-600 bg-green-50' : eventStats?.checkInRate >= 50 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50',
                  description: 'Checked-in vs confirmed attendees'
                },
                { 
                  label: 'Ticket Sales', 
                  value: totalTicketsCount > 0 ? `${((ticketsSoldCount / totalTicketsCount) * 100).toFixed(1)}%` : '0%', 
                  icon: TicketIcon, 
                  color: 'text-teal-600 bg-teal-50',
                  description: 'Sold vs total available tickets'
                },
                { 
                  label: 'Revenue per Ticket', 
                  value: ticketsSoldCount > 0 ? formatCurrency(eventStats?.revenue / ticketsSoldCount) : formatCurrency(0), 
                  icon: CurrencyDollarIcon, 
                  color: 'text-purple-600 bg-purple-50',
                  description: 'Average revenue per sold ticket'
                },
              ].map(({ label, value, icon: Icon, color, description }) => (
                <div key={label} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs text-slate-400">{description}</span>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
                </div>
              ))}
            </div>

            {/* Revenue Analytics */}
            <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Revenue Analytics</h3>
                  <p className="text-sm text-slate-500">Financial performance breakdown</p>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${eventStats?.revenue > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                  <CurrencyDollarIcon className="w-4 h-4" />
                  <span className="text-sm font-semibold">{formatCurrency(eventStats?.revenue || 0)}</span>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Potential Revenue</p>
                  <p className="text-lg font-bold text-slate-900">{formatCurrency((totalTicketsCount || 0) * calculateAverageTicketPrice())}</p>
                  <p className="text-xs text-slate-400 mt-1">Based on avg ticket price</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Revenue Achievement</p>
                  <p className="text-lg font-bold text-slate-900">
                    {(totalTicketsCount || 0) > 0 ? ((eventStats?.revenue / ((totalTicketsCount || 0) * calculateAverageTicketPrice())) * 100).toFixed(1) : 0}%
                  </p>
                  <p className="text-xs text-slate-400 mt-1">vs potential revenue</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">Tickets Remaining</p>
                  <p className="text-lg font-bold text-slate-900">{eventStats?.ticketsAvailable || 0}</p>
                  <p className="text-xs text-slate-400 mt-1">Available for sale</p>
                </div>
              </div>
            </Card>

            {/* Attendee Analytics */}
            <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Attendee Analytics</h3>
                  <p className="text-sm text-slate-500">Registration and engagement metrics</p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-center gap-3 p-3 bg-teal-50 rounded-xl">
                  <div className="flex items-center justify-center w-10 h-10 bg-teal-100 rounded-lg">
                    <UserGroupIcon className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Total Registered</p>
                    <p className="text-lg font-bold text-slate-900">{confirmedAttendeesCount}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl">
                  <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-lg">
                    <CheckBadgeIcon className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Confirmed</p>
                    <p className="text-lg font-bold text-slate-900">{confirmedAttendeesCount}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-xl">
                  <div className="flex items-center justify-center w-10 h-10 bg-purple-100 rounded-lg">
                    <UsersIcon className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Checked In</p>
                    <p className="text-lg font-bold text-slate-900">{checkedInCount}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl">
                  <div className="flex items-center justify-center w-10 h-10 bg-amber-100 rounded-lg">
                    <ClockIcon className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Pending</p>
                    <p className="text-lg font-bold text-slate-900">{ticketsSoldCount - confirmedAttendeesCount}</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Ticket Category Analytics */}
            {categories.length > 0 && (
              <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Ticket Category Performance</h3>
                    <p className="text-sm text-slate-500">Sales breakdown by ticket type</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {categories.slice(0, 5).map((category) => {
                    const soldCount = category.soldCount || category.quantitySold || 0;
                    const totalCount = category.totalTickets || category.quantity || category.capacity || 0;
                    const percentage = totalCount > 0 ? ((soldCount / totalCount) * 100).toFixed(1) : 0;
                    const revenue = soldCount * (category.price || 0);
                    
                    return (
                      <div key={category._id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="font-semibold text-slate-900">{category.name}</p>
                              <p className="text-xs text-slate-500">{category.description || 'Standard ticket'}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-slate-900">{formatCurrency(revenue)}</p>
                              <p className="text-xs text-slate-500">{soldCount}/{totalCount} sold</p>
                            </div>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2">
                            <div 
                              className="bg-teal-600 h-2 rounded-full transition-all" 
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{percentage}% sold</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Reports Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(workspace?.reports?.available || []).map((report) => {
                const reportIcons = {
                  'attendees': UserGroupIcon,
                  'revenue': CurrencyDollarIcon,
                  'tickets': TicketIcon,
                  'entry_logs': CheckBadgeIcon,
                  'zones': MapPinIcon,
                  'activity': ClockIcon,
                  'financial': ChartBarIcon,
                  'overview': ChartPieIcon,
                };
                const ReportIcon = reportIcons[report.id] || DocumentIcon;
                
                const reportDescriptions = {
                  'attendees': 'Complete attendee list with contact details, confirmation status, and ticket information',
                  'revenue': 'Financial breakdown including ticket sales, revenue by category, and payment methods',
                  'tickets': 'Ticket inventory report showing available, sold, and reserved tickets by category',
                  'entry_logs': 'Detailed check-in logs with timestamps, gate access, and verification status',
                  'zones': 'Zone utilization report showing attendance by area and checkpoint activity',
                  'activity': 'User activity logs showing system actions, modifications, and access patterns',
                  'financial': 'Comprehensive financial report with revenue trends, payment analysis, and refund tracking',
                  'overview': 'Executive summary with key metrics, attendance trends, and performance indicators',
                };
                
                const reportSizes = {
                  'attendees': '~500KB',
                  'revenue': '~200KB',
                  'tickets': '~300KB',
                  'entry_logs': '~400KB',
                  'zones': '~150KB',
                  'activity': '~250KB',
                  'financial': '~350KB',
                  'overview': '~100KB',
                };
                
                const reportCategories = {
                  'attendees': 'Attendance',
                  'revenue': 'Financial',
                  'tickets': 'Inventory',
                  'entry_logs': 'Operations',
                  'zones': 'Operations',
                  'activity': 'System',
                  'financial': 'Financial',
                  'overview': 'Executive',
                };
                
                const reportColors = {
                  'attendees': 'text-teal-600 bg-teal-50 border-teal-100',
                  'revenue': 'text-green-600 bg-green-50 border-green-100',
                  'tickets': 'text-purple-600 bg-purple-50 border-purple-100',
                  'entry_logs': 'text-amber-600 bg-amber-50 border-amber-100',
                  'zones': 'text-cyan-600 bg-cyan-50 border-cyan-100',
                  'activity': 'text-rose-600 bg-rose-50 border-rose-100',
                  'financial': 'text-teal-600 bg-teal-50 border-teal-100',
                  'overview': 'text-emerald-600 bg-emerald-50 border-emerald-100',
                };
                
                const colorClass = reportColors[report.id] || 'text-slate-600 bg-slate-50 border-slate-100';
                
                return (
                  <Card key={report.id} className="rounded-2xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${colorClass}`}>
                        <ReportIcon className="w-6 h-6" />
                      </div>
                      <div className="flex gap-2">
                        <Badge color="blue" size="sm">CSV</Badge>
                        <Badge color="slate" size="sm">{reportCategories[report.id] || 'General'}</Badge>
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{report.label}</h3>
                    <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                      {reportDescriptions[report.id] || 'Export detailed data for analysis and reporting'}
                    </p>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
                      <div className="flex items-center gap-2">
                        <ClockIcon className="w-4 h-4" />
                        <span>Updated: {new Date().toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <DocumentIcon className="w-3 h-3" />
                        <span>{reportSizes[report.id] || '~100KB'}</span>
                      </div>
                    </div>
                    <PermissionGuard permission="canExportReports">
                      <Button 
                        onClick={() => doExport(report)} 
                        className="w-full bg-teal-600 hover:bg-teal-500 flex items-center justify-center gap-2"
                      >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        Export Report
                      </Button>
                    </PermissionGuard>
                  </Card>
                );
              })}
            </div>

            {(workspace?.reports?.available || []).length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
                <div className="flex justify-center mb-4">
                  <DocumentIcon className="w-12 h-12 text-slate-300" />
                </div>
                <p className="text-slate-500 font-medium mb-2">No reports available yet</p>
                <p className="text-sm text-slate-400">Reports will be generated once event data is available</p>
              </div>
            )}
          </div>
          </PermissionGuard>
        )}

        {activeSection === 'payments' && (
          <PermissionGuard permission="canViewPayments" fallback={null}>
            <PaymentsDashboard
              eventId={eventId}
              currency={
                selectedEvent?.settings?.currency ||
                workspace?.event?.settings?.currency ||
                'LKR'
              }
            />
          </PermissionGuard>
        )}

        {activeSection === 'notifications' && (
          <PermissionGuard permission="canSendNotifications" fallback={null}>
            <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden" padding={false}>
            <div className="px-5 pt-5 pb-3">
              <h2 className="text-lg font-bold text-slate-900">Notifications</h2>
              <p className="text-sm text-slate-500">Email & SMS activity</p>
            </div>
            <div className="overflow-x-auto">
              <Table className="min-w-[700px]">
                <thead><Tr><Th>Title</Th><Th>Message</Th><Th>Channel</Th><Th>Actions</Th></Tr></thead>
                <tbody>
                  {notifications.map((item) => (
                    <Tr key={item._id}>
                      <Td className="font-medium text-slate-900">{item.title}</Td>
                      <Td className="text-sm text-slate-600 max-w-[220px] truncate">{item.message}</Td>
                      <Td>{item.metadata?.channel || 'email_sms'}</Td>
                      <Td>
                        <Button variant="outline" size="sm" onClick={() => doResendNotification(item._id)}>Resend</Button>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
            {notifications.length === 0 && <div className="px-5 py-12 text-center text-sm text-slate-500">No notifications yet.</div>}
            <Pagination page={workspace?.notificationsPage} pages={workspace?.notificationsPages} pageKey="notificationsPage" updateQuery={setQuery} />
          </Card>
          </PermissionGuard>
        )}

        {activeSection === 'settings' && settingsForm && (
          <PermissionGuard permission="canEditEvents" fallback={null}>
            <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <CardHeader
              title="Event Settings"
              subtitle="Templates and organiser limits"
              action={<Button onClick={saveSettings} className="bg-teal-600 hover:bg-teal-500">Save Settings</Button>}
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Invite email template">
                <textarea rows={5} value={settingsForm.emailTemplates?.invite || ''}
                  onChange={(e) => setSettingsForm((c) => ({ ...c, emailTemplates: { ...(c.emailTemplates || {}), invite: e.target.value } }))}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20" />
              </Field>
              <Field label="Invite SMS template">
                <textarea rows={5} value={settingsForm.smsTemplates?.invite || ''}
                  onChange={(e) => setSettingsForm((c) => ({ ...c, smsTemplates: { ...(c.smsTemplates || {}), invite: e.target.value } }))}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20" />
              </Field>
              <Field label="Invite limit per attendee">
                <Input type="number" value={settingsForm.inviteLimitPerAttendee || 3}
                  onChange={(e) => setSettingsForm((c) => ({ ...c, inviteLimitPerAttendee: Number(e.target.value) }))} />
              </Field>
              <Field label="Max tickets per order">
                <Input type="number" value={settingsForm.maxTicketsPerOrder || 10}
                  onChange={(e) => setSettingsForm((c) => ({ ...c, maxTicketsPerOrder: Number(e.target.value) }))} />
              </Field>
            </div>
          </Card>
          </PermissionGuard>
        )}
      </div>

      
      <Modal
        open={!!attendeeModal}
        onClose={() => setAttendeeModal(null)}
        title={attendeeModal?._id || attendeeModal?.id ? 'Edit Attendee' : 'Add Attendee'}
        size="lg"
      >
        {attendeeModal && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full name">
                <Input
                  value={attendeeModal.fullName || ''}
                  onChange={(e) => setAttendeeModal((c) => ({ ...c, fullName: e.target.value }))}
                  placeholder="Full name"
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={attendeeModal.email || ''}
                  onChange={(e) => setAttendeeModal((c) => ({ ...c, email: e.target.value }))}
                  placeholder="Email"
                />
              </Field>
              <Field label="Phone">
                <Input
                  value={attendeeModal.phone || ''}
                  onChange={(e) => setAttendeeModal((c) => ({ ...c, phone: e.target.value }))}
                  placeholder="Phone"
                />
              </Field>
              <Field label="National ID">
                <Input
                  value={attendeeModal.nationalId || ''}
                  onChange={(e) => setAttendeeModal((c) => ({ ...c, nationalId: e.target.value }))}
                  placeholder="National ID"
                />
              </Field>
              <Field label="Category">
                <Select
                  value={attendeeModal.categoryId || ''}
                  onChange={(e) => setAttendeeModal((c) => ({ ...c, categoryId: e.target.value }))}
                >
                  <option value="">Select category</option>
                  {categories.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Notes">
              <textarea
                rows={3}
                value={attendeeModal.notes || ''}
                onChange={(e) => setAttendeeModal((c) => ({ ...c, notes: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                placeholder="Optional notes"
              />
            </Field>
            {!(attendeeModal._id || attendeeModal.id) && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                Single attendee creation is not available via this form. Use <strong>Bulk Upload</strong> to add new attendees, or edit an existing one.
              </p>
            )}
            <div className="flex gap-3 border-t border-slate-100 pt-4">
              <Button
                className="flex-1 bg-teal-600 hover:bg-teal-500 py-2.5"
                onClick={saveAttendee}
                disabled={!(attendeeModal._id || attendeeModal.id)}
              >
                Save changes
              </Button>
              <Button variant="outline" className="flex-1 py-2.5" onClick={() => setAttendeeModal(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={bulkUploadModal}
        onClose={() => {
          setBulkUploadModal(false);
          setBulkUploadFile(null);
        }}
        title="Bulk Upload Attendees"
        size="md"
      >
        <div className="space-y-5">
          <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-4">
            <p className="text-sm font-semibold text-teal-900">Upload a spreadsheet</p>
            <p className="mt-1 text-xs text-teal-700">
              Use the template CSV/Excel format. Required columns typically include name, email, phone, and category.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
              Download template
            </Button>
          </div>
          <Field label="File">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setBulkUploadFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-teal-700 hover:file:bg-teal-100"
            />
          </Field>
          {bulkUploadFile && (
            <p className="text-xs text-slate-500">Selected: {bulkUploadFile.name}</p>
          )}
          <div className="flex gap-3 border-t border-slate-100 pt-4">
            <Button
              className="flex-1 bg-teal-600 hover:bg-teal-500 py-2.5"
              onClick={() => handleBulkUpload(bulkUploadFile)}
              disabled={!bulkUploadFile}
            >
              Upload
            </Button>
            <Button
              variant="outline"
              className="flex-1 py-2.5"
              onClick={() => {
                setBulkUploadModal(false);
                setBulkUploadFile(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

<Modal open={!!zoneModal} onClose={() => setZoneModal(null)} title={zoneModal?.id ? 'Edit Zone' : 'Create Zone'} size="md">
        {zoneModal && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-xl border border-teal-100 bg-gradient-to-r from-teal-50 to-teal-50/60 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-teal-600">
                <MapPinIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-teal-900">Zone setup</p>
                <p className="text-xs text-teal-700">Name the area, set capacity, and pick a colour for maps & badges</p>
              </div>
            </div>

            <Field label="Zone name">
              <Input
                value={zoneModal.name || ''}
                onChange={(e) => setZoneModal((current) => ({ ...current, name: e.target.value }))}
                placeholder="e.g. VIP Lounge, Gate A, Backstage"
              />
            </Field>

            <Field label="Description">
              <Input
                value={zoneModal.description || ''}
                onChange={(e) => setZoneModal((current) => ({ ...current, description: e.target.value }))}
                placeholder="Optional short description"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Capacity">
                <Input
                  type="number"
                  min="0"
                  value={zoneModal.capacity || 0}
                  onChange={(e) => setZoneModal((current) => ({ ...current, capacity: Number(e.target.value) }))}
                  placeholder="0 = unlimited"
                />
                <p className="mt-1 text-[11px] text-slate-500">Leave 0 for no hard limit</p>
              </Field>

              <Field label="Colour">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={zoneModal.color || '#2563eb'}
                    onChange={(e) => setZoneModal((current) => ({ ...current, color: e.target.value }))}
                    className="h-11 w-14 cursor-pointer rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
                    title="Zone colour"
                  />
                  <Input
                    value={zoneModal.color || '#2563eb'}
                    onChange={(e) => setZoneModal((current) => ({ ...current, color: e.target.value }))}
                    placeholder="#2563eb"
                    className="font-mono text-sm"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">Used on maps, badges and the zone list</p>
              </Field>
            </div>

            {/* Live preview chip */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Preview</p>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
                <span
                  className="h-2.5 w-2.5 rounded-full ring-2 ring-white"
                  style={{ backgroundColor: zoneModal.color || '#2563eb' }}
                />
                <span className="text-sm font-semibold text-slate-800">
                  {zoneModal.name?.trim() || 'Zone name'}
                </span>
                {Number(zoneModal.capacity) > 0 && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                    Cap {zoneModal.capacity}
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-3 border-t border-slate-100 pt-4">
              <Button className="flex-1 bg-teal-600 hover:bg-teal-500 py-2.5" onClick={saveZone}>
                {zoneModal.id ? 'Save changes' : 'Create zone'}
              </Button>
              <Button variant="outline" className="flex-1 py-2.5" onClick={() => setZoneModal(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!categoryModal} onClose={() => setCategoryModal(null)} title={categoryModal?.id ? 'Edit Ticket Category' : 'Create New Ticket Category'} size="lg">
        {categoryModal && (
          <div className="space-y-6">
            {/* Header Info */}
            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-teal-50 to-teal-50 rounded-lg border border-teal-200">
              <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 100-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-teal-900">Ticket Category Setup</h3>
                <p className="text-sm text-teal-700">Configure pricing, capacity, and access rules for this ticket type</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={categoryModal.name || ''}
                  onChange={(e) => setCategoryModal((current) => ({ ...current, name: e.target.value }))}
                  placeholder="e.g. VIP Gold, General Admission"
                />
                <p className="text-xs text-slate-500 mt-1">Choose a clear, descriptive name for this ticket type</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Price ({selectedEvent?.settings?.currency || 'LKR'})
                </label>
                <Input
                  type="number"
                  value={categoryModal.price || 0}
                  onChange={(e) => setCategoryModal((current) => ({ ...current, price: Number(e.target.value) }))}
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
                <p className="text-xs text-slate-500 mt-1">Set to 0 for free tickets</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Capacity
                </label>
                <Input
                  type="number"
                  value={categoryModal.capacity || 0}
                  onChange={(e) => setCategoryModal((current) => ({ ...current, capacity: Number(e.target.value) }))}
                  placeholder="Unlimited"
                  min="0"
                />
                <p className="text-xs text-slate-500 mt-1">Leave empty for unlimited capacity</p>
              </div>
            </div>

            {/* Visibility Settings */}
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-5">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={categoryModal.isVisible !== false}
                    onChange={(e) => setCategoryModal((current) => ({ ...current, isVisible: e.target.checked }))}
                    className="mt-1 h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-emerald-900">Visible to Public</span>
                    <span className="text-xs text-emerald-700 mt-1">Show this ticket category in the public event listing and allow purchases</span>
                  </div>
                </label>
              </div>

              <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-5">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!categoryModal.isPrivate}
                    onChange={(e) => setCategoryModal((current) => ({ ...current, isPrivate: e.target.checked }))}
                    className="mt-1 h-4 w-4 rounded border-teal-300 text-teal-600 focus:ring-teal-500"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-teal-900">Private Ticket</span>
                    <span className="text-xs text-teal-700 mt-1">Requires a special access code to view and purchase this ticket</span>
                  </div>
                </label>

                {categoryModal.isPrivate && (
                  <div className="mt-4 rounded-lg bg-white p-4 ring-1 ring-teal-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-700">Access Code</span>
                      <span className="rounded-lg bg-teal-600 px-3 py-1 text-sm font-mono font-bold text-white tracking-widest">
                        {canViewPrivateTicketCode(categoryModal)
                          ? (categoryModal.accessCode || 'AUTO-GENERATED')
                          : 'Hidden'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">Share this code with invited guests to allow access to this private ticket</p>
                  </div>
                )}
              </div>
            </div>



            <div className="border-t pt-6 flex gap-3">
              <Button 
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-3"
                onClick={saveCategory}
              >
                {categoryModal.id ? 'Save Changes' : 'Create Ticket Category'}
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 py-3"
                onClick={() => setCategoryModal(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={subOrgModal} onClose={() => setSubOrgModal(false)} title={subOrgForm._id ? 'Manage Team Member Access' : 'Create Team Member'} size="lg">
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input value={subOrgForm.name} onChange={(e) => setSubOrgForm((current) => ({ ...current, name: e.target.value }))} placeholder="Full name" />
            </Field>
            <Field label="Role">
              <Select
                value={subOrgForm.role}
                onChange={(e) => {
                  const role = e.target.value;
                  let permissions = {
                    canAddAttendees: false,
                    canVerifyPhotos: false,
                    canInviteAttendees: false,
                    canBulkUpload: false,
                    canEntryAccess: false,
                    canScanZones: false,
                    canCollectCash: false
                  };
                  let assignedZones = subOrgForm.assignedZones || [];
                  let assignedGates = subOrgForm.assignedGates || [];

                  if (role === 'SubOrganiser') {
                    permissions = {
                      canAddAttendees: true,
                      canVerifyPhotos: true,
                      canInviteAttendees: true,
                      canBulkUpload: true,
                      canEntryAccess: true,
                      canScanZones: true,
                      canCollectCash: true
                    };
                    // full sub-organiser default
                    assignedZones = assignedZones || [];
                    assignedGates = assignedGates || [];
                  } else if (role === 'Staff') {
                    permissions = {
                      canAddAttendees: true,
                      canVerifyPhotos: true,
                      canInviteAttendees: true,
                      canBulkUpload: false,
                      canEntryAccess: true,
                      canScanZones: false,
                      canCollectCash: false
                    };
                    assignedZones = assignedZones || [];
                    assignedGates = assignedGates || [];
                  } else if (role === 'Volunteer') {
                    permissions = {
                      canAddAttendees: false,
                      canVerifyPhotos: false,
                      canInviteAttendees: false,
                      canBulkUpload: false,
                      canEntryAccess: true,
                      canScanZones: false,
                      canCollectCash: false
                    };
                    assignedZones = assignedZones || [];
                    assignedGates = assignedGates || [];
                  } else if (role === 'Auditor') {
                    permissions = {
                      canAddAttendees: false,
                      canVerifyPhotos: false,
                      canInviteAttendees: false,
                      canBulkUpload: false,
                      canEntryAccess: false,
                      canScanZones: false,
                      canCollectCash: false
                    };
                    assignedZones = assignedZones || [];
                    assignedGates = [];
                  }

                  setSubOrgForm(curr => ({ ...curr, role, permissions, assignedZones, assignedGates }));
                }}
              >
                <option value="SubOrganiser">Sub-Organiser</option>
                <option value="Staff">Staff</option>
                <option value="Volunteer">Volunteer</option>
                <option value="Auditor">Auditor</option>
              </Select>
            </Field>
            <Field label="Email">
              <Input value={subOrgForm.email} onChange={(e) => setSubOrgForm((current) => ({ ...current, email: e.target.value }))} placeholder="Email address" />
            </Field>
            <Field label="Phone">
              <Input value={subOrgForm.phone} onChange={(e) => setSubOrgForm((current) => ({ ...current, phone: e.target.value }))} placeholder="Phone number" />
            </Field>
            {!subOrgForm._id && (
              <div className="sm:col-span-2">
                <Field label="Temporary Password">
                  <Input value={subOrgForm.password} onChange={(e) => setSubOrgForm((current) => ({ ...current, password: e.target.value }))} placeholder="Set initial password" />
                </Field>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <span className="text-xs font-bold uppercase text-slate-500">Checkpoint Assignment</span>
            <p className="text-[11px] text-slate-500 mt-1 mb-3">Assign specific gates for entry/exit operations</p>
            {(() => {
              const allGates = selectedEvent?.gates || [];
              const assignedGates = subOrgForm.assignedGates || [];
              const isAllChecked = allGates.length > 0 && allGates.every(gate => assignedGates.includes(gate));
              
              return (
                <>
                  {allGates.length > 0 && (
                    <div className="mb-3">
                      <label className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-xs cursor-pointer transition-all ${isAllChecked ? 'border-teal-200 bg-teal-50/20 font-semibold text-teal-900' : 'border-slate-100 bg-slate-50/50 text-slate-600 hover:border-slate-200'}`}>
                        <input
                          type="checkbox"
                          checked={isAllChecked}
                          onChange={(e) => {
                            const next = e.target.checked ? [...allGates] : [];
                            setSubOrgForm(curr => ({ ...curr, assignedGates: next }));
                          }}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                        All Gates (Select / Deselect All)
                      </label>
                    </div>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {allGates.length > 0 ? allGates.map((gate) => {
                      const isChecked = assignedGates.includes(gate);
                      return (
                        <label key={gate} className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-xs cursor-pointer transition-all ${isChecked ? 'border-teal-200 bg-teal-50/20 font-semibold text-teal-900' : 'border-slate-100 bg-slate-50/50 text-slate-600 hover:border-slate-200'}`}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...new Set([...assignedGates, gate])]
                                : assignedGates.filter(item => item !== gate);
                              setSubOrgForm(curr => ({ ...curr, assignedGates: next }));
                            }}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                          />
                          {gate}
                        </label>
                      );
                    }) : (
                      <div className="sm:col-span-2 text-xs italic text-slate-400 text-center py-2">No gates configured for this event.</div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <span className="text-xs font-bold uppercase text-slate-500">Zone Access Scope</span>
            <p className="text-[11px] text-slate-500 mt-1 mb-3">Allow checking attendees in/out of specific zones</p>
            {(() => {
              const allZones = selectedEvent?.zones || [];
              const assignedZones = subOrgForm.assignedZones || [];
              const allZoneIds = allZones.map(z => z.id || z.name);
              const isAllChecked = allZoneIds.length > 0 && allZoneIds.every(zid => assignedZones.includes(zid));
              
              return (
                <>
                  {allZones.length > 0 && (
                    <div className="mb-3">
                      <label className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-xs cursor-pointer transition-all ${isAllChecked ? 'border-teal-200 bg-teal-50/20 font-semibold text-teal-900' : 'border-slate-100 bg-slate-50/50 text-slate-600 hover:border-slate-200'}`}>
                        <input
                          type="checkbox"
                          checked={isAllChecked}
                          onChange={(e) => {
                            const next = e.target.checked ? [...allZoneIds] : [];
                            setSubOrgForm(curr => ({ ...curr, assignedZones: next }));
                          }}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                        All Zones (Select / Deselect All)
                      </label>
                    </div>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {allZones.length > 0 ? allZones.map((zone) => {
                      const zid = zone.id || zone.name;
                      const isChecked = assignedZones.includes(zid);
                      return (
                        <label key={zone.id || zid} className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-xs cursor-pointer transition-all ${isChecked ? 'border-teal-200 bg-teal-50/20 font-semibold text-teal-900' : 'border-slate-100 bg-slate-50/50 text-slate-600 hover:border-slate-200'}`}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...new Set([...assignedZones, zid])]
                                : assignedZones.filter(item => item !== zid);
                              setSubOrgForm(curr => ({ ...curr, assignedZones: next }));
                            }}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                          />
                          {zone.name}
                        </label>
                      );
                    }) : (
                      <div className="sm:col-span-2 text-xs italic text-slate-400 text-center py-2">No zones configured for this event.</div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <span className="text-xs font-bold uppercase text-slate-500">Capabilities</span>
            <p className="text-[11px] text-slate-500 mt-1 mb-3">Actions this member can perform</p>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={!!subOrgForm.permissions?.canEntryAccess}
                  onChange={(e) => setSubOrgForm(curr => ({ ...curr, permissions: { ...curr.permissions, canEntryAccess: e.target.checked } }))}
                  className="w-4 h-4 text-teal-600 rounded"
                />
                <div className="flex-1">
                  <span className="block text-sm font-semibold text-slate-900">Entry Access</span>
                  <span className="text-xs text-slate-500">Check-in/out at gates</span>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={!!subOrgForm.permissions?.canScanZones}
                  onChange={(e) => setSubOrgForm(curr => ({ ...curr, permissions: { ...curr.permissions, canScanZones: e.target.checked } }))}
                  className="w-4 h-4 text-teal-600 rounded"
                />
                <div className="flex-1">
                  <span className="block text-sm font-semibold text-slate-900">Zone Scanning</span>
                  <span className="text-xs text-slate-500">Validate access to VIP/backstage zones</span>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={!!subOrgForm.permissions?.canAddAttendees}
                  onChange={(e) => setSubOrgForm(curr => ({ ...curr, permissions: { ...curr.permissions, canAddAttendees: e.target.checked } }))}
                  className="w-4 h-4 text-teal-600 rounded"
                />
                <div className="flex-1">
                  <span className="block text-sm font-semibold text-slate-900">Add Attendees</span>
                  <span className="text-xs text-slate-500">Register guests directly</span>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={!!subOrgForm.permissions?.canVerifyPhotos}
                  onChange={(e) => setSubOrgForm(curr => ({ ...curr, permissions: { ...curr.permissions, canVerifyPhotos: e.target.checked } }))}
                  className="w-4 h-4 text-teal-600 rounded"
                />
                <div className="flex-1">
                  <span className="block text-sm font-semibold text-slate-900">Photo Verification</span>
                  <span className="text-xs text-slate-500">Approve attendee photo uploads</span>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={!!subOrgForm.permissions?.canBulkUpload}
                  onChange={(e) => setSubOrgForm(curr => ({ ...curr, permissions: { ...curr.permissions, canBulkUpload: e.target.checked } }))}
                  className="w-4 h-4 text-teal-600 rounded"
                />
                <div className="flex-1">
                  <span className="block text-sm font-semibold text-slate-900">Bulk Upload</span>
                  <span className="text-xs text-slate-500">Excel spreadsheet imports</span>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={!!subOrgForm.permissions?.canInviteAttendees}
                  onChange={(e) => setSubOrgForm(curr => ({ ...curr, permissions: { ...curr.permissions, canInviteAttendees: e.target.checked } }))}
                  className="w-4 h-4 text-teal-600 rounded"
                />
                <div className="flex-1">
                  <span className="block text-sm font-semibold text-slate-900">Invite Attendees</span>
                  <span className="text-xs text-slate-500">Send invitation links</span>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={!!subOrgForm.permissions?.canCollectCash}
                  onChange={(e) => setSubOrgForm(curr => ({ ...curr, permissions: { ...curr.permissions, canCollectCash: e.target.checked } }))}
                  className="w-4 h-4 text-teal-600 rounded"
                />
                <div className="flex-1">
                  <span className="block text-sm font-semibold text-slate-900">Cash Collection</span>
                  <span className="text-xs text-slate-500">Confirm cash payments at entrance</span>
                </div>
              </label>
            </div>
          </div>

          <div className="pt-2">
            <Button className="w-full py-3" onClick={saveTeamMemberAccess}>
              {subOrgForm._id ? 'Update Access' : 'Create Team Member'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!sponsorPackageModal} onClose={() => setSponsorPackageModal(null)} title={sponsorPackageModal?.id ? 'Edit Sponsor Package' : 'Create Sponsor Package'} size="lg">
        {sponsorPackageModal && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Package Name">
                <Input value={sponsorPackageModal.name || ''} onChange={(e) => setSponsorPackageModal((current) => ({ ...current, name: e.target.value }))} placeholder="Package name" />
              </Field>
              <Field label="Level">
                <Select value={sponsorPackageModal.level || 'Custom'} onChange={(e) => setSponsorPackageModal((current) => ({ ...current, level: e.target.value }))}>
                  <option value="Platinum">Platinum</option>
                  <option value="Gold">Gold</option>
                  <option value="Silver">Silver</option>
                  <option value="Custom">Custom</option>
                </Select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Price">
                <Input type="number" min="0" value={sponsorPackageModal.price || 0} onChange={(e) => setSponsorPackageModal((current) => ({ ...current, price: Number(e.target.value) }))} placeholder="0" />
              </Field>
              <Field label="Capacity">
                <Input type="number" min="1" value={sponsorPackageModal.capacity || 1} onChange={(e) => setSponsorPackageModal((current) => ({ ...current, capacity: Number(e.target.value) }))} placeholder="1" />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">Visible</span>
                <input type="checkbox" checked={!!sponsorPackageModal.isVisible} onChange={(e) => setSponsorPackageModal((current) => ({ ...current, isVisible: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
              </div>
              <Field label="Expiry Date">
                <Input type="date" value={sponsorPackageModal.expiryDate || ''} onChange={(e) => setSponsorPackageModal((current) => ({ ...current, expiryDate: e.target.value }))} />
              </Field>
            </div>
            <Field label="Contact Number">
              <Input value={sponsorPackageModal.contactNumber || ''} onChange={(e) => setSponsorPackageModal((current) => ({ ...current, contactNumber: e.target.value }))} placeholder="Contact phone" />
            </Field>
            <Field label="Benefits">
              <Input value={(sponsorPackageModal.benefits || []).join(', ')} onChange={(e) => setSponsorPackageModal((current) => ({ ...current, benefits: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) }))} placeholder="Benefit1, Benefit2" />
            </Field>
            <Field label="Description">
              <textarea value={sponsorPackageModal.description || ''} onChange={(e) => setSponsorPackageModal((current) => ({ ...current, description: e.target.value }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" placeholder="Description" rows={4} />
            </Field>
            <Button onClick={saveSponsorPackage}>{sponsorPackageModal.id ? 'Save Changes' : 'Create Package'}</Button>
          </div>
        )}
      </Modal>

      <Modal open={!!sponsorModal} onClose={() => setSponsorModal(null)} title="Create Sponsor" size="lg">
        {sponsorModal && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Company Name">
                <Input value={sponsorModal.companyName || ''} onChange={(e) => setSponsorModal((current) => ({ ...current, companyName: e.target.value }))} placeholder="Company name" />
              </Field>
              <Field label="Contact Person">
                <Input value={sponsorModal.contactPerson || ''} onChange={(e) => setSponsorModal((current) => ({ ...current, contactPerson: e.target.value }))} placeholder="Full name" />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Email">
                <Input type="email" value={sponsorModal.email || ''} onChange={(e) => setSponsorModal((current) => ({ ...current, email: e.target.value }))} placeholder="Email address" />
              </Field>
              <Field label="Phone">
                <Input value={sponsorModal.phone || ''} onChange={(e) => setSponsorModal((current) => ({ ...current, phone: e.target.value }))} placeholder="Phone number" />
              </Field>
            </div>
            <Field label="Sponsor Package">
              <Select value={sponsorModal.packageId || ''} onChange={(e) => setSponsorModal((current) => ({ ...current, packageId: e.target.value }))}>
                <option value="">Select package</option>
                {sponsorPackages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>{pkg.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Notes">
              <textarea value={sponsorModal.notes || ''} onChange={(e) => setSponsorModal((current) => ({ ...current, notes: e.target.value }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" placeholder="Notes" rows={4} />
            </Field>
            <Button onClick={saveSponsor}>Create Sponsor</Button>
          </div>
        )}
      </Modal>

      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Confirm delete"
        size="sm"
      >
        {deleteConfirm && (
          <div className="space-y-5">
            <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-4">
              <p className="text-sm text-slate-700">
                Are you sure you want to delete{' '}
                <span className="font-semibold text-slate-900">
                  {deleteConfirm.label || 'this item'}
                </span>
                ?
              </p>
              <p className="mt-1.5 text-xs text-slate-500">
                {deleteConfirm.type === 'package'
                  ? 'Sponsors linked to this package may be affected. This cannot be undone.'
                  : 'This sponsor will be removed permanently.'}
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                className="flex-1 bg-rose-600 hover:bg-rose-500 py-2.5"
                onClick={confirmDelete}
              >
                Delete
              </Button>
              <Button
                variant="outline"
                className="flex-1 py-2.5"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title="Reject Photo">
        {rejecting && (
          <div className="space-y-3">
            <textarea rows="4" value={rejecting.reason || ''} onChange={(e) => setRejecting((current) => ({ ...current, reason: e.target.value }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" placeholder="Reason for rejection" />
            <Button variant="outline" className="text-rose-500 border-rose-100 hover:bg-rose-50" onClick={rejectVerification}>Reject Photo</Button>
          </div>
        )}
      </Modal>

      <Modal 
        open={deleteTeamModalOpen} 
        onClose={() => {
          setDeleteTeamModalOpen(false);
          setTeamMemberToDelete(null);
        }}
        title="Delete Team Member"
        size="md"
      >
        {teamMemberToDelete && (
          <div className="space-y-5">
            <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-4">
              <p className="text-sm text-slate-700">
                Are you sure you want to delete{' '}
                <span className="font-semibold text-slate-900">
                  {teamMemberToDelete.name}
                </span>
                ?
              </p>
              <p className="mt-1.5 text-xs text-slate-500">
                This will permanently remove this team member from all events and revoke their access. This cannot be undone.
              </p>
            </div>

            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
              <p className="text-sm text-slate-600">
                <span className="font-medium">Email:</span> {teamMemberToDelete.email}
              </p>
              <p className="text-sm text-slate-600 mt-1">
                <span className="font-medium">Role:</span> {teamMemberToDelete.role}
              </p>
              <p className="text-sm text-slate-600 mt-1">
                <span className="font-medium">Status:</span> {teamMemberToDelete.status}
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                className="flex-1 bg-rose-600 hover:bg-rose-500 py-2.5"
                onClick={confirmDeleteTeamMember}
              >
                Delete
              </Button>
              <Button
                variant="outline"
                className="flex-1 py-2.5"
                onClick={() => {
                  setDeleteTeamModalOpen(false);
                  setTeamMemberToDelete(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
};

export default OrganiserDashboard;