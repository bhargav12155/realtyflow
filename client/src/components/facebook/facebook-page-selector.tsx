import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";

interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
}

interface FacebookPageSelectorProps {
  pages: FacebookPage[];
  isLoading: boolean;
  isError: boolean;
  value: string | undefined;
  onChange: (pageId: string | undefined) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  showLabel?: boolean;
  onRefresh?: () => void;
  errorMessage?: string;
}

export function FacebookPageSelector({
  pages,
  isLoading,
  isError,
  value,
  onChange,
  label = "Select Facebook Page",
  placeholder = "Choose a page to post to...",
  disabled = false,
  showLabel = true,
  onRefresh,
  errorMessage,
}: FacebookPageSelectorProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {showLabel && <Label>{label}</Label>}
        <div 
          className="flex items-center space-x-2 p-3 border rounded-md bg-muted/50"
          data-testid="facebook-pages-loading"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">
            Loading Facebook Pages...
          </span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-2">
        {showLabel && <Label>{label}</Label>}
        <Alert variant="destructive" data-testid="facebook-pages-error">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex flex-col gap-2">
            <span>{errorMessage || "Failed to load Facebook Pages. Please reconnect your Facebook account."}</span>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex items-center gap-1 text-xs text-white/80 hover:text-white underline mt-1 w-fit"
                data-testid="button-refresh-facebook-pages-error"
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </button>
            )}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="space-y-2">
        {showLabel && <Label>{label}</Label>}
        <Alert data-testid="facebook-pages-empty">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex flex-col gap-2">
            <span>No Facebook Pages found</span>
            <span className="text-xs text-muted-foreground">
              Your Facebook account may not have any Pages linked, or the token may need the "pages_show_list" permission. Try disconnecting and reconnecting Facebook.
            </span>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 underline mt-1 w-fit"
                data-testid="button-refresh-facebook-pages"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh Pages
              </button>
            )}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {showLabel && <Label htmlFor="facebook-page-select">{label}</Label>}
      <Select
        value={value}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger
          id="facebook-page-select"
          data-testid="select-facebook-page"
          className="w-full"
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {pages.map((page) => (
            <SelectItem
              key={page.id}
              value={page.id}
              data-testid={`option-facebook-page-${page.id}`}
            >
              {page.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
