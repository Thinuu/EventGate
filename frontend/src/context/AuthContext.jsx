import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import api from '../api/client';
import { getCanonicalRole, hasRolePower, ROLES } from '../utils/rbac';

const AuthContext = createContext(null);
const USER_STORAGE_KEY = 'entrynex_user';
const TOKEN_KEY = 'entrynex_token';
const REFRESH_TOKEN_KEY = 'entrynex_refresh_token';

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      ...parsed,
      rbacRole: getCanonicalRole(parsed?.role),
    };
  } catch {
    localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => readStoredUser());
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const { data } = await api.get('/auth/me');
      const userData = data?.data?.user || data?.user;
      if (!userData) throw new Error('No user in response');

      const nextUser = {
        ...userData,
        rbacRole: getCanonicalRole(userData?.role),
      };
      setUser(nextUser);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
    } catch (error) {
      if (error?.response?.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(USER_STORAGE_KEY);
        setUser(null);
      } else {
        const storedUser = readStoredUser();
        if (storedUser) setUser(storedUser);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (email, password, mfaToken) => {
    try {
      const { data } = await api.post('/auth/login', {
        email,
        password,
        mfaToken,
      });

      if (data.requireMfa) {
        return { requireMfa: true };
      }

      const accessToken = data.accessToken || data.token;
      if (accessToken) {
        localStorage.setItem(TOKEN_KEY, accessToken);
      }
      if (data.refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
      }

      const userData = data?.data?.user || data?.user;
      const nextUser = {
        ...userData,
        rbacRole: getCanonicalRole(userData?.role),
      };
      setUser(nextUser);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
      return nextUser;
    } catch (error) {
      if (
        error.response?.status === 403 &&
        error.response?.data?.requirePasswordChange
      ) {
        return {
          requirePasswordChange: true,
          tempToken: error.response.data.tempToken,
          message: error.response.data.message,
        };
      }
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
  };

  /**
   * can('SCAN_TICKET') — role hierarchy + explicit permission flags
   */
  const can = (permission) => {
    if (!user) return false;
    if (hasRolePower(user.role, ROLES.MAIN_ADMIN)) return true;
    if (hasRolePower(user.role, ROLES.MAIN_ORGANISER)) return true;
    return !!(user.permissions && user.permissions[permission]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        loadUser,
        can,
        isAdmin: hasRolePower(user?.role, ROLES.MAIN_ADMIN),
        isOrganiser: hasRolePower(user?.role, ROLES.MAIN_ORGANISER),
        isSubOrg: hasRolePower(user?.role, ROLES.SUB_ORGANISER),
        isStaff: hasRolePower(user?.role, ROLES.STAFF),
        isAuditor: hasRolePower(user?.role, ROLES.AUDITOR),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};