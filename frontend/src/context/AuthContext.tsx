import React, { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { type User } from '../types';
import { AuthContext } from './auth-context';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('pothole_token'));
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('pothole_token');
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const fetchMe = async () => {
      if (token) {
        try {
          const response = await api.get('/api/auth/me');
          setUser(response.data);
        } catch (error) {
          console.error('Failed to restore authentication session:', error);
          logout();
        }
      }
      setLoading(false);
    };
    fetchMe();
  }, [logout, token]);

  const login = async (username: string, password: string) => {
    setLoading(true);
    try {
      const response = await api.post('/api/auth/login', { username, password });
      const { access_token, user: userData } = response.data;
      localStorage.setItem('pothole_token', access_token);
      setToken(access_token);
      setUser(userData);
    } finally {
      setLoading(false);
    }
  };

  const register = async (username: string, password: string, role: 'admin' | 'citizen' = 'citizen') => {
    await api.post('/api/auth/register', { username, password, role });
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
