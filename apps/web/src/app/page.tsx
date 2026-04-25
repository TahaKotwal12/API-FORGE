import { redirect } from 'next/navigation';

// Root → redirect to /orgs or /login (handled client-side via AuthProvider)
export default function RootPage() {
  redirect('/login');
}
