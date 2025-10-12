import { UserSettings } from "@/components/settings/UserSettings";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6">Settings</h1>
        <UserSettings />
      </div>
    </div>
  );
}
