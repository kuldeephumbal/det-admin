import SettingsTabs from '@/components/admin/SettingsTabs';
import Topbar from '@/components/admin/Topbar';

export const dynamic = 'force-dynamic';

// Wraps every /admin/settings/* page with a shared Topbar + horizontal
// tab nav. Individual pages just emit their <main> content.
export default function SettingsLayout({ children }) {
  return (
    <>
      <Topbar title="Settings" subtitle="Configure how DET runs" />
      <SettingsTabs />
      {children}
    </>
  );
}
