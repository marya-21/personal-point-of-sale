import { useContext } from 'react';
import { AuthContext } from '../auth/AuthContext';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth harus digunakan dalam AuthProvider');
  }
  return context;
}

export function usePermission(permissionName) {
  const { hasPermission } = useAuth();
  return hasPermission(permissionName);
}

export function useRole() {
  const { user } = useAuth();
  return user?.role?.name || null;
}
