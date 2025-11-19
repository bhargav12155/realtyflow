import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Building2, Loader2 } from "lucide-react";
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
});

type CompanyProfileFormData = z.infer<typeof companyProfileFormSchema>;

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
      });
    }
  }, [profile, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: CompanyProfileFormData) => {
      return await apiRequest("/api/company/profile", {
        method: "POST",
        body: JSON.stringify(data),
      });
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
                          placeholder="e.g., 123 Main Street, Suite 100, City, State 12345"
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
  );
}
