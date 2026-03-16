import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import { Sidebar } from "@/components/layout/sidebar";
import { Calendar, Plus, Trash2, RefreshCw, Settings, Sparkles, Clock, MapPin, ExternalLink, Check, X, Loader2, CalendarDays, Link2, Wand2, ListChecks, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AddToCalendar } from "@/components/shared/add-to-calendar";

interface EventSource {
  id: string;
  name: string;
  type: string;
  status: string;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  syncError: string | null;
  createdAt: string;
}

interface Event {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  location: string | null;
  category: string | null;
  eventUrl: string | null;
  isAllDay: boolean;
}

interface EventPostSuggestion {
  id: string;
  platform: string;
  content: string;
  hashtags: string[];
  suggestedPostTime: string | null;
  status: string;
}

interface WeeklyPlanSuggestion extends EventPostSuggestion {
  eventTitle: string;
  eventDate: string;
}

const eventFormSchema = z.object({
  title: z.string().min(1, "Event title is required").max(200, "Title is too long"),
  date: z.string().min(1, "Date is required").refine((val) => {
    const parsed = new Date(val);
    return !isNaN(parsed.getTime());
  }, "Please enter a valid date"),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  isAllDay: z.boolean().default(false),
  location: z.string().optional(),
  description: z.string().max(2000, "Description is too long").optional(),
  category: z.string().default("community"),
}).refine(
  (data) => {
    if (!data.isAllDay && !data.startTime) {
      return false;
    }
    return true;
  },
  { message: "Start time is required for non-all-day events", path: ["startTime"] }
).refine(
  (data) => {
    if (data.startTime && data.endTime) {
      return data.endTime > data.startTime;
    }
    return true;
  },
  { message: "End time must be after start time", path: ["endTime"] }
);

const sourceFormSchema = z.object({
  name: z.string().min(1, "Source name is required").max(100, "Name is too long"),
  type: z.enum(["ical", "google_calendar_public"], {
    required_error: "Please select a source type",
  }),
  url: z.string().min(1, "URL is required").refine((url) => {
    if (url.includes("calendar.google.com") || url.endsWith(".ics") || url.includes("webcal://")) {
      return true;
    }
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }, "Please enter a valid calendar URL or Google Calendar ID"),
});

type EventFormData = z.infer<typeof eventFormSchema>;
type SourceFormData = z.infer<typeof sourceFormSchema>;

export default function EventsCalendarPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("weekly-planner");
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showAddSourceDialog, setShowAddSourceDialog] = useState(false);
  const [showAddEventDialog, setShowAddEventDialog] = useState(false);

  const eventForm = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: "",
      date: "",
      startTime: "",
      endTime: "",
      isAllDay: false,
      location: "",
      description: "",
      category: "community",
    },
  });

  const sourceForm = useForm<SourceFormData>({
    resolver: zodResolver(sourceFormSchema),
    defaultValues: {
      name: "",
      type: "ical",
      url: "",
    },
  });

  const { data: sourcesData, isLoading: sourcesLoading } = useQuery<{ sources: EventSource[] }>({
    queryKey: ["/api/events/sources"],
  });

  const { data: eventsData, isLoading: eventsLoading } = useQuery<{ events: Event[] }>({
    queryKey: ["/api/events"],
  });

  const { data: companyProfile } = useQuery<any>({ queryKey: ["/api/company/profile"] });
  const { data: userPreferences } = useQuery<any>({ queryKey: ["/api/user/preferences"] });

  const cityName: string = (() => {
    const serviceArea: string = userPreferences?.serviceArea || "";
    if (serviceArea) {
      const parts = serviceArea.split(",");
      return parts[0].trim() || serviceArea.trim();
    }
    return companyProfile?.city || "Local";
  })();

  const isOmahaUser: boolean = (() => {
    const serviceArea: string = (userPreferences?.serviceArea || "").toLowerCase();
    const city: string = (companyProfile?.city || "").toLowerCase();
    const state: string = (companyProfile?.state || "").toLowerCase();
    return serviceArea.includes("omaha") || serviceArea.includes(", ne") ||
      city === "omaha" || state === "ne" || state === "nebraska";
  })();

  const { data: suggestionsData, refetch: refetchSuggestions } = useQuery<{ suggestions: EventPostSuggestion[] }>({
    queryKey: ["/api/events", selectedEvent?.id, "suggestions"],
    enabled: !!selectedEvent,
  });

  const { data: templatesData } = useQuery<{ templates: { name: string; type: string; calendarId?: string; icalUrl?: string }[] }>({
    queryKey: ["/api/events/templates"],
  });

  const createSourceMutation = useMutation({
    mutationFn: async (data: { name: string; type: string; config: any }) => {
      const res = await apiRequest("POST", "/api/events/sources", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Source Added", description: "Calendar source added successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/events/sources"] });
      setShowAddSourceDialog(false);
      resetSourceForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteSourceMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/events/sources/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Source Removed", description: "Calendar source removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/events/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    },
  });

  const syncSourceMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/events/sources/${id}/sync`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Sync Complete", 
        description: `Added ${data.added} events, updated ${data.updated}.` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/events/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    },
    onError: (error: Error) => {
      toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
    },
  });

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/events/sync-all");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "All Sources Synced", 
        description: `Processed ${data.sourcesProcessed} sources. Added ${data.totalAdded} events.` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/events/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/events", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Event Created", description: "Your event has been added." });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setShowAddEventDialog(false);
      resetEventForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const generatePostsMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const res = await apiRequest("POST", `/api/events/${eventId}/generate-posts`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Posts Generated", description: "AI has created post suggestions for this event." });
      refetchSuggestions();
    },
    onError: (error: Error) => {
      toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
    },
  });

  const acceptSuggestionMutation = useMutation({
    mutationFn: async (suggestionId: string) => {
      const res = await apiRequest("POST", `/api/events/suggestions/${suggestionId}/accept`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Post Scheduled", description: "The post has been added to your schedule." });
      refetchSuggestions();
    },
  });

  const rejectSuggestionMutation = useMutation({
    mutationFn: async (suggestionId: string) => {
      const res = await apiRequest("POST", `/api/events/suggestions/${suggestionId}/reject`);
      return res.json();
    },
    onSuccess: () => {
      refetchSuggestions();
    },
  });

  const [weeklyPlanSuggestions, setWeeklyPlanSuggestions] = useState<WeeklyPlanSuggestion[]>([]);
  const [isOmahaSourcesSetup, setIsOmahaSourcesSetup] = useState(false);

  const setupOmahaSourcesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/events/setup-omaha-sources");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Local Sources Added", 
        description: data.message || `Added ${data.addedSources} real estate event sources` 
      });
      setIsOmahaSourcesSetup(true);
      queryClient.invalidateQueries({ queryKey: ["/api/events/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    },
    onError: (error: Error) => {
      toast({ title: "Setup Failed", description: error.message, variant: "destructive" });
    },
  });

  const generateWeeklyPlanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/events/generate-weekly-plan", {
        platforms: ['facebook', 'instagram', 'linkedin', 'x'],
      });
      return res.json();
    },
    onSuccess: (data) => {
      setWeeklyPlanSuggestions(data.suggestions || []);
      toast({ 
        title: "Weekly Plan Generated", 
        description: `Created ${data.suggestions?.length || 0} post suggestions for upcoming events` 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
    },
  });

  const acceptWeeklyPlanSuggestionMutation = useMutation({
    mutationFn: async (suggestionId: string) => {
      const res = await apiRequest("POST", `/api/events/suggestions/${suggestionId}/accept`);
      return res.json();
    },
    onSuccess: (_, suggestionId) => {
      setWeeklyPlanSuggestions(prev => 
        prev.map(s => s.id === suggestionId ? { ...s, status: 'accepted' } : s)
      );
      toast({ title: "Post Scheduled", description: "The post has been added to your schedule." });
    },
  });

  const rejectWeeklyPlanSuggestionMutation = useMutation({
    mutationFn: async (suggestionId: string) => {
      const res = await apiRequest("POST", `/api/events/suggestions/${suggestionId}/reject`);
      return res.json();
    },
    onSuccess: (_, suggestionId) => {
      setWeeklyPlanSuggestions(prev => 
        prev.map(s => s.id === suggestionId ? { ...s, status: 'rejected' } : s)
      );
    },
  });

  const resetSourceForm = () => {
    sourceForm.reset();
  };

  const resetEventForm = () => {
    eventForm.reset();
  };

  const handleAddSource = (data: SourceFormData) => {
    const config: Record<string, string> = {};
    if (data.type === "ical") {
      config.icalUrl = data.url;
    } else if (data.type === "google_calendar_public") {
      config.calendarId = data.url;
    }
    
    createSourceMutation.mutate({
      name: data.name,
      type: data.type,
      config,
    });
  };

  const handleAddEvent = (data: EventFormData) => {
    let startTime: Date;
    let endTime: Date | undefined;
    
    if (data.isAllDay) {
      startTime = new Date(`${data.date}T00:00:00`);
      endTime = new Date(`${data.date}T23:59:59`);
    } else {
      startTime = new Date(`${data.date}T${data.startTime || "12:00"}`);
      if (data.endTime) {
        endTime = new Date(`${data.date}T${data.endTime}`);
      }
    }
    
    createEventMutation.mutate({
      title: data.title,
      description: data.description || undefined,
      startTime: startTime.toISOString(),
      endTime: endTime?.toISOString(),
      location: data.location || undefined,
      category: data.category,
      isAllDay: data.isAllDay,
    });
  };

  const handleAddTemplate = (template: { name: string; type: string; calendarId?: string; icalUrl?: string }) => {
    createSourceMutation.mutate({
      name: template.name,
      type: template.type,
      config: {
        calendarId: template.calendarId,
        icalUrl: template.icalUrl,
      },
    });
  };

  const sources = sourcesData?.sources || [];
  const events = eventsData?.events || [];
  const suggestions = suggestionsData?.suggestions || [];
  const templates = templatesData?.templates || [];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getCategoryColor = (category: string | null) => {
    switch (category) {
      case "real_estate": return "bg-blue-500";
      case "market": return "bg-green-500";
      case "festival": return "bg-purple-500";
      case "networking": return "bg-orange-500";
      case "entertainment": return "bg-pink-500";
      case "sports": return "bg-red-500";
      case "education": return "bg-yellow-500";
      default: return "bg-gray-500";
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "facebook": return "FB";
      case "instagram": return "IG";
      case "linkedin": return "LI";
      case "x": return "X";
      default: return platform.charAt(0).toUpperCase();
    }
  };

  const upcomingEvents = events
    .filter(e => new Date(e.startTime) > new Date())
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 10);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar activeView="events" />
      <main className="flex-1 overflow-y-auto">
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="page-title">
              <CalendarDays className="w-8 h-8" />
              Event Calendar
            </h1>
            <p className="text-muted-foreground">
              Track local events and generate timely social media posts
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => syncAllMutation.mutate()}
            disabled={syncAllMutation.isPending}
            data-testid="btn-sync-all"
          >
            {syncAllMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Sync All
          </Button>
          <Dialog open={showAddEventDialog} onOpenChange={(open) => {
            setShowAddEventDialog(open);
            if (!open) eventForm.reset();
          }}>
            <DialogTrigger asChild>
              <Button data-testid="btn-add-event">
                <Plus className="w-4 h-4 mr-2" />
                Add Event
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Manual Event</DialogTitle>
                <DialogDescription>
                  Add a local event to generate posts for
                </DialogDescription>
              </DialogHeader>
              <Form {...eventForm}>
                <form onSubmit={eventForm.handleSubmit(handleAddEvent)} className="space-y-4">
                  <FormField
                    control={eventForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Event Title</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder={`${cityName} Farmer's Market`}
                            data-testid="input-event-title"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={eventForm.control}
                    name="isAllDay"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>All-Day Event</FormLabel>
                          <FormDescription className="text-xs">
                            Toggle if this event runs the entire day
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-all-day"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={eventForm.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="date"
                            data-testid="input-event-date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {!eventForm.watch("isAllDay") && (
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={eventForm.control}
                        name="startTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Time</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="time"
                                data-testid="input-start-time"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={eventForm.control}
                        name="endTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>End Time (optional)</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="time"
                                data-testid="input-end-time"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  <FormField
                    control={eventForm.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location (optional)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder={`Event venue, ${cityName}`}
                            data-testid="input-event-location"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={eventForm.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-event-category">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="community">Community</SelectItem>
                            <SelectItem value="real_estate">Real Estate</SelectItem>
                            <SelectItem value="market">Market</SelectItem>
                            <SelectItem value="festival">Festival</SelectItem>
                            <SelectItem value="networking">Networking</SelectItem>
                            <SelectItem value="entertainment">Entertainment</SelectItem>
                            <SelectItem value="sports">Sports</SelectItem>
                            <SelectItem value="education">Education</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={eventForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Brief description of the event..."
                            data-testid="input-event-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit"
                    disabled={createEventMutation.isPending}
                    className="w-full"
                    data-testid="btn-create-event"
                  >
                    {createEventMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    Create Event
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="weekly-planner" data-testid="tab-weekly-planner">
            <Wand2 className="w-4 h-4 mr-2" />
            Weekly Planner
          </TabsTrigger>
          <TabsTrigger value="calendar" data-testid="tab-calendar">
            <Calendar className="w-4 h-4 mr-2" />
            Events
          </TabsTrigger>
          <TabsTrigger value="sources" data-testid="tab-sources">
            <Settings className="w-4 h-4 mr-2" />
            Sources
          </TabsTrigger>
        </TabsList>

        <TabsContent value="weekly-planner">
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wand2 className="w-5 h-5 text-primary" />
                    Generate Your Weekly Content Plan
                  </CardTitle>
                  <CardDescription>
                    Automatically fetch {cityName} real estate events and generate AI-powered social media posts for the week
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    {isOmahaUser && (
                    <Button
                      onClick={() => setupOmahaSourcesMutation.mutate()}
                      disabled={setupOmahaSourcesMutation.isPending || isOmahaSourcesSetup}
                      variant={isOmahaSourcesSetup ? "secondary" : "default"}
                      className="flex-1"
                      data-testid="btn-setup-omaha-sources"
                    >
                      {setupOmahaSourcesMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : isOmahaSourcesSetup ? (
                        <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                      ) : (
                        <ListChecks className="w-4 h-4 mr-2" />
                      )}
                      {isOmahaSourcesSetup ? `${cityName} Sources Ready` : `Setup ${cityName} Sources`}
                    </Button>
                    )}
                    <Button
                      onClick={() => generateWeeklyPlanMutation.mutate()}
                      disabled={generateWeeklyPlanMutation.isPending}
                      variant="default"
                      className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                      data-testid="btn-generate-weekly-plan"
                    >
                      {generateWeeklyPlanMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      Generate Weekly Plan
                    </Button>
                  </div>
                  {isOmahaUser && (
                  <p className="text-xs text-muted-foreground">
                    Sources: Omaha Daily Record, Omaha Realtors, OABR Calendar
                  </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>This Week's Events</CardTitle>
                  <CardDescription>
                    {(() => {
                      const now = new Date();
                      const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                      const weekEvents = events.filter(e => {
                        const eventDate = new Date(e.startTime);
                        return eventDate >= now && eventDate <= weekEnd;
                      });
                      return `${weekEvents.length} events this week`;
                    })()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {eventsLoading ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (() => {
                    const now = new Date();
                    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                    const weekEvents = events
                      .filter(e => {
                        const eventDate = new Date(e.startTime);
                        return eventDate >= now && eventDate <= weekEnd;
                      })
                      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
                    
                    if (weekEvents.length === 0) {
                      return (
                        <div className="text-center py-8 text-muted-foreground">
                          <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>No events this week</p>
                          <p className="text-sm">{isOmahaUser ? `Click "Setup ${cityName} Sources" to fetch local real estate events` : "Add a calendar source in the Sources tab to fetch local events"}</p>
                        </div>
                      );
                    }
                    
                    return (
                      <div className="space-y-3">
                        {weekEvents.map((event) => (
                          <div
                            key={event.id}
                            className="p-4 rounded-lg border bg-card"
                            data-testid={`week-event-${event.id}`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge className={getCategoryColor(event.category)} variant="secondary">
                                    {event.category || "community"}
                                  </Badge>
                                </div>
                                <h4 className="font-semibold">{event.title}</h4>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatDate(event.startTime)} {!event.isAllDay && formatTime(event.startTime)}
                                  </span>
                                  {event.location && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="w-3 h-3" />
                                      {event.location}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <AddToCalendar event={event} size="sm" variant="ghost" className="text-xs" />
                                {event.eventUrl && (
                                  <a 
                                    href={event.eventUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-muted-foreground hover:text-primary"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>

            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Generated Posts
                  </CardTitle>
                  <CardDescription>
                    {weeklyPlanSuggestions.filter(s => s.status === 'suggested').length} pending posts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {generateWeeklyPlanMutation.isPending ? (
                    <div className="flex flex-col items-center justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
                      <p className="text-sm text-muted-foreground">Generating your weekly content plan...</p>
                    </div>
                  ) : weeklyPlanSuggestions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No posts generated yet</p>
                      <p className="text-sm">Click "Generate Weekly Plan" to create AI-powered posts</p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[600px] overflow-y-auto">
                      {weeklyPlanSuggestions
                        .filter(s => s.status === 'suggested')
                        .map((suggestion) => (
                        <div key={suggestion.id} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {getPlatformIcon(suggestion.platform)}
                              </Badge>
                              <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                                {suggestion.eventTitle}
                              </span>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => acceptWeeklyPlanSuggestionMutation.mutate(suggestion.id)}
                                disabled={acceptWeeklyPlanSuggestionMutation.isPending}
                                data-testid={`btn-accept-weekly-${suggestion.id}`}
                              >
                                <Check className="w-4 h-4 text-green-500" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => rejectWeeklyPlanSuggestionMutation.mutate(suggestion.id)}
                                disabled={rejectWeeklyPlanSuggestionMutation.isPending}
                                data-testid={`btn-reject-weekly-${suggestion.id}`}
                              >
                                <X className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm">{suggestion.content}</p>
                          {suggestion.hashtags && suggestion.hashtags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {suggestion.hashtags.map((tag, i) => (
                                <span key={i} className="text-xs text-blue-500">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                          {suggestion.suggestedPostTime && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Suggested: {formatDate(suggestion.suggestedPostTime)}
                            </p>
                          )}
                        </div>
                      ))}
                      {weeklyPlanSuggestions.filter(s => s.status === 'accepted').length > 0 && (
                        <div className="border-t pt-4 mt-4">
                          <h5 className="text-sm font-medium text-green-600 mb-2 flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            Accepted Posts ({weeklyPlanSuggestions.filter(s => s.status === 'accepted').length})
                          </h5>
                          {weeklyPlanSuggestions
                            .filter(s => s.status === 'accepted')
                            .map((suggestion) => (
                            <div key={suggestion.id} className="p-2 bg-green-50 dark:bg-green-900/20 rounded text-sm mb-2">
                              <Badge variant="outline" className="mb-1">
                                {getPlatformIcon(suggestion.platform)}
                              </Badge>
                              <p className="text-xs truncate">{suggestion.eventTitle}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="calendar">
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Upcoming Events</CardTitle>
                  <CardDescription>
                    {events.length} events from {sources.length} sources
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {eventsLoading ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : upcomingEvents.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No upcoming events</p>
                      <p className="text-sm">Add a calendar source or create a manual event</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {upcomingEvents.map((event) => (
                        <div
                          key={event.id}
                          className={`p-4 rounded-lg border cursor-pointer transition-colors hover:bg-accent ${
                            selectedEvent?.id === event.id ? "border-primary bg-accent" : ""
                          }`}
                          onClick={() => setSelectedEvent(event)}
                          data-testid={`event-card-${event.id}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className={getCategoryColor(event.category)} variant="secondary">
                                  {event.category || "community"}
                                </Badge>
                                {event.isAllDay && (
                                  <Badge variant="outline">All Day</Badge>
                                )}
                              </div>
                              <h4 className="font-semibold" data-testid={`event-title-${event.id}`}>
                                {event.title}
                              </h4>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDate(event.startTime)} {!event.isAllDay && formatTime(event.startTime)}
                                </span>
                                {event.location && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {event.location}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <AddToCalendar event={event} size="sm" variant="ghost" className="text-xs" />
                              {event.eventUrl && (
                                <a 
                                  href={event.eventUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-muted-foreground hover:text-primary"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Generate Posts
                  </CardTitle>
                  <CardDescription>
                    {selectedEvent ? "Create AI-powered posts for this event" : "Select an event to generate posts"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedEvent ? (
                    <div className="space-y-4">
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium">{selectedEvent.title}</h4>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(selectedEvent.startTime)}
                            </p>
                          </div>
                          <AddToCalendar event={selectedEvent} size="sm" variant="outline" />
                        </div>
                      </div>

                      <Button
                        onClick={() => generatePostsMutation.mutate(selectedEvent.id)}
                        disabled={generatePostsMutation.isPending}
                        className="w-full"
                        data-testid="btn-generate-posts"
                      >
                        {generatePostsMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4 mr-2" />
                        )}
                        Generate Posts for All Platforms
                      </Button>

                      {suggestions.length > 0 && (
                        <div className="space-y-3 mt-4">
                          <h5 className="font-medium text-sm">Generated Suggestions</h5>
                          {suggestions
                            .filter(s => s.status === "suggested")
                            .map((suggestion) => (
                            <div key={suggestion.id} className="p-3 border rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <Badge variant="outline">
                                  {getPlatformIcon(suggestion.platform)}
                                </Badge>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => acceptSuggestionMutation.mutate(suggestion.id)}
                                    disabled={acceptSuggestionMutation.isPending}
                                    data-testid={`btn-accept-${suggestion.id}`}
                                  >
                                    <Check className="w-4 h-4 text-green-500" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => rejectSuggestionMutation.mutate(suggestion.id)}
                                    disabled={rejectSuggestionMutation.isPending}
                                    data-testid={`btn-reject-${suggestion.id}`}
                                  >
                                    <X className="w-4 h-4 text-red-500" />
                                  </Button>
                                </div>
                              </div>
                              <p className="text-sm">{suggestion.content}</p>
                              {suggestion.hashtags && suggestion.hashtags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {suggestion.hashtags.map((tag, i) => (
                                    <span key={i} className="text-xs text-blue-500">
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Select an event from the list</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sources">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Connected Sources</CardTitle>
                <CardDescription>
                  Calendar feeds and event sources
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sourcesLoading ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : sources.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Link2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No sources connected</p>
                    <p className="text-sm">Add a calendar source to start tracking events</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sources.map((source) => (
                      <div
                        key={source.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                        data-testid={`source-${source.id}`}
                      >
                        <div>
                          <h4 className="font-medium">{source.name}</h4>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Badge variant="outline">{source.type}</Badge>
                            {source.lastSyncAt && (
                              <span>
                                Last sync: {new Date(source.lastSyncAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          {source.syncError && (
                            <p className="text-xs text-red-500 mt-1">{source.syncError}</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => syncSourceMutation.mutate(source.id)}
                            disabled={syncSourceMutation.isPending}
                            data-testid={`btn-sync-${source.id}`}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteSourceMutation.mutate(source.id)}
                            disabled={deleteSourceMutation.isPending}
                            data-testid={`btn-delete-source-${source.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Dialog open={showAddSourceDialog} onOpenChange={(open) => {
                  setShowAddSourceDialog(open);
                  if (!open) sourceForm.reset();
                }}>
                  <DialogTrigger asChild>
                    <Button className="w-full mt-4" variant="outline" data-testid="btn-add-source">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Calendar Source
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Add Calendar Source</DialogTitle>
                      <DialogDescription>
                        Connect a calendar to automatically pull events
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...sourceForm}>
                      <form onSubmit={sourceForm.handleSubmit(handleAddSource)} className="space-y-4">
                        <FormField
                          control={sourceForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Source Name</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder={`${cityName} Events`}
                                  data-testid="input-source-name"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={sourceForm.control}
                          name="type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Source Type</FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-source-type">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="ical">iCal Feed URL</SelectItem>
                                  <SelectItem value="google_calendar_public">Google Public Calendar</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={sourceForm.control}
                          name="url"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {sourceForm.watch("type") === "ical" ? "iCal URL" : "Calendar ID"}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder={
                                    sourceForm.watch("type") === "ical"
                                      ? "https://example.com/calendar.ics"
                                      : "calendar-id@group.calendar.google.com"
                                  }
                                  data-testid="input-source-url"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button
                          type="submit"
                          disabled={createSourceMutation.isPending}
                          className="w-full"
                          data-testid="btn-create-source"
                        >
                          {createSourceMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Plus className="w-4 h-4 mr-2" />
                          )}
                          Add Source
                        </Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Add Templates</CardTitle>
                <CardDescription>
                  Popular calendar sources for {cityName} area
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {templates.map((template, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <h4 className="font-medium">{template.name}</h4>
                        <Badge variant="outline" className="text-xs">
                          {template.type}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddTemplate(template)}
                        disabled={sources.some(s => s.name === template.name)}
                        data-testid={`btn-add-template-${idx}`}
                      >
                        {sources.some(s => s.name === template.name) ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                  {templates.length === 0 && (
                    <div className="text-center py-4 text-muted-foreground">
                      <p className="text-sm">No templates available</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
      </main>
    </div>
  );
}
