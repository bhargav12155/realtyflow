import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, TrendingUp } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";

interface WalletAccount {
  userId: string;
  balanceCredits: number;
  createdAt: string;
  updatedAt: string;
}

interface UsageEvent {
  id: string;
  userId: string;
  provider: string;
  feature: string;
  status: "charged" | "refunded" | "blocked";
  estimatedCredits: number;
  actualCredits: number | null;
  createdAt: string;
}

interface UsageSummary {
  totalEvents: number;
  byStatus: {
    charged: number;
    refunded: number;
    blocked: number;
  };
  byProvider: Record<string, number>;
  totalChargedCredits: number;
  totalRefundedCredits: number;
}

export function BillingOverview() {
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const { data: wallet, isLoading: walletLoading } = useQuery<WalletAccount>({
    queryKey: ["/api/billing/credits"],
  });

  const { data: usageData, isLoading: usageLoading } = useQuery<{ summary: UsageSummary; events: UsageEvent[] }>({
    queryKey: ["/api/admin/billing/usage", { limit: 100 }],
  });

  const summary = usageData?.summary;
  const credits = wallet?.balanceCredits ?? 0;

  // Calculate monthly stats from usage events
  const thisMonthEvents = usageData?.events.filter((e) => {
    const eventDate = new Date(e.createdAt);
    const now = new Date();
    return (
      eventDate.getMonth() === now.getMonth() &&
      eventDate.getFullYear() === now.getFullYear() &&
      e.status === "charged"
    );
  }) ?? [];

  const monthlySpent = thisMonthEvents.reduce((sum, e) => sum + (e.actualCredits || 0), 0);
  const estimatedCost = monthlySpent * 0.1; // 1 credit = $0.10

  const handleAddCredits = async () => {
    setIsCheckingOut(true);
    try {
      // Phase 2: This will call /api/billing/checkout
      // For now, show a message
      alert("Stripe checkout coming in Phase 2!");
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Balance Card */}
      <Card className="border-2 border-blue-100 bg-gradient-to-br from-blue-50 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-blue-600" />
            Your Credits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="text-4xl font-bold text-blue-600">
                {walletLoading ? <Loader2 className="h-8 w-8 animate-spin" /> : credits}
              </div>
              <p className="text-sm text-gray-600 mt-1">Current Balance</p>
              <p className="text-xs text-gray-500">1 credit = $0.10 value</p>
            </div>

            {/* This Month Stats */}
            <div className="border-t pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-wide">Usage This Month</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {usageLoading ? "—" : monthlySpent}
                  </p>
                  <p className="text-xs text-gray-500">credits used</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-wide">Est. Cost</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {usageLoading ? "—" : `$${estimatedCost.toFixed(2)}`}
                  </p>
                  <p className="text-xs text-gray-500">this month</p>
                </div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleAddCredits}
                disabled={isCheckingOut}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {isCheckingOut ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Add More Credits
                  </>
                )}
              </Button>
              <Button variant="outline" className="flex-1">
                🎟️ Redeem Coupon
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{summary.totalEvents}</div>
              <p className="text-xs text-gray-500 mt-1">
                <span className="text-green-600 font-semibold">{summary.byStatus.charged}</span> charged ·{" "}
                <span className="text-orange-600 font-semibold">{summary.byStatus.refunded}</span> refunded
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                Most Used
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {Object.entries(summary.byProvider).sort(([, a], [, b]) => b - a)[0]?.[0] || "—"}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {Object.entries(summary.byProvider).sort(([, a], [, b]) => b - a)[0]?.[1] || 0} uses
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{summary.totalChargedCredits}</div>
              <p className="text-xs text-gray-500 mt-1">${(summary.totalChargedCredits * 0.1).toFixed(2)} total</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
