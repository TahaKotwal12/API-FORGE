'use client';

import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/lib/api';
import { useAuth } from '@/contexts/auth.context';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

export default function AccountPage() {
  const { user } = useAuth();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.me(),
    enabled: !!user,
  });

  if (isLoading || !profile) {
    return (
      <AppLayout>
        <div className="p-6 space-y-4 max-w-lg">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-40" />
        </div>
      </AppLayout>
    );
  }

  const initials = profile.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-lg">
        <h1 className="text-xl font-semibold">Account</h1>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} />}
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <p className="font-medium">{profile.name}</p>
              <p className="text-sm text-[var(--text-muted)]">{profile.email}</p>
              <Badge variant={profile.emailVerified ? 'success' : 'warning'}>
                {profile.emailVerified ? 'Email verified' : 'Email unverified'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
