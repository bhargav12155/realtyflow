import { Sidebar } from "@/components/layout/sidebar";
import { UserSettings } from "@/components/settings/UserSettings";

export default function SettingsPage() {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar activeView="settings" />
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto py-8">
          <h1 className="text-3xl font-bold mb-6">Settings</h1>
          <UserSettings />
        </div>
      </main>
    </div>
  );
}
