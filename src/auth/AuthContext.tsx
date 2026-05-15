import { createContext, useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../services/supabase";
import {
  createSession,
  validateSession,
  updateSessionActivity,
  destroySession,
} from "../services/sessionService";

export const AuthContext = createContext();

const INACTIVITY_LIMIT_MS = 60 * 60 * 1000; // 1 hour
const ACTIVITY_DEBOUNCE_MS = 30 * 1000; // 30 detik (max 1x update ke server per 30s)
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
  const [sessionToken, setSessionToken] = useState(null);
  const logoutRef = useRef(null);
  const activityTimeoutRef = useRef(null);
  const lastServerUpdateRef = useRef(0);

  const logout = useCallback(
    async (onLogout) => {
      // Destroy session di database
      if (sessionToken) {
        await destroySession(sessionToken);
      }

      // Clear pending debounce
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
        activityTimeoutRef.current = null;
      }

      // Clear state & localStorage
      setUser(null);
      setPermissions([]);
      setSessionToken(null);
      localStorage.removeItem("pos_session");
      localStorage.removeItem("pos_session_token");
      localStorage.removeItem("pos_last_activity");

      if (onLogout) onLogout();
    },
    [sessionToken],
  );

  logoutRef.current = logout;

  // Restore session + validate token saat app dimuat
  useEffect(() => {
    const restoreSession = async () => {
      const savedToken = localStorage.getItem("pos_session_token");
      const saved = localStorage.getItem("pos_session");

      if (savedToken && saved) {
        try {
          // Validate token di database
          const { valid } = await validateSession(savedToken);

          if (valid) {
            const { user: savedUser, permissions: savedPerms } =
              JSON.parse(saved);
            setUser(savedUser);
            setPermissions(savedPerms);
            setSessionToken(savedToken);
            localStorage.setItem("pos_last_activity", Date.now().toString());
          } else {
            // Token invalid/expired - clear everything
            localStorage.removeItem("pos_session");
            localStorage.removeItem("pos_session_token");
            localStorage.removeItem("pos_last_activity");
          }
        } catch (err) {
          console.error("[Session Restore Error]", err);
          localStorage.removeItem("pos_session");
          localStorage.removeItem("pos_session_token");
          localStorage.removeItem("pos_last_activity");
        }
      }
      setLoading(false);
    };

    restoreSession();
  }, []);

  // Activity tracker + inactivity checker (with debounce)
  useEffect(() => {
    if (!user || !sessionToken) return;

    // Update activity dengan debounce
    const updateActivity = () => {
      // Selalu update localStorage (cheap, tidak ada cost)
      localStorage.setItem("pos_last_activity", Date.now().toString());

      // Debounce server update: max 1x per 30 detik
      const now = Date.now();
      const timeSinceLastUpdate = now - lastServerUpdateRef.current;

      if (timeSinceLastUpdate >= ACTIVITY_DEBOUNCE_MS) {
        // Sudah > 30 detik dari last update → update sekarang
        lastServerUpdateRef.current = now;
        updateSessionActivity(sessionToken).catch((err) => {
          console.warn("[Activity Update Failed]", err);
        });
      } else if (!activityTimeoutRef.current) {
        // Schedule update di akhir window debounce
        const delay = ACTIVITY_DEBOUNCE_MS - timeSinceLastUpdate;
        activityTimeoutRef.current = setTimeout(() => {
          lastServerUpdateRef.current = Date.now();
          activityTimeoutRef.current = null;
          updateSessionActivity(sessionToken).catch((err) => {
            console.warn("[Activity Update Failed]", err);
          });
        }, delay);
      }
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

    // Set aktivitas awal
    updateActivity();

    // Add event listeners
    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, updateActivity, { passive: true }),
    );

    // Check inactivity setiap 5 menit
    const interval = setInterval(checkInactivity, 5 * 60 * 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, updateActivity),
      );
      clearInterval(interval);

      // Cleanup pending debounce
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
        activityTimeoutRef.current = null;
      }
    };
  }, [user, sessionToken]);

  const login = async (email, password) => {
    try {
      // 1. Verify login via RPC
      const { data, error } = await supabase.rpc("verify_login", {
        p_email: email,
        p_password: password,
      });

      if (error) throw error;
      if (!data || !Array.isArray(data) || data.length === 0) {
        return { success: false, error: "Email atau password salah" };
      }

      const row = data[0];
      const userData = {
        id: row.user_id,
        email: row.email,
        full_name: row.full_name,
        role: { name: row.role_name },
      };
      const perms = Array.isArray(row.permissions) ? row.permissions : [];

      // 2. Create session di database
      const sessionResult = await createSession(row.user_id);
      if (!sessionResult.success) {
        throw new Error("Failed to create session: " + sessionResult.error);
      }

      // 3. Save ke state & localStorage
      setUser(userData);
      setPermissions(perms);
      setSessionToken(sessionResult.token);
      lastServerUpdateRef.current = Date.now(); // Reset debounce timer

      localStorage.setItem(
        "pos_session",
        JSON.stringify({ user: userData, permissions: perms }),
      );
      localStorage.setItem("pos_session_token", sessionResult.token);
      localStorage.setItem("pos_last_activity", Date.now().toString());

      return { success: true };
    } catch (err) {
      console.error("[Login Error]", err);
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
        sessionToken,
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
