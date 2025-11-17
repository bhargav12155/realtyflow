import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FacebookPageSelector } from "@/components/facebook/facebook-page-selector";
import { InstagramAccountSelector } from "@/components/instagram/instagram-account-selector";
import { Loader2 } from "lucide-react";

interface PostingDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  platform: string | null;
  isPosting?: boolean;
  
  // Facebook props
  facebookPages?: any[];
  isLoadingPages?: boolean;
  isPagesError?: boolean;
  pagesError?: Error | null;
  selectedPageId?: string | null;
  onPageChange?: (pageId: string | null) => void;
  
  // Instagram props
  instagramAccounts?: any[];
  isLoadingInstagram?: boolean;
  isInstagramError?: boolean;
  instagramError?: Error | null;
  selectedInstagramAccountId?: string | null;
  onInstagramAccountChange?: (accountId: string | null) => void;
}

export function PostingDialog({
  open,
  onClose,
  onConfirm,
  platform,
  isPosting = false,
  facebookPages = [],
  isLoadingPages = false,
  isPagesError = false,
  pagesError = null,
  selectedPageId = null,
  onPageChange = () => {},
  instagramAccounts = [],
  isLoadingInstagram = false,
  isInstagramError = false,
  instagramError = null,
  selectedInstagramAccountId = null,
  onInstagramAccountChange = () => {},
}: PostingDialogProps) {
  const platformName = platform?.toLowerCase();
  const isFacebook = platformName === "facebook";
  const isInstagram = platformName === "instagram";

  const canPost = isFacebook 
    ? selectedPageId !== null 
    : isInstagram 
    ? selectedInstagramAccountId !== null 
    : true;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-posting">
        <DialogHeader>
          <DialogTitle data-testid="text-posting-title">
            Post to {platform}
          </DialogTitle>
          <DialogDescription data-testid="text-posting-description">
            {isFacebook && "Select the Facebook page you want to post to"}
            {isInstagram && "Select the Instagram account you want to post to"}
            {!isFacebook && !isInstagram && `Confirm posting to ${platform}`}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isFacebook && (
            <FacebookPageSelector
              pages={facebookPages}
              isLoading={isLoadingPages}
              isError={isPagesError}
              error={pagesError}
              value={selectedPageId}
              onChange={onPageChange}
              label="Select Facebook Page"
              placeholder="Choose a page to post to..."
              showLabel={true}
            />
          )}

          {isInstagram && (
            <InstagramAccountSelector
              accounts={instagramAccounts}
              isLoading={isLoadingInstagram}
              isError={isInstagramError}
              error={instagramError}
              value={selectedInstagramAccountId}
              onChange={onInstagramAccountChange}
              label="Select Instagram Account"
              placeholder="Choose an account to post to..."
              showLabel={true}
            />
          )}

          {!isFacebook && !isInstagram && (
            <p className="text-sm text-muted-foreground">
              Your content will be posted to {platform}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isPosting}
            data-testid="button-cancel-posting"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!canPost || isPosting}
            data-testid="button-confirm-posting"
          >
            {isPosting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Posting...
              </>
            ) : (
              "Post Now"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
