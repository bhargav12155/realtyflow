import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowDown, ArrowUp, XCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";

interface WalletLedgerEntry {
  id: string;
  userId: string;
  deltaCredits: number;
  balanceAfter: number;
  reason: string;
  requestId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

interface BillingHistoryResponse {
  wallet: unknown;
  recentLedger: WalletLedgerEntry[];
}

export function BillingHistory() {
  const [limit] = useState(50);

  const { data: walletData, isLoading } = useQuery<BillingHistoryResponse>({
    queryKey: ["/api/billing/history", limit],
    queryFn: async (): Promise<BillingHistoryResponse> => {
      const response = await apiRequest("GET", `/api/billing/history?limit=${limit}`);
      return (await response.json()) as BillingHistoryResponse;
    },
  });

  const ledger = walletData?.recentLedger ?? [];

  const getReasonLabel = (reason: string) => {
    const labels: Record<string, { label: string; description: string }> = {
      "brainstorm_chat": {
        label: "Brainstorm Chat",
        description: "AI conversation with brainstorm",
      },
      "luma_video_gen": {
        label: "Video Generation",
        description: "Video creation",
      },
      "admin_topup": {
        label: "Credits Added",
        description: "Credits added to your account",
      },
      "stripe_credit_purchase": {
        label: "Credit Purchase",
        description: "Credits purchased for this application",
      },
      "all_models_failed": {
        label: "Refund - All Failed",
        description: "All AI models failed",
      },
      "generation_failed": {
        label: "Refund - Generation Failed",
        description: "Generation process failed",
      },
      "dispatch_or_poll_exception": {
        label: "Refund - System Error",
        description: "System error occurred",
      },
      "system:initial_allocation": {
        label: "Initial Allocation",
        description: "System initialization",
      },
    };

    // Try exact match first
    if (labels[reason]) return labels[reason];

    // Try prefix match
    for (const [key, value] of Object.entries(labels)) {
      if (reason.includes(key)) return value;
    }

    // Default
    return {
      label: reason.replace(/_/g, " ").replace(/admin_/, "").toUpperCase(),
      description: reason,
    };
  };

  const getStatusIcon = (delta: number) => {
    if (delta > 0) return <ArrowUp className="h-4 w-4 text-green-600" />;
    if (delta < 0) return <ArrowDown className="h-4 w-4 text-red-600" />;
    return <XCircle className="h-4 w-4 text-gray-400" />;
  };

  const getStatusColor = (delta: number) => {
    if (delta > 0) return "bg-green-50 border-green-200";
    if (delta < 0) return "bg-red-50 border-red-200";
    return "bg-gray-50 border-gray-200";
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>Your recent credit transactions</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (ledger.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>Your recent credit transactions</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-gray-500">No transactions yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction History</CardTitle>
        <CardDescription>Your recent credit transactions (last 50)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {ledger.map((entry) => {
            const reason = getReasonLabel(entry.reason);

            return (
              <div
                key={entry.id}
                className={`flex items-start gap-4 p-4 rounded-lg border ${getStatusColor(entry.deltaCredits)}`}
              >
                {/* Icon */}
                <div className="flex-shrink-0 mt-1">{getStatusIcon(entry.deltaCredits)}</div>

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">{reason.label}</p>
                      <p className="text-sm text-gray-600">{reason.description}</p>
                      <p className="text-xs text-gray-500 mt-1">{formatDate(entry.createdAt)}</p>
                    </div>
                  </div>
                </div>

                {/* Amount & Balance */}
                <div className="flex-shrink-0 text-right">
                  <p className={`text-lg font-bold ${entry.deltaCredits > 0 ? "text-green-600" : "text-red-600"}`}>
                    {entry.deltaCredits > 0 ? "+" : ""}
                    {entry.deltaCredits}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">Balance: {entry.balanceAfter}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
