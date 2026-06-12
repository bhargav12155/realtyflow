import { Button } from "@/components/ui/button";
import { CalendarPlus, ChevronDown, Download, Globe } from "lucide-react";
import { SiGooglecalendar } from "react-icons/si";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  downloadICS,
  getGoogleCalendarUrl,
  getOutlookCalendarUrl,
  getYahooCalendarUrl,
} from "@/lib/calendarExport";
import { useToast } from "@/hooks/use-toast";

interface AddToCalendarProps {
  event: {
    title: string;
    description?: string | null;
    startTime: string;
    endTime?: string | null;
    location?: string | null;
    isAllDay?: boolean;
    eventUrl?: string | null;
  };
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function AddToCalendar({ event, variant = "outline", size = "sm", className }: AddToCalendarProps) {
  const { toast } = useToast();

  const handleGoogle = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(getGoogleCalendarUrl(event), "_blank");
    toast({ title: "Opening Google Calendar", description: "Event details have been pre-filled." });
  };

  const handleOutlook = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(getOutlookCalendarUrl(event), "_blank");
    toast({ title: "Opening Outlook Calendar", description: "Event details have been pre-filled." });
  };

  const handleYahoo = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(getYahooCalendarUrl(event), "_blank");
    toast({ title: "Opening Yahoo Calendar", description: "Event details have been pre-filled." });
  };

  const handleICS = (e: React.MouseEvent) => {
    e.stopPropagation();
    downloadICS(event);
    toast({ title: "Calendar File Downloaded", description: "Open the .ics file with any calendar app." });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant={variant} size={size} className={className} data-testid="button-add-to-calendar">
          <CalendarPlus className="h-3.5 w-3.5 mr-1.5" />
          Add to Calendar
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={handleGoogle} className="cursor-pointer" data-testid="menu-google-calendar">
          <SiGooglecalendar className="h-4 w-4 mr-2 text-blue-500" />
          Google Calendar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleOutlook} className="cursor-pointer" data-testid="menu-outlook-calendar">
          <Globe className="h-4 w-4 mr-2 text-blue-600" />
          Microsoft Outlook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleYahoo} className="cursor-pointer" data-testid="menu-yahoo-calendar">
          <Globe className="h-4 w-4 mr-2 text-purple-600" />
          Yahoo Calendar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleICS} className="cursor-pointer" data-testid="menu-download-ics">
          <Download className="h-4 w-4 mr-2 text-gray-500" />
          Download .ics File
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
