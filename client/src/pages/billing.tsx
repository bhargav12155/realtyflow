import { Sidebar } from "@/components/layout/sidebar";
import { BillingOverview } from "@/components/billing/BillingOverview";
import { BillingHistory } from "@/components/billing/BillingHistory";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";

export default function BillingPage() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar activeView="billing" />
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Billing & Credits</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Manage your credits, view transaction history, and purchase more credits
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-3 mb-8">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="payments" disabled>
                Payments
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <BillingOverview />
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="space-y-6">
              <BillingHistory />
            </TabsContent>

            {/* Payments Tab (Phase 2) */}
            <TabsContent value="payments" className="space-y-6">
              <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
                <p className="text-gray-600">Payment methods coming in Phase 2</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
