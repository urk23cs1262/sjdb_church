import { createContext, useContext, useState, useEffect } from 'react';
import axios from '../services/api';
import { applyUserSettings } from '../utils/applySettings';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const cached = localStorage.getItem('user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      fetchMe();
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && user.settings) {
      applyUserSettings(user.settings);
    }
  }, [user]);


  const fetchMe = async () => {
    try {
      const res = await axios.get('/auth/me');
      setUser(res.data.user);
      if (res.data.user) {
        try {
          localStorage.setItem('user', JSON.stringify(res.data.user));
        } catch {}
      }
    } catch (err) {
      // Only remove token if the server explicitly responded with 401 Unauthorized
      // Network disconnects, 502/503 during deployment must NOT wipe the user's session!
      if (err.response && err.response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const login = (userData, authToken) => {
    localStorage.setItem('token', authToken);
    if (userData) {
      try {
        localStorage.setItem('user', JSON.stringify(userData));
      } catch {}
    }
    setToken(authToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const userRole = (user?.role || '').toLowerCase();
  const isAdmin = ['admin', 'priest', 'staff', 'technical_team'].includes(userRole) || !!user?.isTechnicalTeam;
  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAdmin, isAuthenticated, fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
