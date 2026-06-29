import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, Trash2, Plus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";

interface PaymentMethod {
  id: string;
  type: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

interface PaymentMethodsResponse {
  paymentMethods: PaymentMethod[];
}

export function PaymentMethods() {
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const { data: response, isLoading } = useQuery<PaymentMethodsResponse>({
    queryKey: ["/api/billing/payment-methods"],
    queryFn: async (): Promise<PaymentMethodsResponse> => {
      try {
        const res = await apiRequest("GET", "/api/billing/payment-methods");
        return (await res.json()) as PaymentMethodsResponse;
      } catch {
        return { paymentMethods: [] };
      }
    },
  });

  const paymentMethods = response?.paymentMethods ?? [];

  const handleDeletePaymentMethod = async (paymentMethodId: string) => {
    setIsDeleting(paymentMethodId);
    try {
      await apiRequest("DELETE", `/api/billing/payment-methods/${paymentMethodId}`);
      // Invalidate query to refresh
      window.location.reload();
    } catch (error) {
      console.error("Failed to delete payment method:", error);
    } finally {
      setIsDeleting(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment Methods</CardTitle>
          <CardDescription>Manage your saved payment methods</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>Manage your saved cards and payment options</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {paymentMethods.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
            <CreditCard className="h-8 w-8 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-600 mb-4">No payment methods saved yet</p>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Payment Method
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-4 bg-white"
              >
                <div className="flex items-center gap-4">
                  <CreditCard className="h-6 w-6 text-gray-400" />
                  <div>
                    <div className="font-medium text-gray-900 capitalize">
                      {method.brand} ending in {method.last4}
                    </div>
                    <div className="text-sm text-gray-500">
                      Expires {String(method.expMonth).padStart(2, "0")}/{method.expYear}
                      {method.isDefault && <span className="ml-2 badge badge-primary">Default</span>}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDeletePaymentMethod(method.id)}
                  disabled={isDeleting === method.id}
                  className="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting === method.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            ))}
            <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Another Payment Method
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
