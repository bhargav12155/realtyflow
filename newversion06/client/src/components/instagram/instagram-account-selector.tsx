import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import type { InstagramAccount } from "@/hooks/use-instagram-accounts";

interface InstagramAccountSelectorProps {
  accounts: InstagramAccount[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  value: string | undefined;
  onChange: (accountId: string | undefined) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  showLabel?: boolean;
}

export function InstagramAccountSelector({
  accounts,
  isLoading,
  isError,
  error,
  value,
  onChange,
  label = "Instagram Account",
  placeholder = "Choose an Instagram account...",
  disabled = false,
  showLabel = true,
}: InstagramAccountSelectorProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {showLabel && <Label>{label}</Label>}
        <div
          className="flex items-center space-x-2 p-3 border rounded-md bg-muted/50"
          data-testid="instagram-accounts-loading"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">
            Loading Instagram Accounts...
          </span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-2">
        {showLabel && <Label>{label}</Label>}
        <Alert variant="destructive" data-testid="instagram-accounts-error">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load Instagram accounts. Make sure your Instagram Business
            accounts are linked to your Facebook Pages.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="space-y-2">
        {showLabel && <Label>{label}</Label>}
        <Alert data-testid="instagram-accounts-empty">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No Instagram Business accounts found. Please link an Instagram
            Business account to your Facebook Page first.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {showLabel && <Label htmlFor="instagram-account-select">{label}</Label>}
      <Select
        value={value || ""}
        onValueChange={(val) => onChange(val || undefined)}
        disabled={disabled}
      >
        <SelectTrigger
          id="instagram-account-select"
          data-testid="select-instagram-account"
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {accounts.map((account) => (
            <SelectItem
              key={account.instagramBusinessAccountId}
              value={account.instagramBusinessAccountId}
              data-testid={`instagram-account-${account.instagramBusinessAccountId}`}
            >
              {account.username || account.pageName}
              {account.username && (
                <span className="text-muted-foreground ml-2">
                  (via {account.pageName})
                </span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
