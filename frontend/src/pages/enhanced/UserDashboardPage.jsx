import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import UserDashboard from '../../components/dashboard/UserDashboard';
import PermissionGuard from '../../components/auth/PermissionGuard';
import { getCanonicalRole } from '../../utils/rbac';

const UserDashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { permissions, canAccessRoute } = usePermissions();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const canonicalRole = getCanonicalRole(user?.role);

  useEffect(() => {
    // Check if user can access this dashboard
    if (!canAccessRoute('/dashboard')) {
      // Redirect to appropriate dashboard based on role
      const roleBasedRoutes = {
        'MainAdmin': '/admin/dashboard',
        'MainOrganiser': '/organiser/dashboard',
        'SubOrganiser': '/suborg/dashboard',
        'Staff': '/staff/dashboard',
        'Volunteer': '/staff/dashboard',
        'Auditor': '/auditor/dashboard',
      };

      const targetRoute = roleBasedRoutes[canonicalRole] || '/dashboard';
      navigate(targetRoute, { replace: true });
      return;
    }

    loadDashboardData();
  }, [canonicalRole, navigate, canAccessRoute]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/dashboard/role-based', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('entrynex_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load dashboard data: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setDashboardData(result.data);
      } else {
        throw new Error(result.message || 'Failed to load dashboard data');
      }
    } catch (err) {
      console.error('Dashboard data loading error:', err);
      setError(err.message);
      setDashboardData(null); // Ensure data is null on error
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadDashboardData();
  };

  useAutoRefresh(loadDashboardData, {
    enabled: !!user,
    interval: 15000,
    immediate: false,
    deps: [user],
  });

  if (loading && !dashboardData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Loading Dashboard</h2>
          <p className="text-sm text-slate-600">Preparing your personalized dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="rounded-full bg-red-100 p-3 w-12 h-12 mx-auto mb-4">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Dashboard Error</h2>
          <p className="text-sm text-slate-600 mb-4">{error}</p>
          <div className="space-y-2">
            <button
              onClick={handleRefresh}
              className="w-full bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PermissionGuard permission="canViewDashboard">
      <div className="min-h-screen bg-slate-50">
        {/* Role-based header */}
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center space-x-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">
                    {getDashboardTitle(canonicalRole)}
                  </h1>
                  <p className="text-sm text-slate-600">
                    Welcome back, {user?.name || 'User'}
                  </p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeClass(canonicalRole)}`}>
                  {getRoleDisplayName(canonicalRole)}
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleRefresh}
                  className="inline-flex items-center px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                >
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
                <button
                  onClick={() => navigate('/profile')}
                  className="inline-flex items-center px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                >
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Profile
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main dashboard content */}
        <UserDashboard 
          data={dashboardData}
          onRefresh={handleRefresh}
          role={canonicalRole}
          permissions={permissions}
        />
      </div>
    </PermissionGuard>
  );
};

// Helper functions
const getDashboardTitle = (role) => {
  const titles = {
    'MainAdmin': 'Admin Dashboard',
    'MainOrganiser': 'Event Dashboard',
    'SubOrganiser': 'Zone Dashboard',
    'Staff': 'Operations Dashboard',
    'Volunteer': 'Volunteer Dashboard',
    'Auditor': 'Audit Dashboard',
    'Attendee': 'My Dashboard'
  };
  return titles[role] || 'Dashboard';
};

const getRoleDisplayName = (role) => {
  const names = {
    'MainAdmin': 'Super Admin',
    'MainOrganiser': 'Main Organiser',
    'SubOrganiser': 'Sub Organiser',
    'Staff': 'Staff',
    'Volunteer': 'Volunteer',
    'Auditor': 'Auditor',
    'Attendee': 'Attendee'
  };
  return names[role] || role;
};

const getRoleBadgeClass = (role) => {
  const classes = {
    'MainAdmin': 'bg-teal-100 text-teal-800',
    'MainOrganiser': 'bg-teal-100 text-teal-800',
    'SubOrganiser': 'bg-teal-100 text-teal-800',
    'Staff': 'bg-cyan-100 text-cyan-800',
    'Volunteer': 'bg-teal-100 text-teal-800',
    'Auditor': 'bg-amber-100 text-amber-800',
    'Attendee': 'bg-slate-100 text-slate-800'
  };
  return classes[role] || 'bg-slate-100 text-slate-800';
};

export default UserDashboardPage;
