import AdminShell from '@/components/admin/AdminShell';
import { requireAdmin } from '@/lib/admin/serverAuth';

export const dynamic = 'force-dynamic';

export default async function ProtectedAdminLayout({ children }) {
  const admin = await requireAdmin();
  return <AdminShell admin={admin}>{children}</AdminShell>;
}
