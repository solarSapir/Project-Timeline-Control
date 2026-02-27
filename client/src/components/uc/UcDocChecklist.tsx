import { useRef } from "react";
import { Check, Circle, Upload, Loader2, RefreshCw, Camera, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import type { Project } from "@shared/schema";

interface AsanaCustomField {
  name: string;
  display_value: string | null;
}

const LEGACY_STATUSES = ["submitted", "approved", "complete", "close-off", "close off"];

function isLegacyStatus(ucStatus: string | null | undefined): boolean {
  if (!ucStatus) return false;
  return LEGACY_STATUSES.some(s => ucStatus.toLowerCase().includes(s));
}

function getUtilityName(project: Project): string | null {
  const fields = project.asanaCustomFields as AsanaCustomField[] | null;
  return fields?.find(f => f.name === "Utility Name")?.display_value || null;
}

function isAlectra(project: Project): boolean {
  const utility = getUtilityName(project);
  return !!utility && utility.toLowerCase().includes("alectra");
}

function CheckItem({ done, label, grayed, required, children }: {
  done: boolean; label: string; grayed?: boolean; required?: boolean; children?: React.ReactNode;
}) {
  const textClass = grayed
    ? "text-[11px] text-muted-foreground/50 line-through"
    : done
      ? "text-[11px] text-green-700 dark:text-green-400"
      : "text-[11px] text-muted-foreground";

  return (
    <div className={`flex items-center gap-1.5 ${grayed ? "opacity-50" : ""}`}>
      {done ? (
        <Check className="h-3 w-3 text-green-600 dark:text-green-400 flex-shrink-0" />
      ) : (
        <Circle className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      )}
      <span className={textClass}>{label}</span>
      {required && !done && !grayed && (
        <span className="text-[9px] text-red-500 font-medium">Required</span>
      )}
      {!required && !done && !grayed && (
        <span className="text-[9px] text-muted-foreground/70">Optional</span>
      )}
      {!grayed && children}
    </div>
  );
}

export function UcDocChecklist({ project }: { project: Project }) {
  const { toast } = useToast();
  const meterbaseRef = useRef<HTMLInputElement>(null);
  const grayed = isLegacyStatus(project.ucStatus);
  const alectra = isAlectra(project);

  const isNS = project.province?.toLowerCase().includes('nova scotia') || project.province?.toLowerCase() === 'ns';
  const isInstall = project.installType?.toLowerCase() === 'install';
  const nsInstall = isNS && isInstall;

  const hasHydroBill = !!(project.hydroBillUrl || project.hydroAccountNumber);
  const hasMeterbase = !!project.ucMeterbaseUrl;
  const hasElectricalPermit = !!project.electricalPermitUrl;

  const electricalPermitRef = useRef<HTMLInputElement>(null);

  const meterbaseMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("meterbase", file);
      const res = await fetch(`/api/projects/${project.id}/meterbase`, { method: "POST", body: formData });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "files"] });
      toast({ title: "Uploaded", description: "Meterbase photo saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const electricalPermitMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("electricalPermit", file);
      const res = await fetch(`/api/projects/${project.id}/electrical-permit`, { method: "POST", body: formData });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "files"] });
      toast({ title: "Uploaded", description: "Electrical permit saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const allDone = hasHydroBill && (hasMeterbase || !alectra) && (hasElectricalPermit || !nsInstall);
  const missingRequired = !grayed && (!hasHydroBill || (alectra && !hasMeterbase) || (nsInstall && !hasElectricalPermit));

  return (
    <div className="mt-2 pt-2 border-t" data-testid={`uc-doc-checklist-${project.id}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <FileText className="h-3 w-3 text-muted-foreground" />
        <span className="text-[11px] font-medium text-muted-foreground">UC Documents</span>
        {grayed && (
          <span className="text-[9px] text-muted-foreground/60 italic">assumed collected</span>
        )}
        {!grayed && allDone && (
          <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
        )}
        {missingRequired && (
          <AlertCircle className="h-3 w-3 text-amber-500" />
        )}
      </div>

      <div className="space-y-0.5 ml-0.5">
        <CheckItem done={hasHydroBill} label="Hydro Bill / Account #" grayed={grayed} required>
          {!hasHydroBill && !grayed && (
            <span className="text-[9px] text-muted-foreground ml-1">↑ use section above</span>
          )}
        </CheckItem>

        <CheckItem done={hasMeterbase} label="Meterbase Photo" grayed={grayed} required={alectra}>
          {!grayed && (
            <>
              <input
                ref={meterbaseRef}
                type="file"
                className="hidden"
                accept=".jpg,.jpeg,.png,.heic"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) meterbaseMutation.mutate(f);
                  e.target.value = "";
                }}
                data-testid={`input-meterbase-${project.id}`}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-5 text-[10px] px-1.5 ml-1"
                onClick={() => meterbaseRef.current?.click()}
                disabled={meterbaseMutation.isPending}
                data-testid={`button-upload-meterbase-${project.id}`}
              >
                {meterbaseMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : hasMeterbase ? (
                  <><RefreshCw className="h-3 w-3 mr-0.5" /> Replace</>
                ) : (
                  <><Camera className="h-3 w-3 mr-0.5" /> Upload</>
                )}
              </Button>
            </>
          )}
        </CheckItem>

        {nsInstall && (
          <CheckItem done={hasElectricalPermit} label="Electrical Permit (NS)" grayed={grayed} required>
            {!grayed && (
              <>
                <input
                  ref={electricalPermitRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) electricalPermitMutation.mutate(f);
                    e.target.value = "";
                  }}
                  data-testid={`input-electrical-permit-${project.id}`}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-5 text-[10px] px-1.5 ml-1"
                  onClick={() => electricalPermitRef.current?.click()}
                  disabled={electricalPermitMutation.isPending}
                  data-testid={`button-upload-electrical-permit-${project.id}`}
                >
                  {electricalPermitMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : hasElectricalPermit ? (
                    <><RefreshCw className="h-3 w-3 mr-0.5" /> Replace</>
                  ) : (
                    <><Upload className="h-3 w-3 mr-0.5" /> Upload</>
                  )}
                </Button>
              </>
            )}
          </CheckItem>
        )}
      </div>
    </div>
  );
}
