import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../context/AuthContext';
import { getCanonicalRole, hasRolePower } from '../../utils/rbac';
import { ROLE_NAVIGATION, ROLE_LABELS, ROLE_COLORS } from '../../config/roleNavigation';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { 
  HomeIcon, 
  UsersIcon, 
  TicketIcon, 
  ChartBarIcon, 
  ShieldCheckIcon,
  MagnifyingGlassIcon,
  ClipboardDocumentListIcon,
  BellIcon,
  CogIcon,
  ArrowPathIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { 
  HomeIcon as HomeIconSolid,
  UsersIcon as UsersIconSolid,
  TicketIcon as TicketIconSolid,
  ChartBarIcon as ChartBarIconSolid
} from '@heroicons/react/24/solid';

const UserDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { permissions, role } = usePermissions();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSection, setSelectedSection] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');

  const canonicalRole = role;
  const roleNavigation = ROLE_NAVIGATION[canonicalRole] || { sections: [] };
  const roleColor = ROLE_COLORS[canonicalRole] || 'bg-slate-100 text-slate-700';

  useEffect(() => {
    // Load dashboard data based on user role
    loadDashboardData();
  }, [canonicalRole]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      // Call the role-based dashboard API endpoint
      const response = await fetch('/api/dashboard/role-based', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('entrynex_token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      setDashboardData(result.data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      setDashboardData(null); // Set to null on error to handle gracefully
    } finally {
      setLoading(false);
    }
  };

  const handleNavigation = (path) => {
    navigate(path);
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    // Implement search functionality
  };

  const MetricCard = ({ title, value, subtitle, icon: Icon, trend, color = 'blue' }) => (
    <Card className="rounded-2xl border-slate-200 bg-white hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between p-6">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          {trend && (
            <div className={`mt-2 flex items-center text-sm ${
              trend.positive ? 'text-green-600' : 'text-red-600'
            }`}>
              <ArrowPathIcon className={`h-4 w-4 mr-1 ${
                trend.positive ? 'rotate-0' : 'rotate-180'
              }`} />
              {trend.value}
            </div>
          )}
        </div>
        <div className={`rounded-2xl bg-${color}-100 p-3 text-${color}-600`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </Card>
  );

  const ActionCard = ({ title, description, icon: Icon, onClick, disabled = false, color = 'blue' }) => (
    <Card 
      className={`rounded-2xl border-slate-200 bg-white hover:shadow-lg transition-all cursor-pointer ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-teal-300'
      }`}
      onClick={!disabled ? onClick : undefined}
    >
      <div className="p-6">
        <div className={`rounded-2xl bg-${color}-100 p-3 text-${color}-600 mb-4 inline-block`}>
          <Icon className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
      </div>
    </Card>
  );

  const renderOverviewSection = () => {
    if (!dashboardData) return null;

    return (
      <div className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {permissions.canViewOverview && (
            <>
              <MetricCard
                title="Total Events"
                value={dashboardData.totalEvents || 0}
                subtitle="Active events"
                icon={TicketIcon}
                color="blue"
              />
              <MetricCard
                title="Total Attendees"
                value={dashboardData.totalAttendees || 0}
                subtitle="Registered attendees"
                icon={UsersIcon}
                color="green"
              />
              <MetricCard
                title="Check-ins Today"
                value={dashboardData.todayCheckIns || 0}
                subtitle="Entries today"
                icon={MagnifyingGlassIcon}
                color="purple"
              />
              <MetricCard
                title="Pending Verifications"
                value={dashboardData.pendingVerifications || 0}
                subtitle="Awaiting review"
                icon={ShieldCheckIcon}
                color="amber"
              />
            </>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {permissions.canScanEntry && (
            <ActionCard
              title="Entry Scanner"
              description="Scan tickets for event entry"
              icon={MagnifyingGlassIcon}
              onClick={() => handleNavigation('/scan')}
              color="blue"
            />
          )}
          {permissions.canVerifyPhotos && (
            <ActionCard
              title="Photo Verification"
              description="Review attendee photo submissions"
              icon={ShieldCheckIcon}
              onClick={() => handleNavigation('/verification')}
              color="amber"
            />
          )}
          {permissions.canManageZones && (
            <ActionCard
              title="Zone Management"
              description="Manage event zones and access"
              icon={UsersIcon}
              onClick={() => handleNavigation('/zones')}
              color="purple"
            />
          )}
          {permissions.canInviteAttendees && (
            <ActionCard
              title="Send Invites"
              description="Invite attendees to events"
              icon={BellIcon}
              onClick={() => handleNavigation('/invites')}
              color="green"
            />
          )}
          {permissions.canBulkUpload && (
            <ActionCard
              title="Bulk Upload"
              description="Upload multiple attendees at once"
              icon={ArrowPathIcon}
              onClick={() => handleNavigation('/upload')}
              color="indigo"
            />
          )}
          {permissions.canViewReports && (
            <ActionCard
              title="View Reports"
              description="Generate and view reports"
              icon={ChartBarIcon}
              onClick={() => handleNavigation('/reports')}
              color="pink"
            />
          )}
        </div>

        {/* Recent Activity */}
        {dashboardData.recentActivity && dashboardData.recentActivity.length > 0 && (
          <Card className="rounded-2xl border-slate-200 bg-white">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h3>
              <div className="space-y-3">
                {dashboardData.recentActivity.slice(0, 5).map((activity, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                    <div className="flex items-center space-x-3">
                      <div className="rounded-full bg-teal-100 p-2">
                        <BellIcon className="h-4 w-4 text-teal-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{activity.title}</p>
                        <p className="text-xs text-slate-500">{activity.description}</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400">{activity.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>
    );
  };

  const renderAttendeesSection = () => {
    if (!permissions.canViewAttendees) {
      return (
        <Card className="rounded-2xl border-slate-200 bg-white">
          <div className="p-12 text-center">
            <ShieldCheckIcon className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900">Access Restricted</h3>
            <p className="mt-2 text-sm text-slate-600">You don't have permission to view attendees.</p>
          </div>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-900">Attendee Management</h2>
          {permissions.canInviteAttendees && (
            <Button onClick={() => handleNavigation('/attendees/invite')}>
              Invite Attendees
            </Button>
          )}
        </div>

        {/* Attendee stats and list would go here */}
        <Card className="rounded-2xl border-slate-200 bg-white">
          <div className="p-6">
            <p className="text-slate-600">Attendee management interface would be implemented here.</p>
          </div>
        </Card>
      </div>
    );
  };

  const renderVerificationSection = () => {
    if (!permissions.canVerifyPhotos) {
      return (
        <Card className="rounded-2xl border-slate-200 bg-white">
          <div className="p-12 text-center">
            <ShieldCheckIcon className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900">Access Restricted</h3>
            <p className="mt-2 text-sm text-slate-600">You don't have permission to verify photos.</p>
          </div>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-900">Photo Verification</h2>
          <Badge variant="amber" className="text-sm">
            {dashboardData?.pendingVerifications || 0} Pending
          </Badge>
        </div>

        <Card className="rounded-2xl border-slate-200 bg-white">
          <div className="p-6">
            <p className="text-slate-600">Photo verification interface would be implemented here.</p>
          </div>
        </Card>
      </div>
    );
  };

  const renderContent = () => {
    switch (selectedSection) {
      case 'overview':
        return renderOverviewSection();
      case 'attendees':
        return renderAttendeesSection();
      case 'verification':
        return renderVerificationSection();
      default:
        return renderOverviewSection();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
                <Badge className={roleColor}>
                  {ROLE_LABELS[canonicalRole] || canonicalRole}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Welcome back, {user?.name || 'User'}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              </div>
              <Button variant="outline" onClick={loadDashboardData}>
                <ArrowPathIcon className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { key: 'overview', label: 'Overview', icon: HomeIconSolid },
              ...(permissions.canViewAttendees ? [{ key: 'attendees', label: 'Attendees', icon: UsersIconSolid }] : []),
              ...(permissions.canVerifyPhotos ? [{ key: 'verification', label: 'Verification', icon: ShieldCheckIcon }] : []),
              ...(permissions.canViewReports ? [{ key: 'reports', label: 'Reports', icon: ChartBarIconSolid }] : []),
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSelectedSection(tab.key)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                  selectedSection === tab.key
                    ? 'border-teal-500 text-teal-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderContent()}
      </div>
    </div>
  );
};

export default UserDashboard;
