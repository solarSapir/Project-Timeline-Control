import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { trackAction } from "@/lib/error-logger";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Trash2 } from "lucide-react";
import type { ErrorLog } from "@shared/schema";
import { ErrorLogCard } from "@/components/error-log-card";

type FilterMode = "unresolved" | "resolved" | "all";

export default function ErrorLogView() {
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("unresolved");
  const { toast } = useToast();

  const queryParams = new URLSearchParams();
  if (filterMode !== "all") queryParams.set("resolved", filterMode === "resolved" ? "true" : "false");
  if (search) queryParams.set("search", search);

  const { data: logs = [], isLoading } = useQuery<ErrorLog[]>({
    queryKey: ["/api/error-logs", `?${queryParams.toString()}`],
  });

  const clearMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/error-logs/resolved"),
    onSuccess: async () => {
      trackAction("Clear resolved errors");
      const data = await clearMutation.data?.json();
      queryClient.invalidateQueries({ queryKey: ["/api/error-logs"] });
      toast({ title: `Cleared ${data?.deleted ?? 0} resolved errors` });
    },
  });

  const unresolvedCount = filterMode === "unresolved" ? logs.length : undefined;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4" data-testid="page-error-log">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" data-testid="text-page-title">IT / Error Log</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLoading ? "Loading..." : `${logs.length} error${logs.length !== 1 ? "s" : ""} shown`}
            {unresolvedCount !== undefined && ` (${unresolvedCount} unresolved)`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => clearMutation.mutate()}
          disabled={clearMutation.isPending || filterMode !== "resolved"}
          data-testid="button-clear-resolved"
        >
          {clearMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Trash2 className="h-3 w-3 mr-1" />}
          Clear Resolved
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search errors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm"
            data-testid="input-search-errors"
          />
        </div>
        <div className="flex rounded-md border overflow-hidden">
          {(["unresolved", "resolved", "all"] as FilterMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`px-3 py-1 text-xs font-medium capitalize transition-colors ${
                filterMode === mode
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted text-muted-foreground"
              }`}
              data-testid={`button-filter-${mode}`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm" data-testid="text-empty-state">
          No errors found. The system is running cleanly.
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <ErrorLogCard key={log.id} log={log} />
          ))}
        </div>
      )}
    </div>
  );
}
