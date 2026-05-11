import { CheckCircle2, ExternalLink } from "lucide-react";

const INSTAGRAM_PERMISSION_MARKERS = [
  "Instagram Content Publishing API not available",
  "instagram_business_content_publish",
  "Instagram content publishing permission not granted",
  "Unsupported request",
];

export function isInstagramPermissionError(message: string | undefined | null): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return INSTAGRAM_PERMISSION_MARKERS.some((marker) =>
    lower.includes(marker.toLowerCase()),
  );
}

export function InstagramPermissionChecklist() {
  return (
    <div className="space-y-2 text-sm" data-testid="banner-instagram-permission">
      <p className="font-medium">
        Instagram needs three things approved on Meta's side before posting works:
      </p>
      <ul className="space-y-1.5">
        <li className="flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 opacity-80" />
          <span>
            Your Instagram account must be a <strong>Business or Creator</strong> account
            (Instagram app → Settings → Account → Switch to professional account).
          </span>
        </li>
        <li className="flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 opacity-80" />
          <span>
            Your Meta app must have <code className="px-1 rounded bg-black/20">instagram_business_content_publish</code>{" "}
            approved through App Review.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 opacity-80" />
          <span>
            Your Meta app must be in <strong>Live</strong> mode (not Development).
          </span>
        </li>
      </ul>
      <a
        href="https://developers.facebook.com/apps"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 underline font-medium pt-1"
        data-testid="link-meta-dashboard"
      >
        Open Meta App Dashboard
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
