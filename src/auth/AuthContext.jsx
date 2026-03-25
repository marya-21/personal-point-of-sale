import { createContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Restore session dari localStorage saat app dimuat
  useEffect(() => {
    const saved = localStorage.getItem('pos_session');
    if (saved) {
      try {
        const { user: savedUser, permissions: savedPerms } = JSON.parse(saved);
        setUser(savedUser);
        setPermissions(savedPerms);
      } catch {
        localStorage.removeItem('pos_session');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const { data, error } = await supabase.rpc('verify_login', {
        p_email: email,
        p_password: password,
      });

      if (error) throw error;
      if (!data || data.length === 0) {
        return { success: false, error: 'Email atau password salah' };
      }

      const row = data[0];
      const userData = {
        id: row.user_id,
        email: row.email,
        full_name: row.full_name,
        role: { name: row.role_name },
      };
      const perms = row.permissions || [];

      setUser(userData);
      setPermissions(perms);
      localStorage.setItem('pos_session', JSON.stringify({ user: userData, permissions: perms }));

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const logout = () => {
    setUser(null);
    setPermissions([]);
    localStorage.removeItem('pos_session');
  };

  const hasPermission = (name) => permissions.includes(name);

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        loading,
        login,
        logout,
        hasPermission,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
