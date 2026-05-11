import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bug, ChevronDown, ChevronUp, Terminal, X } from "lucide-react";
import { usePhotoAvatars } from "./context";

export function DebugPanel() {
  const m = usePhotoAvatars();
  const {
    debugEnabled, debugLogs, setDebugLogs,
    showDebugPanel, setShowDebugPanel,
  } = m;

  if (!debugEnabled) return null;

  return (
    <div className="mt-4 border-t pt-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowDebugPanel(!showDebugPanel)}
        className="flex items-center gap-2 text-xs"
        data-testid="button-toggle-debug"
      >
        <Bug className="w-4 h-4" />
        {showDebugPanel ? "Hide" : "Show"} Debug Panel
        {showDebugPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        {debugLogs.length > 0 && (
          <Badge variant="secondary" className="ml-2">{debugLogs.length}</Badge>
        )}
      </Button>

      {showDebugPanel && (
        <div className="mt-3 bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-xs overflow-auto max-h-[400px]">
          <div className="flex justify-between items-center mb-3">
            <span className="text-green-400 flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              API Debug Console
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDebugLogs([])}
              className="text-gray-400 hover:text-white h-6 px-2"
            >
              <X className="w-3 h-3 mr-1" />
              Clear
            </Button>
          </div>

          {debugLogs.length === 0 ? (
            <div className="text-gray-500 py-4 text-center">
              No API calls logged yet. Click "Generate 4 Looks" to see the debug output.
            </div>
          ) : (
            <div className="space-y-2">
              {debugLogs.map((log, index) => (
                <div
                  key={index}
                  className={`p-2 rounded border-l-2 ${
                    log.type === 'error'
                      ? 'border-red-500 bg-red-900/20'
                      : log.type === 'request'
                      ? 'border-blue-500 bg-blue-900/20'
                      : log.type === 'response'
                      ? 'border-green-500 bg-green-900/20'
                      : 'border-yellow-500 bg-yellow-900/20'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-gray-400">[{log.timestamp}]</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        log.type === 'error' ? 'text-red-400 border-red-400' :
                        log.type === 'request' ? 'text-blue-400 border-blue-400' :
                        log.type === 'response' ? 'text-green-400 border-green-400' :
                        'text-yellow-400 border-yellow-400'
                      }`}
                    >
                      {log.type.toUpperCase()}
                    </Badge>
                    {log.endpoint && (
                      <span className="text-cyan-400">{log.endpoint}</span>
                    )}
                  </div>
                  {log.message && (
                    <div className="text-gray-300 mb-1">{log.message}</div>
                  )}
                  {log.payload != null && (
                    <div className="mt-1">
                      <span className="text-gray-500">Payload: </span>
                      <pre className="text-orange-300 whitespace-pre-wrap">
                        {JSON.stringify(log.payload, null, 2)}
                      </pre>
                    </div>
                  )}
                  {log.response != null && (
                    <div className="mt-1">
                      <span className="text-gray-500">Response: </span>
                      <pre className="text-green-300 whitespace-pre-wrap">
                        {JSON.stringify(log.response, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
