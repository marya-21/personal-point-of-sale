import { useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./auth/AuthContext";
import { useAuth } from "./hooks/useAuth";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { Toaster } from "./components/ui/toaster";
import Cashier from "./pages/Cashier";
import Inventory from "./pages/Inventory";
import TransactionHistory from "./pages/TransactionHistory";
import Login from "./pages/Auth/Login";
import { Badge } from "./components/ui/badge";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function NavBar() {
  const { user, logout, isAuthenticated, hasPermission } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated) return null;

  const handleLogout = () => {
    logout(() => {
      queryClient.clear();
      navigate("/login");
    });
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-30 bg-n-0 border-b border-n-200 px-6 h-14 flex items-center gap-6 shadow-sm">
      <span className="font-bold text-n-900 mr-4">POS App</span>

      {hasPermission("create_transaction") && (
        <NavLink
          to="/cashier"
          className={({ isActive }) =>
            `text-sm font-semibold pb-1 border-b-2 transition-colors ${isActive
              ? "border-accent-600 text-accent-600"
              : "border-transparent text-n-400 hover:text-n-800"
            }`
          }
        >
          Kasir
        </NavLink>
      )}

      {hasPermission("view_products") && (
        <NavLink
          to="/inventory"
          className={({ isActive }) =>
            `text-sm font-semibold pb-1 border-b-2 transition-colors ${isActive
              ? "border-accent-600 text-accent-600"
              : "border-transparent text-n-400 hover:text-n-800"
            }`
          }
        >
          Inventori
        </NavLink>
      )}

      {(hasPermission("view_all_transactions") ||
        hasPermission("view_own_transactions")) && (
          <NavLink
            to="/riwayat"
            className={({ isActive }) =>
              `text-sm font-semibold pb-1 border-b-2 transition-colors ${isActive
                ? "border-accent-600 text-accent-600"
                : "border-transparent text-n-400 hover:text-n-800"
              }`
            }
          >
            Riwayat
          </NavLink>
        )}

      <div className="ml-auto flex items-center gap-3">
        <span className="text-sm text-n-700 font-medium">
          {user?.full_name}
        </span>
        <Badge>
          {user?.role?.name}
        </Badge>
        <button
          onClick={handleLogout}
          className="text-sm text-n-400 hover:text-danger transition-colors ml-1 font-medium cursor-pointer"
        >
          Keluar
        </button>
      </div>
    </nav>
  );
}

function AppShell() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect ke login jika session expired (auto-logout karena inaktivitas)
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      queryClient.clear();
      navigate("/login", { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  return (
    <>
      <NavBar />
      <div className={isAuthenticated ? "pt-14 h-screen" : ""}>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/cashier"
            element={
              <ProtectedRoute requiredPermission="create_transaction">
                <Cashier />
              </ProtectedRoute>
            }
          />

          <Route
            path="/inventory"
            element={
              <ProtectedRoute requiredPermission="view_products">
                <Inventory />
              </ProtectedRoute>
            }
          />

          <Route
            path="/riwayat"
            element={
              <ProtectedRoute
                anyPermission={[
                  "view_all_transactions",
                  "view_own_transactions",
                ]}
              >
                <TransactionHistory />
              </ProtectedRoute>
            }
          />

          <Route path="/" element={<Navigate to="/cashier" replace />} />
        </Routes>
      </div>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppShell />
          <Toaster />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
