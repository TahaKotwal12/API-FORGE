'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth.context';
import { orgsApi } from '@/lib/api';

export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    orgsApi.list().then((orgs) => {
      if (orgs.length > 0) {
        router.replace(`/orgs/${orgs[0].slug}`);
      } else {
        router.replace('/onboarding');
      }
    }).catch(() => {
      router.replace('/onboarding');
    });
  }, [user, loading, router]);

  return null;
}
