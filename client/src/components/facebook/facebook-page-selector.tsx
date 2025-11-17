import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";

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
          <AlertDescription>
            Failed to load Facebook Pages. Please reconnect your Facebook
            account.
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
          <AlertDescription>
            No Facebook Pages found. Please connect a Facebook Page to post.
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
