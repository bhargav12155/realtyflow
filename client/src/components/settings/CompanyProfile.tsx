import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { Building2, Loader2, Phone, Bot, Clock, MessageCircle, CheckCircle, XCircle, MessageSquare } from "lucide-react";
import { WhatsAppSettings } from "./WhatsAppSettings";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const companyProfileFormSchema = z.object({
  businessName: z.string().min(1, "Business name is required"),
  agentName: z.string().min(1, "Agent name is required"),
  agentTitle: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  officeAddress: z.string().optional(),
  licenseNumber: z.string().optional(),
  brokerageName: z.string().optional(),
  tagline: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

type CompanyProfileFormData = z.infer<typeof companyProfileFormSchema>;

const twilioSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  phoneNumber: z.string().optional(),
  aiPersonality: z.enum(["friendly", "professional", "casual"]).default("professional"),
  aiGreeting: z.string().default("Hello! Thanks for reaching out. How can I help you today?"),
  voiceEnabled: z.boolean().default(false),
  businessHoursStart: z.string().default("09:00"),
  businessHoursEnd: z.string().default("17:00"),
  afterHoursMessage: z.string().default("Thanks for your message! We're currently outside of business hours."),
  serviceAreas: z.string().optional(),
  specialties: z.string().optional(),
});

type TwilioSettingsFormData = z.infer<typeof twilioSettingsSchema>;

interface CompanyProfileData extends CompanyProfileFormData {
  id?: string;
  userId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export function CompanyProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CompanyProfileFormData>({
    resolver: zodResolver(companyProfileFormSchema),
    defaultValues: {
      businessName: "",
      agentName: "",
      agentTitle: "",
      phone: "",
      email: "",
      officeAddress: "",
      licenseNumber: "",
      brokerageName: "",
      tagline: "",
      city: "",
      state: "",
    },
  });

  const { data: profile, isLoading } = useQuery<CompanyProfileData | null>({
    queryKey: ["/api/company/profile"],
    enabled: !!user,
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        businessName: profile.businessName || "",
        agentName: profile.agentName || "",
        agentTitle: profile.agentTitle || "",
        phone: profile.phone || "",
        email: profile.email || "",
        officeAddress: profile.officeAddress || "",
        licenseNumber: profile.licenseNumber || "",
        brokerageName: profile.brokerageName || "",
        tagline: profile.tagline || "",
        city: (profile as any).city || "",
        state: (profile as any).state || "",
      });
    }
  }, [profile, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: CompanyProfileFormData) => {
      return await apiRequest("POST", "/api/company/profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/profile"] });
      toast({
        title: "Success",
        description: "Company profile saved successfully",
      });
    },
    onError: (error) => {
      console.error("Error saving company profile:", error);
      toast({
        title: "Error",
        description: "Failed to save company profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CompanyProfileFormData) => {
    saveMutation.mutate(data);
  };

  const twilioForm = useForm<TwilioSettingsFormData>({
    resolver: zodResolver(twilioSettingsSchema),
    defaultValues: {
      enabled: false,
      phoneNumber: "",
      aiPersonality: "professional",
      aiGreeting: "Hello! Thanks for reaching out. How can I help you today?",
      voiceEnabled: false,
      businessHoursStart: "09:00",
      businessHoursEnd: "17:00",
      afterHoursMessage: "Thanks for your message! We're currently outside of business hours.",
      serviceAreas: "",
      specialties: "",
    },
  });

  const { data: twilioSettings, isLoading: isTwilioLoading } = useQuery<Record<string, unknown> | null>({
    queryKey: ["/api/twilio/settings"],
  });

  useEffect(() => {
    if (twilioSettings) {
      const settings = twilioSettings as Record<string, unknown>;
      twilioForm.reset({
        enabled: (settings.enabled as boolean) ?? false,
        phoneNumber: (settings.phoneNumber as string) ?? "",
        aiPersonality: (settings.aiPersonality as "friendly" | "professional" | "casual") ?? "professional",
        aiGreeting: (settings.aiGreeting as string) ?? "Hello! Thanks for reaching out. How can I help you today?",
        voiceEnabled: (settings.voiceEnabled as boolean) ?? false,
        businessHoursStart: (settings.businessHoursStart as string) ?? "09:00",
        businessHoursEnd: (settings.businessHoursEnd as string) ?? "17:00",
        afterHoursMessage: (settings.afterHoursMessage as string) ?? "Thanks for your message! We're currently outside of business hours.",
        serviceAreas: Array.isArray(settings.serviceAreas) ? (settings.serviceAreas as string[]).join(', ') : '',
        specialties: Array.isArray(settings.specialties) ? (settings.specialties as string[]).join(', ') : '',
      });
    }
  }, [twilioSettings, twilioForm]);

  const saveTwilioMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return await apiRequest("POST", "/api/twilio/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/twilio/settings"] });
      toast({
        title: "Success",
        description: "AI Chatbot settings saved successfully",
      });
    },
    onError: (error) => {
      console.error("Error saving Twilio settings:", error);
      toast({
        title: "Error",
        description: "Failed to save AI Chatbot settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onTwilioSubmit = (data: TwilioSettingsFormData) => {
    const submitData: Record<string, unknown> = {
      ...data,
      serviceAreas: data.serviceAreas
        ? data.serviceAreas.split(',').map(s => s.trim()).filter(Boolean)
        : [],
      specialties: data.specialties
        ? data.specialties.split(',').map(s => s.trim()).filter(Boolean)
        : [],
    };
    saveTwilioMutation.mutate(submitData);
  };

  if (isLoading) {
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

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Company Profile
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Customize your company information to personalize AI-generated content and social media posts.
            This information will be used in property templates, AI-generated content, and marketing materials throughout the platform.
          </p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="businessName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Name *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          data-testid="input-businessName"
                          placeholder="e.g., Your Brokerage Name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="agentName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agent Name *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          data-testid="input-agentName"
                          placeholder="e.g., Your Full Name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="agentTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agent Title</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          data-testid="input-agentTitle"
                          placeholder="e.g., Senior Real Estate Specialist"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          data-testid="input-phone"
                          placeholder="e.g., (555) 123-4567"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          data-testid="input-email"
                          type="email"
                          placeholder="e.g., contact@yourcompany.com"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="licenseNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>License Number</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          data-testid="input-licenseNumber"
                          placeholder="e.g., RE-12345678"
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
                    <FormItem className="md:col-span-2">
                      <FormLabel>Brokerage Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          data-testid="input-brokerageName"
                          placeholder="e.g., Your Brokerage Name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="officeAddress"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Office Address</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          data-testid="input-officeAddress"
                          placeholder="e.g., 123 Main Street, Suite 100"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          data-testid="input-city"
                          placeholder="e.g., Omaha"
                        />
                      </FormControl>
                      <FormDescription>
                        Used for location hashtags in AI-generated posts
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          data-testid="input-state"
                          placeholder="e.g., NE"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tagline"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Company Tagline</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          data-testid="input-tagline"
                          placeholder="e.g., Your Trusted Partner in Real Estate Excellence"
                          rows={2}
                        />
                      </FormControl>
                      <FormDescription>
                        This tagline will be used in AI-generated content titles and descriptions.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button
                type="submit"
                disabled={saveMutation.isPending}
                className="w-full"
                data-testid="button-saveProfile"
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Building2 className="h-4 w-4 mr-2" />
                    Save Company Profile
                  </>
                )}
              </Button>
            </form>
          </Form>
        </div>
      </CardContent>
    </Card>

    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          AI Chatbot Settings
        </CardTitle>
        <CardDescription>
          Configure your AI-powered SMS and voice chatbot for lead engagement
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="chatbot-settings">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                <span>AI Chatbot Configuration</span>
                {twilioForm.watch("phoneNumber") ? (
                  <Badge variant="outline" className="ml-2 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    Phone Configured
                  </Badge>
                ) : (
                  <Badge variant="outline" className="ml-2 flex items-center gap-1">
                    <XCircle className="h-3 w-3 text-red-500" />
                    No Phone
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {isTwilioLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <Form {...twilioForm}>
                  <form onSubmit={twilioForm.handleSubmit(onTwilioSubmit)} className="space-y-4 pt-4">
                    <FormField
                      control={twilioForm.control}
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
                              data-testid="switch-twilio-enabled"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <Separator />

                    <FormField
                      control={twilioForm.control}
                      name="aiPersonality"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>AI Personality</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-twilio-aiPersonality">
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
                      control={twilioForm.control}
                      name="aiGreeting"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>AI Greeting Message</FormLabel>
                          <FormControl>
                            <Textarea
                              data-testid="input-twilio-aiGreeting"
                              {...field}
                              placeholder="Enter greeting message..."
                              rows={3}
                            />
                          </FormControl>
                          <FormDescription>
                            Default greeting for incoming messages
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={twilioForm.control}
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
                              data-testid="switch-twilio-voiceEnabled"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <Separator />

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Business Hours
                      </Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={twilioForm.control}
                          name="businessHoursStart"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Start Time</FormLabel>
                              <FormControl>
                                <Input
                                  data-testid="input-twilio-businessHoursStart"
                                  type="time"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={twilioForm.control}
                          name="businessHoursEnd"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>End Time</FormLabel>
                              <FormControl>
                                <Input
                                  data-testid="input-twilio-businessHoursEnd"
                                  type="time"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <FormField
                      control={twilioForm.control}
                      name="afterHoursMessage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>After Hours Message</FormLabel>
                          <FormControl>
                            <Textarea
                              data-testid="input-twilio-afterHoursMessage"
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

                    <Separator />

                    <FormField
                      control={twilioForm.control}
                      name="serviceAreas"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Service Areas</FormLabel>
                          <FormControl>
                            <Input
                              data-testid="input-twilio-serviceAreas"
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
                      control={twilioForm.control}
                      name="specialties"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Specialties</FormLabel>
                          <FormControl>
                            <Input
                              data-testid="input-twilio-specialties"
                              {...field}
                              placeholder="e.g., First-time buyers, Luxury homes (comma-separated)"
                            />
                          </FormControl>
                          <FormDescription>
                            Enter your specialties, separated by commas
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      disabled={saveTwilioMutation.isPending}
                      className="w-full"
                      data-testid="button-saveTwilioSettings"
                    >
                      {saveTwilioMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Bot className="h-4 w-4 mr-2" />
                          Save AI Chatbot Settings
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>

    <WhatsAppSettings />
    </>
  );
}
