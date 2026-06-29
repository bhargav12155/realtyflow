import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useEffect, useState } from "react";

interface WalletAccount {
  userId: string;
  balanceCredits: number;
  createdAt: string;
  updatedAt: string;
}

export function BillingOverview() {
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [selectedCredits, setSelectedCredits] = useState(100);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);

  const { data: wallet, isLoading: walletLoading } = useQuery<WalletAccount>({
    queryKey: ["/api/billing/credits"],
  });
  const credits = wallet?.balanceCredits ?? 0;
  const creditPacks = [100, 250, 500, 1000];
  const selectedPriceUsd = selectedCredits * 0.1;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    const sessionId = params.get("session_id");

    if (checkout === "cancelled") {
      setCheckoutMessage("Payment was cancelled. No credits were added.");
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }

    if (checkout !== "success" || !sessionId) return;

    let cancelled = false;
    setCheckoutMessage("Confirming payment and releasing credits...");

    apiRequest("GET", `/api/billing/checkout-session/${encodeURIComponent(sessionId)}`)
      .then(async (response) => {
        const data = (await response.json()) as { paid?: boolean; credits?: number; balance?: number };
        if (cancelled) return;
        if (data.paid) {
          setCheckoutMessage(`${data.credits ?? "Your"} credits are now available in your account.`);
          queryClient.invalidateQueries({ queryKey: ["/api/billing/credits"] });
          queryClient.invalidateQueries({ queryKey: ["/api/billing/history"] });
        } else {
          setCheckoutMessage("Payment is still processing. Credits will be added after payment is confirmed.");
        }
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Could not confirm payment.";
        setCheckoutMessage(message);
      })
      .finally(() => {
        if (!cancelled) {
          window.history.replaceState(null, "", window.location.pathname);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleAddCredits = async () => {
    setIsCheckingOut(true);
    try {
      setCheckoutMessage(null);
      const response = await apiRequest("POST", "/api/billing/checkout", { credits: selectedCredits });
      const data = (await response.json()) as { checkoutUrl?: string };
      if (!data.checkoutUrl) throw new Error("Checkout could not be started.");
      window.location.assign(data.checkoutUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start checkout.";
      setCheckoutMessage(message);
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
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wide">Buy credits</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                  {creditPacks.map((pack) => (
                    <button
                      key={pack}
                      type="button"
                      onClick={() => setSelectedCredits(pack)}
                      className={`rounded-md border px-3 py-3 text-left transition-colors ${
                        selectedCredits === pack
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50"
                      }`}
                    >
                      <span className="block text-lg font-semibold">{pack}</span>
                      <span className="block text-xs text-gray-500">${(pack * 0.1).toFixed(2)}</span>
                    </button>
                  ))}
                </div>
                <p className="text-sm text-gray-700 mt-3">
                  Credits are added to your account after a successful card payment.
                </p>
              </div>
            </div>

            {checkoutMessage ? (
              <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                {checkoutMessage}
              </div>
            ) : null}

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
                    Pay ${selectedPriceUsd.toFixed(2)}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
