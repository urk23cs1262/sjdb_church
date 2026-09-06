import { createContext, useContext, useState, useEffect } from 'react';
import axios from '../services/api';
import { applyUserSettings } from '../utils/applySettings';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
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
    } catch {
      localStorage.removeItem('token');
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const login = (userData, authToken) => {
    localStorage.setItem('token', authToken);
    setToken(authToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const isAdmin = user?.role === 'admin';
  const isAuthenticated = !!user;
  const isReverificationRequired = Boolean(user && user.role !== 'admin' && user.requiresReverification);

  const markReverified = (updatedUser) => {
    setUser(prev => ({
      ...(prev || {}),
      ...(updatedUser || {}),
      requiresReverification: false,
      account_verified: true
    }));
  };

  return (
    <AuthContext.Provider value={{ user, setUser, token, loading, login, logout, isAdmin, isAuthenticated, isReverificationRequired, markReverified, fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
