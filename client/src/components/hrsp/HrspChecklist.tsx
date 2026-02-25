import { useRef } from "react";
import { Check, Circle, Upload, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { HrspInvoiceDialog } from "./HrspInvoiceDialog";
import type { Project } from "@shared/schema";

function CheckItem({ done, label, children }: { done: boolean; label: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      {done ? (
        <Check className="h-3 w-3 text-green-600 dark:text-green-400 flex-shrink-0" />
      ) : (
        <Circle className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      )}
      <span className={`text-[11px] ${done ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}>
        {label}
      </span>
      {children}
    </div>
  );
}

export function HrspChecklist({ project }: { project: Project }) {
  const authRef = useRef<HTMLInputElement>(null);
  const powerRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const hasInvoice = !!project.hrspInvoiceUrl;
  const hasAuth = !!project.hrspAuthDocUrl;
  const hasPower = !!project.hrspPowerConsumptionUrl || !!project.hydroBillUrl;
  const isAutoLinked = !project.hrspPowerConsumptionUrl && !!project.hydroBillUrl;

  const uploadAuth = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("authDoc", file);
      const res = await fetch(`/api/projects/${project.id}/hrsp-auth-doc`, { method: "POST", body: formData });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Uploaded", description: "Authorization document uploaded to Asana" });
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const uploadPower = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("powerDoc", file);
      const res = await fetch(`/api/projects/${project.id}/hrsp-power-doc`, { method: "POST", body: formData });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Uploaded", description: "Power consumption document uploaded to Asana" });
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const handleAuthFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadAuth.mutate(file);
    e.target.value = "";
  };

  const handlePowerFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadPower.mutate(file);
    e.target.value = "";
  };

  const completedCount = [hasInvoice, hasAuth, hasPower].filter(Boolean).length;

  return (
    <div className="mt-2 space-y-1" data-testid={`hrsp-checklist-${project.id}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          HRSP Docs ({completedCount}/3)
        </span>
      </div>

      <CheckItem done={hasInvoice} label="Invoice">
        <HrspInvoiceDialog project={project} />
      </CheckItem>

      <CheckItem done={hasAuth} label="Authorization">
        {uploadAuth.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => authRef.current?.click()}
            data-testid={`button-upload-auth-${project.id}`}
          >
            {hasAuth ? <RefreshCw className="h-3 w-3 mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
            {hasAuth ? "Replace" : "Upload"}
          </Button>
        )}
        <input ref={authRef} type="file" className="hidden" onChange={handleAuthFile} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
      </CheckItem>

      <CheckItem done={hasPower} label={isAutoLinked ? "Hydro Bill (from UC)" : "Hydro Bill"}>
        {uploadPower.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : !hasPower ? (
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => powerRef.current?.click()}
            data-testid={`button-upload-power-${project.id}`}
          >
            <Upload className="h-3 w-3 mr-1" />
            Upload
          </Button>
        ) : null}
        <input ref={powerRef} type="file" className="hidden" onChange={handlePowerFile} accept=".pdf,.jpg,.jpeg,.png" />
      </CheckItem>
    </div>
  );
}
