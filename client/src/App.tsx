import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { DemoProvider } from "@/contexts/DemoContext";
import { BusinessTypeProvider } from "@/lib/businessContext";
import MenuItemsPage from "@/pages/menu-items";
import { useTemplateDataImport } from "@/hooks/useTemplateDataImport";
import AiAssistantPage from "@/pages/ai-assistant";
import Dashboard from "@/pages/dashboard";
import SocialMediaPage from "@/pages/social-media";
import SettingsPage from "@/pages/settings";
import BillingPage from "@/pages/billing";
import AdminSettingsPage from "@/pages/admin-settings";
import LoginPage from "@/pages/login";
import IntegrationPage from "@/pages/integration";
import VoiceLibrary from "@/pages/VoiceLibrary";
import ProfilePage from "@/pages/profile";
import MobileUploadPage from "@/pages/mobile-upload";
import EventsCalendarPage from "@/pages/events-calendar";
import UnifiedCalendarPage from "@/pages/unified-calendar";
import TemplateStudioPage from "@/pages/template-studio";
import HelpGuidesPage from "@/pages/help-guides";
import BoardsHomePage from "@/pages/boards-home";
import BoardsDiscoverPage from "@/pages/boards-discover";
import BoardDetailPage from "@/pages/board-detail";
import AdminAlertsPage from "@/pages/admin-alerts";
import ProtectedRoute from "@/components/ProtectedRoute";
import NotFound from "@/pages/not-found";
import { DemoModeBanner } from "@/components/shared/demo-mode-banner";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";

function TemplateDataImporter() {
  useTemplateDataImport();
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/integration" component={IntegrationPage} />
      <Route path="/mobile-upload/:sessionId" component={MobileUploadPage} />
      <Route path="/">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/social-media">
        <ProtectedRoute>
          <SocialMediaPage />
        </ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute>
          <SettingsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/billing">
        <ProtectedRoute>
          <BillingPage />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/settings">
        <ProtectedRoute>
          <AdminSettingsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/custom-voices">
        <ProtectedRoute>
          <VoiceLibrary />
        </ProtectedRoute>
      </Route>
      <Route path="/profile">
        <ProtectedRoute>
          <ProfilePage />
        </ProtectedRoute>
      </Route>
      <Route path="/events">
        <ProtectedRoute>
          <EventsCalendarPage />
        </ProtectedRoute>
      </Route>
      <Route path="/calendar">
        <ProtectedRoute>
          <UnifiedCalendarPage />
        </ProtectedRoute>
      </Route>
      <Route path="/templates">
        <ProtectedRoute>
          <TemplateStudioPage />
        </ProtectedRoute>
      </Route>
      <Route path="/ai-assistant">
        <ProtectedRoute>
          <AiAssistantPage />
        </ProtectedRoute>
      </Route>
      <Route path="/menu-items">
        <ProtectedRoute>
          <MenuItemsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/boards">
        <ProtectedRoute>
          <BoardsHomePage />
        </ProtectedRoute>
      </Route>
      <Route path="/boards/discover">
        <ProtectedRoute>
          <BoardsDiscoverPage />
        </ProtectedRoute>
      </Route>
      <Route path="/boards/:id">
        <ProtectedRoute>
          <BoardDetailPage />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/alerts">
        <ProtectedRoute>
          <AdminAlertsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/help" component={HelpGuidesPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TemplateDataImporter />
        <BusinessTypeProvider>
          <DemoProvider>
            <TooltipProvider>
              <ConfirmDialogProvider>
                <DemoModeBanner />
                <Toaster />
                <Router />
              </ConfirmDialogProvider>
            </TooltipProvider>
          </DemoProvider>
        </BusinessTypeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
