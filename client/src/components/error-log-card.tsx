import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { trackAction } from "@/lib/error-logger";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronRight, CheckCircle2, Loader2 } from "lucide-react";
import type { ErrorLog } from "@shared/schema";

const sourceColors: Record<string, string> = {
  api_error: "bg-red-100 text-red-700",
  unhandled_error: "bg-orange-100 text-orange-700",
  unhandled_promise: "bg-amber-100 text-amber-700",
  react_error: "bg-purple-100 text-purple-700",
  unknown: "bg-gray-100 text-gray-700",
};

function formatTimestamp(ts: string | Date | null) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  });
}

interface ErrorLogCardProps {
  log: ErrorLog;
}

export function ErrorLogCard({ log }: ErrorLogCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [resolveNote, setResolveNote] = useState("");
  const { toast } = useToast();

  const resolveMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/error-logs/${log.id}/resolve`, { note: resolveNote }),
    onSuccess: () => {
      trackAction("Resolve error", { errorId: log.id });
      queryClient.invalidateQueries({ queryKey: ["/api/error-logs"] });
      toast({ title: "Error marked as resolved" });
    },
  });

  const breadcrumbs = Array.isArray(log.userActions) ? log.userActions as Array<{ action: string; details?: Record<string, unknown>; timestamp: string }> : [];

  return (
    <div
      className={`border rounded-lg ${log.resolved ? "border-green-200 bg-green-50/30" : "border-border"}`}
      data-testid={`card-error-${log.id}`}
    >
      <div className="py-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-muted-foreground hover:text-foreground flex-shrink-0"
                data-testid={`button-expand-${log.id}`}
              >
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              <p className="font-medium text-sm truncate" data-testid={`text-error-message-${log.id}`}>
                {log.errorMessage}
              </p>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${sourceColors[log.errorSource || "unknown"] || sourceColors.unknown}`}>
                {log.errorSource || "unknown"}
              </span>
              {log.resolved && (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-green-100 text-green-700 flex-shrink-0">
                  resolved
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 mt-1 ml-6 text-[11px] text-muted-foreground">
              {log.pageUrl && <span>{log.pageUrl}</span>}
              {log.apiEndpoint && <><span>·</span><span>{log.apiMethod} {log.apiEndpoint}</span></>}
              {log.createdAt && <><span>·</span><span>{formatTimestamp(log.createdAt)}</span></>}
            </div>
          </div>
          {!log.resolved && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs flex-shrink-0"
              onClick={() => setExpanded(true)}
              data-testid={`button-resolve-toggle-${log.id}`}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Resolve
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t px-4 py-3 space-y-3 text-xs">
          {log.stackTrace && (
            <div>
              <p className="font-medium text-muted-foreground mb-1">Stack Trace</p>
              <pre className="bg-muted/50 rounded p-2 overflow-x-auto text-[11px] whitespace-pre-wrap" data-testid={`text-stack-${log.id}`}>
                {log.stackTrace}
              </pre>
            </div>
          )}

          {log.apiPayload && (
            <div>
              <p className="font-medium text-muted-foreground mb-1">API Payload</p>
              <pre className="bg-muted/50 rounded p-2 overflow-x-auto text-[11px] whitespace-pre-wrap" data-testid={`text-payload-${log.id}`}>
                {log.apiPayload}
              </pre>
            </div>
          )}

          {breadcrumbs.length > 0 && (
            <div>
              <p className="font-medium text-muted-foreground mb-1">User Actions ({breadcrumbs.length} breadcrumbs)</p>
              <div className="bg-muted/50 rounded p-2 space-y-1 max-h-40 overflow-y-auto" data-testid={`list-breadcrumbs-${log.id}`}>
                {breadcrumbs.map((b, i) => (
                  <div key={i} className="flex items-baseline gap-2 text-[11px]">
                    <span className="text-muted-foreground flex-shrink-0">
                      {new Date(b.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                    <span className="font-medium">{b.action}</span>
                    {b.details && (
                      <span className="text-muted-foreground truncate">
                        {JSON.stringify(b.details)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {log.resolvedNote && (
            <div>
              <p className="font-medium text-muted-foreground mb-1">Resolution Note</p>
              <p className="text-[11px]">{log.resolvedNote}</p>
            </div>
          )}

          {!log.resolved && (
            <div className="flex items-center gap-2 pt-1">
              <Input
                placeholder="Resolution note (optional)"
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                className="h-7 text-xs flex-1"
                data-testid={`input-resolve-note-${log.id}`}
              />
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => resolveMutation.mutate()}
                disabled={resolveMutation.isPending}
                data-testid={`button-resolve-submit-${log.id}`}
              >
                {resolveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Mark Resolved"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
