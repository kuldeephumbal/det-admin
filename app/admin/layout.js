// Top-level admin layout. Intentionally minimal — auth + sidebar live in
// app/admin/(protected)/layout.js. The (protected) route group cordons off
// everything that needs an authenticated admin session, while /admin/login
// stays public.

export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }) {
  return <div className="min-h-screen bg-zinc-50">{children}</div>;
}
