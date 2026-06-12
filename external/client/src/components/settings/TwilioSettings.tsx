import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Phone,
  MessageCircle,
  Clock,
  UserPlus,
  Building2,
  PhoneForwarded,
  Bot,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";

const twilioSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  phoneNumber: z.string().optional(),
  aiPersonality: z.enum(["friendly", "professional", "casual"]).default("professional"),
  aiGreeting: z.string().default("Hello! Thanks for reaching out. How can I help you today?"),
  voiceGreeting: z.string().default("Hello, thank you for calling. How may I assist you today?"),
  voiceEnabled: z.boolean().default(false),
  businessHoursStart: z.string().default("09:00"),
  businessHoursEnd: z.string().default("17:00"),
  afterHoursMessage: z.string().default("Thanks for your message! We're currently outside of business hours but will get back to you as soon as possible."),
  captureLeadOnFirstMessage: z.boolean().default(true),
  askForName: z.boolean().default(true),
  askForEmail: z.boolean().default(true),
  agentName: z.string().optional(),
  brokerageName: z.string().optional(),
  serviceAreas: z.string().optional(),
  specialties: z.string().optional(),
  transferPhoneNumber: z.string().optional(),
});

type TwilioSettingsFormData = z.infer<typeof twilioSettingsSchema>;

interface TwilioSettingsData extends TwilioSettingsFormData {
  id?: string;
  userId?: string;
}

interface Conversation {
  id: string;
  phoneNumber: string;
  lastMessage: string;
  lastMessageAt: string;
  leadName?: string;
  leadEmail?: string;
  messageCount: number;
}

export function TwilioSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<TwilioSettingsFormData>({
    resolver: zodResolver(twilioSettingsSchema),
    defaultValues: {
      enabled: false,
      phoneNumber: "",
      aiPersonality: "professional",
      aiGreeting: "Hello! Thanks for reaching out. How can I help you today?",
      voiceGreeting: "Hello, thank you for calling. How may I assist you today?",
      voiceEnabled: false,
      businessHoursStart: "09:00",
      businessHoursEnd: "17:00",
      afterHoursMessage: "Thanks for your message! We're currently outside of business hours but will get back to you as soon as possible.",
      captureLeadOnFirstMessage: true,
      askForName: true,
      askForEmail: true,
      agentName: "",
      brokerageName: "",
      serviceAreas: "",
      specialties: "",
      transferPhoneNumber: "",
    },
  });

  const { data: settings, isLoading: isLoadingSettings } = useQuery<TwilioSettingsData | null>({
    queryKey: ["/api/twilio/settings"],
  });

  const { data: conversations, isLoading: isLoadingConversations } = useQuery<Conversation[]>({
    queryKey: ["/api/twilio/conversations"],
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        enabled: settings.enabled ?? false,
        phoneNumber: settings.phoneNumber ?? "",
        aiPersonality: settings.aiPersonality ?? "professional",
        aiGreeting: settings.aiGreeting ?? "Hello! Thanks for reaching out. How can I help you today?",
        voiceGreeting: settings.voiceGreeting ?? "Hello, thank you for calling. How may I assist you today?",
        voiceEnabled: settings.voiceEnabled ?? false,
        businessHoursStart: settings.businessHoursStart ?? "09:00",
        businessHoursEnd: settings.businessHoursEnd ?? "17:00",
        afterHoursMessage: settings.afterHoursMessage ?? "Thanks for your message! We're currently outside of business hours but will get back to you as soon as possible.",
        captureLeadOnFirstMessage: settings.captureLeadOnFirstMessage ?? true,
        askForName: settings.askForName ?? true,
        askForEmail: settings.askForEmail ?? true,
        agentName: settings.agentName ?? "",
        brokerageName: settings.brokerageName ?? "",
        serviceAreas: Array.isArray(settings.serviceAreas) ? settings.serviceAreas.join(', ') : (settings.serviceAreas ?? ""),
        specialties: Array.isArray(settings.specialties) ? settings.specialties.join(', ') : (settings.specialties ?? ""),
        transferPhoneNumber: settings.transferPhoneNumber ?? "",
      });
    }
  }, [settings, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return await apiRequest("POST", "/api/twilio/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/twilio/settings"] });
      toast({
        title: "Success",
        description: "Twilio AI Chatbot settings saved successfully",
      });
    },
    onError: (error) => {
      console.error("Error saving Twilio settings:", error);
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: TwilioSettingsFormData) => {
    const submitData = {
      ...data,
      serviceAreas: data.serviceAreas 
        ? data.serviceAreas.split(',').map(s => s.trim()).filter(Boolean)
        : [],
      specialties: data.specialties 
        ? data.specialties.split(',').map(s => s.trim()).filter(Boolean)
        : [],
    };
    saveMutation.mutate(submitData);
  };

  if (isLoadingSettings) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const phoneNumber = form.watch("phoneNumber");
  const enabled = form.watch("enabled");

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Phone Number
              </CardTitle>
              <CardDescription>
                Your assigned Twilio phone number for SMS and voice interactions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Configured Phone Number</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      data-testid="input-phoneNumber"
                      value={phoneNumber || "Not configured"}
                      disabled
                      className="max-w-xs"
                    />
                    {phoneNumber ? (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        Assigned
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <XCircle className="h-3 w-3 text-red-500" />
                        Not Assigned
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Contact your administrator to assign a phone number
                  </p>
                </div>
              </div>

              <Separator />

              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable AI Chatbot</FormLabel>
                      <FormDescription>
                        Activate the AI chatbot to respond to incoming messages
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        data-testid="switch-enabled"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={!phoneNumber}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex items-center gap-2">
                <span className="text-sm">Status:</span>
                {enabled && phoneNumber ? (
                  <Badge className="bg-green-500">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <XCircle className="h-3 w-3 mr-1" />
                    Inactive
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                AI Chatbot Settings
              </CardTitle>
              <CardDescription>
                Configure how the AI responds to messages and calls
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="aiPersonality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>AI Personality</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-aiPersonality">
                          <SelectValue placeholder="Select personality" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="friendly">Friendly</SelectItem>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose the tone and style of AI responses
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="aiGreeting"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SMS Greeting Message</FormLabel>
                    <FormControl>
                      <Textarea
                        data-testid="input-aiGreeting"
                        {...field}
                        placeholder="Enter greeting for SMS messages..."
                        rows={3}
                      />
                    </FormControl>
                    <FormDescription>
                      Default greeting for incoming SMS messages
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              <FormField
                control={form.control}
                name="voiceEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable Voice Responses</FormLabel>
                      <FormDescription>
                        Allow AI to handle incoming voice calls
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        data-testid="switch-voiceEnabled"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="voiceGreeting"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Voice Greeting Message</FormLabel>
                    <FormControl>
                      <Textarea
                        data-testid="input-voiceGreeting"
                        {...field}
                        placeholder="Enter greeting for voice calls..."
                        rows={3}
                      />
                    </FormControl>
                    <FormDescription>
                      Greeting message spoken when answering calls
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Business Hours
              </CardTitle>
              <CardDescription>
                Set your availability hours and after-hours message
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="businessHoursStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-businessHoursStart"
                          type="time"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="businessHoursEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-businessHoursEnd"
                          type="time"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="afterHoursMessage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>After Hours Message</FormLabel>
                    <FormControl>
                      <Textarea
                        data-testid="input-afterHoursMessage"
                        {...field}
                        placeholder="Message to send outside business hours..."
                        rows={3}
                      />
                    </FormControl>
                    <FormDescription>
                      Automatic response sent outside of business hours
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Lead Capture Settings
              </CardTitle>
              <CardDescription>
                Configure how the AI collects lead information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="captureLeadOnFirstMessage"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Capture Lead on First Message</FormLabel>
                      <FormDescription>
                        Automatically create a lead when someone first contacts you
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        data-testid="switch-captureLeadOnFirstMessage"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="askForName"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Ask for Name</FormLabel>
                      <FormDescription>
                        AI will politely ask for the lead's name
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        data-testid="switch-askForName"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="askForEmail"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Ask for Email</FormLabel>
                      <FormDescription>
                        AI will politely ask for the lead's email address
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        data-testid="switch-askForEmail"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Business Information
              </CardTitle>
              <CardDescription>
                Provide context for the AI to give relevant responses
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="agentName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agent Name</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-agentName"
                          {...field}
                          placeholder="Your name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="brokerageName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brokerage Name</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-brokerageName"
                          {...field}
                          placeholder="Your brokerage"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="serviceAreas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Areas</FormLabel>
                    <FormControl>
                      <Input
                        data-testid="input-serviceAreas"
                        {...field}
                        placeholder="e.g., Downtown, Midtown, Westside (comma-separated)"
                      />
                    </FormControl>
                    <FormDescription>
                      Enter areas you serve, separated by commas
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="specialties"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Specialties</FormLabel>
                    <FormControl>
                      <Input
                        data-testid="input-specialties"
                        {...field}
                        placeholder="e.g., First-time buyers, Luxury homes, Investment properties (comma-separated)"
                      />
                    </FormControl>
                    <FormDescription>
                      Enter your specialties, separated by commas
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PhoneForwarded className="h-5 w-5" />
                Transfer Settings
              </CardTitle>
              <CardDescription>
                Configure phone number for live agent transfer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="transferPhoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transfer Phone Number</FormLabel>
                    <FormControl>
                      <Input
                        data-testid="input-transferPhoneNumber"
                        {...field}
                        placeholder="+1 (555) 123-4567"
                        type="tel"
                      />
                    </FormControl>
                    <FormDescription>
                      When a lead requests to speak to a human, calls will be transferred to this number
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Button
            type="submit"
            disabled={saveMutation.isPending}
            className="w-full"
            data-testid="button-saveTwilioSettings"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <MessageCircle className="h-4 w-4 mr-2" />
                Save Chatbot Settings
              </>
            )}
          </Button>
        </form>
      </Form>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Recent Conversations
          </CardTitle>
          <CardDescription>
            Preview of recent conversations with leads
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingConversations ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : conversations && conversations.length > 0 ? (
            <ScrollArea className="h-64">
              <div className="space-y-3">
                {conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    data-testid={`conversation-${conversation.id}`}
                    className="rounded-lg border p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{conversation.phoneNumber}</span>
                      </div>
                      <Badge variant="outline">{conversation.messageCount} messages</Badge>
                    </div>
                    {(conversation.leadName || conversation.leadEmail) && (
                      <div className="text-sm text-muted-foreground">
                        {conversation.leadName && <span>{conversation.leadName}</span>}
                        {conversation.leadName && conversation.leadEmail && <span> • </span>}
                        {conversation.leadEmail && <span>{conversation.leadEmail}</span>}
                      </div>
                    )}
                    <p className="text-sm truncate">{conversation.lastMessage}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(conversation.lastMessageAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No conversations yet</p>
              <p className="text-sm">Conversations will appear here once leads start messaging</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
