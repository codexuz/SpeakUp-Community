import { apiDeleteAccount } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useState } from 'react';

export function useDeleteAccount() {
  const [loading, setLoading] = useState(false);
  const { logout } = useAuth();

  async function deleteAccount(password: string) {
    setLoading(true);
    try {
      await apiDeleteAccount(password);
      logout();
    } finally {
      setLoading(false);
    }
  }

  return { deleteAccount, loading };
}
