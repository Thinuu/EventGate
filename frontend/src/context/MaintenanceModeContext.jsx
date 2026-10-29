import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { io } from '../utils/realtime';
import { getPublicConfig } from '../api/events';
import { getSocketUrl } from '../utils/backend';

const MaintenanceContext = createContext(null);

export const useMaintenanceMode = () => {
  const context = useContext(MaintenanceContext);
  if (!context) {
    throw new Error(
      'useMaintenanceMode must be used within MaintenanceModeProvider'
    );
  }
  return context;
};

export const MaintenanceModeProvider = ({ children }) => {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMaintenanceStatus = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getPublicConfig();
      // Support both axios shape and unwrapped shape
      const payload = response?.data?.data ?? response?.data ?? response;
      const enabled = !!(
        payload?.maintenanceMode ??
        payload?.settings?.maintenanceMode ??
        false
      );
      setMaintenanceMode(enabled);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch maintenance status:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMaintenanceStatus();

    const socket = io(getSocketUrl() || window.location.origin, {
      path: '/socket.io',
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    const handleMaintenanceModeChanged = (data) => {
      setMaintenanceMode(!!data?.maintenanceMode);
    };

    socket.on('system:maintenance-mode-changed', handleMaintenanceModeChanged);
    socket.on('maintenance_mode_changed', handleMaintenanceModeChanged);

    return () => {
      socket.off(
        'system:maintenance-mode-changed',
        handleMaintenanceModeChanged
      );
      socket.off('maintenance_mode_changed', handleMaintenanceModeChanged);
      socket.disconnect();
    };
  }, [fetchMaintenanceStatus]);

  return (
    <MaintenanceContext.Provider
      value={{
        maintenanceMode,
        loading,
        error,
        refetch: fetchMaintenanceStatus,
      }}
    >
      {children}
    </MaintenanceContext.Provider>
  );
};

export default MaintenanceContext;