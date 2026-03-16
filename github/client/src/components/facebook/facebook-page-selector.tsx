import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, RefreshCw, Plus, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

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
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualPageId, setManualPageId] = useState("");
  const [manualPageName, setManualPageName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleSaveManualPage = async () => {
    if (!manualPageId.trim()) {
      toast({ title: "Please enter a Page ID", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const response = await apiRequest("POST", "/api/facebook/pages/manual", {
        pageId: manualPageId.trim(),
        pageName: manualPageName.trim() || undefined,
      });
      const data = await response.json();

      if (data.success) {
        toast({ title: "Page added successfully!", description: `"${data.page.name}" has been saved.` });
        setManualPageId("");
        setManualPageName("");
        setShowManualEntry(false);
        if (onRefresh) onRefresh();
      } else {
        toast({ title: "Failed to save page", description: data.error, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error saving page", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

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
            <div className="flex items-center gap-2 mt-1">
              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 underline w-fit"
                  data-testid="button-refresh-facebook-pages"
                >
                  <RefreshCw className="h-3 w-3" />
                  Refresh Pages
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowManualEntry(true)}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 underline w-fit"
                data-testid="button-manual-page-entry"
              >
                <Plus className="h-3 w-3" />
                Enter Page ID manually
              </button>
            </div>
          </AlertDescription>
        </Alert>

        {showManualEntry && (
          <div className="border rounded-md p-3 space-y-3 bg-muted/30" data-testid="manual-page-entry-form">
            <p className="text-xs text-muted-foreground">
              Find your Page ID: Go to your Facebook Page → About → scroll down to "Page ID"
            </p>
            <div className="space-y-2">
              <Input
                placeholder="Page ID (e.g., 123456789012345)"
                value={manualPageId}
                onChange={(e) => setManualPageId(e.target.value)}
                data-testid="input-manual-page-id"
              />
              <Input
                placeholder="Page Name (optional)"
                value={manualPageName}
                onChange={(e) => setManualPageName(e.target.value)}
                data-testid="input-manual-page-name"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSaveManualPage}
                disabled={isSaving || !manualPageId.trim()}
                data-testid="button-save-manual-page"
              >
                {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                Save Page
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowManualEntry(false)}
                data-testid="button-cancel-manual-page"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
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
