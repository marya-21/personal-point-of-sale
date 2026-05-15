import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export function ProtectedRoute({ children, requiredPermission, anyPermission, fallback = '/login' }) {
  const { isAuthenticated, loading, hasPermission } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={fallback} replace />;
  }

  const permitted =
    (!requiredPermission && !anyPermission) ||
    (requiredPermission && hasPermission(requiredPermission)) ||
    (anyPermission && anyPermission.some(hasPermission));

  if (!permitted) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Akses Ditolak</h1>
          <p className="text-gray-500">Anda tidak memiliki izin untuk mengakses halaman ini.</p>
        </div>
      </div>
    );
  }

  return children;
}
