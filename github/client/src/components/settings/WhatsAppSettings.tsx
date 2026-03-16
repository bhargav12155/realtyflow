import { useEffect, useState } from "react";
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
  MessageCircle,
  Clock,
  UserPlus,
  Building2,
  Bot,
  Loader2,
  CheckCircle,
  XCircle,
  Key,
  Phone,
  Pencil,
} from "lucide-react";

const whatsappSettingsSchema = z.object({
  isEnabled: z.boolean().default(false),
  phoneNumberId: z.string().optional(),
  wabaId: z.string().optional(),
  displayPhoneNumber: z.string().optional(),
  accessToken: z.string().optional(),
  aiPersonality: z.enum(["friendly", "professional", "casual"]).default("professional"),
  aiGreeting: z.string().default("Hello! Thanks for reaching out via WhatsApp. How can I help you today?"),
  businessHoursStart: z.string().default("09:00"),
  businessHoursEnd: z.string().default("17:00"),
  afterHoursMessage: z.string().default("Thanks for your message! We're currently outside of business hours but will get back to you as soon as possible."),
  agentName: z.string().optional(),
  brokerageName: z.string().optional(),
  askForName: z.boolean().default(true),
  askForEmail: z.boolean().default(true),
});

type WhatsAppSettingsFormData = z.infer<typeof whatsappSettingsSchema>;

interface WhatsAppSettingsData extends WhatsAppSettingsFormData {
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

function WhatsAppAccountManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newPhoneNumberId, setNewPhoneNumberId] = useState("");
  const [newWabaId, setNewWabaId] = useState("");
  const [newDisplayPhone, setNewDisplayPhone] = useState("");

  const { data: accountsData, isLoading } = useQuery<{ accounts: Array<{ label: string; phoneNumberId: string; wabaId: string; displayPhoneNumber?: string }>; activePhoneNumberId: string }>({
    queryKey: ["/api/whatsapp/accounts"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: { label: string; phoneNumberId: string; wabaId: string; displayPhoneNumber: string }) => {
      const res = await apiRequest("POST", "/api/whatsapp/accounts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/accounts"] });
      setShowAdd(false);
      setNewLabel(""); setNewPhoneNumberId(""); setNewWabaId(""); setNewDisplayPhone("");
      toast({ title: "Account added" });
    },
    onError: () => toast({ title: "Failed to add account", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (phoneNumberId: string) => {
      const res = await apiRequest("DELETE", `/api/whatsapp/accounts/${phoneNumberId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/accounts"] });
      toast({ title: "Account removed" });
    },
    onError: () => toast({ title: "Failed to remove account", variant: "destructive" }),
  });

  const switchMutation = useMutation({
    mutationFn: async (phoneNumberId: string) => {
      const res = await apiRequest("POST", "/api/whatsapp/accounts/switch", { phoneNumberId });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/messaging-limit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/analytics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/bulk-queues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations"] });
      toast({ title: "Switched account", description: `Now using "${data.label}"` });
    },
    onError: () => toast({ title: "Failed to switch", variant: "destructive" }),
  });

  const accounts = accountsData?.accounts || [];
  const activeId = accountsData?.activePhoneNumberId || "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          WhatsApp Accounts
        </CardTitle>
        <CardDescription>
          Manage multiple WhatsApp phone numbers and switch between them
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No accounts configured. Add your first account below or save settings above to create one automatically.</p>
        ) : (
          <div className="space-y-2">
            {accounts.map(acct => (
              <div key={acct.phoneNumberId} className={`flex items-center justify-between p-3 rounded-lg border ${acct.phoneNumberId === activeId ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/30' : 'border-border'}`} data-testid={`account-row-${acct.phoneNumberId}`}>
                <div className="flex items-center gap-3">
                  {acct.phoneNumberId === activeId && <CheckCircle className="h-4 w-4 text-green-500" />}
                  <div>
                    <div className="text-sm font-medium">{acct.label}</div>
                    <div className="text-xs text-muted-foreground">
                      ID: {acct.phoneNumberId}
                      {acct.displayPhoneNumber && ` · ${acct.displayPhoneNumber}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {acct.phoneNumberId !== activeId && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => switchMutation.mutate(acct.phoneNumberId)}
                        disabled={switchMutation.isPending}
                        data-testid={`btn-switch-${acct.phoneNumberId}`}
                      >
                        {switchMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Switch"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => { if (confirm(`Remove "${acct.label}"?`)) deleteMutation.mutate(acct.phoneNumberId); }}
                        disabled={deleteMutation.isPending}
                        data-testid={`btn-delete-${acct.phoneNumberId}`}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  {acct.phoneNumberId === activeId && (
                    <Badge className="bg-green-500 text-xs">Active</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {showAdd ? (
          <div className="space-y-3 p-3 rounded-lg border border-dashed">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Label</Label>
                <Input placeholder="e.g., Main Business" value={newLabel} onChange={e => setNewLabel(e.target.value)} data-testid="input-new-account-label" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Phone Number ID</Label>
                <Input placeholder="e.g., 123456789012345" value={newPhoneNumberId} onChange={e => setNewPhoneNumberId(e.target.value)} data-testid="input-new-account-phoneId" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">WABA ID (optional)</Label>
                <Input placeholder="e.g., 987654321098765" value={newWabaId} onChange={e => setNewWabaId(e.target.value)} data-testid="input-new-account-wabaId" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Display Phone (optional)</Label>
                <Input placeholder="+1 (555) 123-4567" value={newDisplayPhone} onChange={e => setNewDisplayPhone(e.target.value)} data-testid="input-new-account-displayPhone" className="mt-1" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => addMutation.mutate({ label: newLabel, phoneNumberId: newPhoneNumberId, wabaId: newWabaId, displayPhoneNumber: newDisplayPhone })} disabled={!newLabel || !newPhoneNumberId || addMutation.isPending} data-testid="btn-save-new-account">
                {addMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Save Account
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)} data-testid="btn-cancel-new-account">Cancel</Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setShowAdd(true)} data-testid="btn-add-account">
            <Phone className="h-3 w-3 mr-1" />
            Add Account
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function WhatsAppSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [changingToken, setChangingToken] = useState(false);

  const form = useForm<WhatsAppSettingsFormData>({
    resolver: zodResolver(whatsappSettingsSchema),
    defaultValues: {
      isEnabled: false,
      phoneNumberId: "",
      wabaId: "",
      displayPhoneNumber: "",
      accessToken: "",
      aiPersonality: "professional",
      aiGreeting: "Hello! Thanks for reaching out via WhatsApp. How can I help you today?",
      businessHoursStart: "09:00",
      businessHoursEnd: "17:00",
      afterHoursMessage: "Thanks for your message! We're currently outside of business hours but will get back to you as soon as possible.",
      agentName: "",
      brokerageName: "",
      askForName: true,
      askForEmail: true,
    },
  });

  const { data: settings, isLoading: isLoadingSettings } = useQuery<WhatsAppSettingsData | null>({
    queryKey: ["/api/whatsapp/settings"],
  });

  const { data: conversations, isLoading: isLoadingConversations } = useQuery<Conversation[]>({
    queryKey: ["/api/whatsapp/conversations"],
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        isEnabled: settings.isEnabled ?? false,
        phoneNumberId: settings.phoneNumberId ?? "",
        wabaId: settings.wabaId ?? "",
        displayPhoneNumber: settings.displayPhoneNumber ?? "",
        accessToken: "",
        aiPersonality: settings.aiPersonality ?? "professional",
        aiGreeting: settings.aiGreeting ?? "Hello! Thanks for reaching out via WhatsApp. How can I help you today?",
        businessHoursStart: settings.businessHoursStart ?? "09:00",
        businessHoursEnd: settings.businessHoursEnd ?? "17:00",
        afterHoursMessage: settings.afterHoursMessage ?? "Thanks for your message! We're currently outside of business hours but will get back to you as soon as possible.",
        agentName: settings.agentName ?? "",
        brokerageName: settings.brokerageName ?? "",
        askForName: settings.askForName ?? true,
        askForEmail: settings.askForEmail ?? true,
      });
      setChangingToken(false);
    }
  }, [settings, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return await apiRequest("POST", "/api/whatsapp/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/settings"] });
      toast({
        title: "Success",
        description: "WhatsApp Business settings saved successfully",
      });
    },
    onError: (error) => {
      console.error("Error saving WhatsApp settings:", error);
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: WhatsAppSettingsFormData) => {
    saveMutation.mutate(data);
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

  const enabled = form.watch("isEnabled");
  const phoneNumberId = form.watch("phoneNumberId");

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                WhatsApp API Configuration
              </CardTitle>
              <CardDescription>
                Enter your Meta Developer Dashboard credentials for WhatsApp Business API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phoneNumberId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number ID</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-wa-phoneNumberId"
                          {...field}
                          placeholder="e.g., 123456789012345"
                        />
                      </FormControl>
                      <FormDescription>
                        From Meta Developer Dashboard
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="wabaId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>WhatsApp Business Account ID</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-wa-businessAccountId"
                          {...field}
                          placeholder="e.g., 987654321098765"
                        />
                      </FormControl>
                      <FormDescription>
                        Your WABA ID from Meta
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="displayPhoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Phone Number</FormLabel>
                    <FormControl>
                      <Input
                        data-testid="input-wa-displayPhoneNumber"
                        {...field}
                        placeholder="+1 (555) 123-4567"
                        type="tel"
                      />
                    </FormControl>
                    <FormDescription>
                      The phone number displayed to recipients
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="accessToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Access Token</FormLabel>
                    {settings?.accessToken && !changingToken ? (
                      <div className="flex items-center gap-3 rounded-md border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 px-3 py-2">
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                        <span className="text-sm text-green-700 dark:text-green-300 flex-1">Token saved and active</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setChangingToken(true)}
                          data-testid="button-change-token"
                          className="text-xs h-7"
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          Change
                        </Button>
                      </div>
                    ) : (
                      <FormControl>
                        <Input
                          data-testid="input-wa-accessToken"
                          {...field}
                          placeholder="Paste your permanent token from Meta"
                          type="password"
                          autoComplete="off"
                        />
                      </FormControl>
                    )}
                    <FormDescription>
                      Permanent access token from Meta Developer Dashboard
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              <FormField
                control={form.control}
                name="isEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable WhatsApp Business</FormLabel>
                      <FormDescription>
                        Activate WhatsApp Business AI chatbot for incoming messages
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        data-testid="switch-wa-enabled"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={!phoneNumberId}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex items-center gap-2">
                <span className="text-sm">Status:</span>
                {enabled && phoneNumberId ? (
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

          <WhatsAppAccountManager />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                AI Chatbot Settings
              </CardTitle>
              <CardDescription>
                Configure how the AI responds to WhatsApp messages
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
                        <SelectTrigger data-testid="select-wa-aiPersonality">
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
                    <FormLabel>Greeting Message</FormLabel>
                    <FormControl>
                      <Textarea
                        data-testid="input-wa-aiGreeting"
                        {...field}
                        placeholder="Enter greeting for WhatsApp messages..."
                        rows={3}
                      />
                    </FormControl>
                    <FormDescription>
                      Default greeting for incoming WhatsApp messages
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
                          data-testid="input-wa-businessHoursStart"
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
                          data-testid="input-wa-businessHoursEnd"
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
                        data-testid="input-wa-afterHoursMessage"
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
                Configure how the AI collects lead information via WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                        data-testid="switch-wa-askForName"
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
                        data-testid="switch-wa-askForEmail"
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
                          data-testid="input-wa-agentName"
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
                          data-testid="input-wa-brokerageName"
                          {...field}
                          placeholder="Your brokerage"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            disabled={saveMutation.isPending}
            className="w-full"
            data-testid="button-saveWhatsAppSettings"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <MessageCircle className="h-4 w-4 mr-2" />
                Save WhatsApp Settings
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
            Preview of recent WhatsApp conversations with leads
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
                    data-testid={`wa-conversation-${conversation.id}`}
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
              <p className="text-sm">Conversations will appear here once leads start messaging via WhatsApp</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
