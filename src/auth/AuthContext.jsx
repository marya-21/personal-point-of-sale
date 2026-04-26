import { createContext, useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../services/supabase";

export const AuthContext = createContext();

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 menit
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const logoutRef = useRef(null);

  const logout = useCallback((onLogout) => {
    setUser(null);
    setPermissions([]);
    localStorage.removeItem("pos_session");
    localStorage.removeItem("pos_last_activity");
    if (onLogout) onLogout();
  }, []);

  // Simpan ref agar event listener bisa akses logout terbaru
  logoutRef.current = logout;

  // Restore session + cek inaktivitas saat app dimuat
  useEffect(() => {
    const saved = localStorage.getItem("pos_session");
    if (saved) {
      try {
        const { user: savedUser, permissions: savedPerms } = JSON.parse(saved);
        const lastActivity = parseInt(
          localStorage.getItem("pos_last_activity") || "0",
          10,
        );
        const isExpired = Date.now() - lastActivity > INACTIVITY_LIMIT_MS;

        if (isExpired) {
          localStorage.removeItem("pos_session");
          localStorage.removeItem("pos_last_activity");
        } else {
          setUser(savedUser);
          setPermissions(savedPerms);
        }
      } catch {
        localStorage.removeItem("pos_session");
        localStorage.removeItem("pos_last_activity");
      }
    }
    setLoading(false);
  }, []);

  // Activity tracker + inactivity checker
  useEffect(() => {
    if (!user) return;

    const updateActivity = () => {
      localStorage.setItem("pos_last_activity", Date.now().toString());
    };

    const checkInactivity = () => {
      const lastActivity = parseInt(
        localStorage.getItem("pos_last_activity") || "0",
        10,
      );
      if (Date.now() - lastActivity > INACTIVITY_LIMIT_MS) {
        logoutRef.current();
      }
    };

    // Set aktivitas awal saat login / restore
    updateActivity();

    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, updateActivity, { passive: true }),
    );
    const interval = setInterval(checkInactivity, 60 * 1000); // cek tiap 1 menit

    return () => {
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, updateActivity),
      );
      clearInterval(interval);
    };
  }, [user]);

  const login = async (email, password) => {
    try {
      const { data, error } = await supabase.rpc("verify_login", {
        p_email: email,
        p_password: password,
      });

      if (error) throw error;
      if (!data || data.length === 0) {
        return { success: false, error: "Email atau password salah" };
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
      localStorage.setItem(
        "pos_session",
        JSON.stringify({ user: userData, permissions: perms }),
      );
      localStorage.setItem("pos_last_activity", Date.now().toString());

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
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
