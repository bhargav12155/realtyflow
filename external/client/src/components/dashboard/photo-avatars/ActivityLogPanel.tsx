import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Terminal } from "lucide-react";
import { usePhotoAvatars } from "./context";

export function ActivityLogPanel() {
  const m = usePhotoAvatars();
  const {
    showActivityPanel,
    activityLogs, setActivityLogs,
    activityLogRef,
    getStepStyle,
  } = m;

  if (!showActivityPanel) return null;

  return (
    <Card className="w-80 flex-shrink-0 h-fit max-h-[600px] sticky top-4" data-testid="activity-log-panel">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            Activity Log
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActivityLogs([])}
            className="h-6 px-2 text-xs"
            data-testid="button-clear-activity-log"
          >
            Clear
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div
          ref={activityLogRef}
          className="space-y-2 overflow-y-auto max-h-[480px] pr-1"
        >
          {activityLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No activity yet</p>
              <p className="text-xs mt-1">Upload a photo to get started</p>
            </div>
          ) : (
            activityLogs.map((log) => {
              const style = getStepStyle(log.step);
              const IconComponent = style.icon;
              return (
                <div
                  key={log.id}
                  className={`p-2 rounded-lg ${style.bg} border border-gray-100`}
                  data-testid={`activity-log-${log.id}`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`mt-0.5 ${style.color}`}>
                      <IconComponent className={`w-4 h-4 ${log.step === 'training_progress' ? 'animate-spin' : ''}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm text-gray-800 truncate">
                          {log.message}
                        </p>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">
                          {log.timestamp}
                        </span>
                      </div>
                      {log.groupName && (
                        <p className="text-xs text-gray-600 truncate">
                          {log.groupName}
                        </p>
                      )}
                      {log.details && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {log.details}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
