import { useRef } from "react";
import { Check, Circle, Upload, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { HrspInvoiceDialog } from "./HrspInvoiceDialog";
import type { Project, HrspRequiredDocument } from "@shared/schema";

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

function useUpload(projectId: string, endpoint: string, fieldName: string, successMsg: string) {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append(fieldName, file);
      const res = await fetch(`/api/projects/${projectId}/${endpoint}`, { method: "POST", body: formData });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Uploaded", description: successMsg });
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });
}

function UploadButton({ mutation, inputRef, hasDoc, testId }: {
  mutation: ReturnType<typeof useUpload>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  hasDoc: boolean;
  testId: string;
}) {
  if (mutation.isPending) return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-6 text-[10px] px-2"
      onClick={() => inputRef.current?.click()}
      data-testid={testId}
    >
      {hasDoc ? <RefreshCw className="h-3 w-3 mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
      {hasDoc ? "Replace" : "Upload"}
    </Button>
  );
}

function getDocStatus(key: string, project: Project): { done: boolean; label: string } {
  switch (key) {
    case "invoice":
      return { done: !!project.hrspInvoiceUrl, label: "Invoice" };
    case "authorization":
      return { done: !!project.hrspAuthDocUrl, label: "Authorization" };
    case "hydroBill": {
      const hasPower = !!project.hrspPowerConsumptionUrl || !!project.hydroBillUrl;
      const isAutoLinked = !project.hrspPowerConsumptionUrl && !!project.hydroBillUrl;
      return { done: hasPower, label: isAutoLinked ? "Hydro Bill (from UC)" : "Hydro Bill" };
    }
    case "sld":
      return { done: !!project.hrspSldUrl, label: "SLD" };
    default:
      return { done: false, label: key };
  }
}

export function HrspChecklist({ project }: { project: Project }) {
  const authRef = useRef<HTMLInputElement>(null);
  const powerRef = useRef<HTMLInputElement>(null);
  const sldRef = useRef<HTMLInputElement>(null);

  const { data: config } = useQuery<{ requiredDocuments: HrspRequiredDocument[] }>({
    queryKey: ["/api/hrsp-config"],
  });

  const uploadAuth = useUpload(project.id, "hrsp-auth-doc", "authDoc", "Authorization document uploaded to Asana");
  const uploadPower = useUpload(project.id, "hrsp-power-doc", "powerDoc", "Power consumption document uploaded to Asana");
  const uploadSld = useUpload(project.id, "hrsp-sld", "sldDoc", "SLD document uploaded to Asana");

  const enabledDocs = (config?.requiredDocuments || []).filter(d => d.enabled);
  const completedCount = enabledDocs.filter(d => getDocStatus(d.key, project).done).length;
  const totalCount = enabledDocs.length;

  const handleFile = (ref: React.RefObject<HTMLInputElement | null>, mutation: ReturnType<typeof useUpload>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) mutation.mutate(file);
    e.target.value = "";
  };

  return (
    <div className="mt-2 space-y-1" data-testid={`hrsp-checklist-${project.id}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          HRSP Docs ({completedCount}/{totalCount})
        </span>
      </div>

      {enabledDocs.map(doc => {
        const { done, label } = getDocStatus(doc.key, project);

        if (doc.key === "invoice") {
          return (
            <CheckItem key={doc.key} done={done} label={label}>
              <HrspInvoiceDialog project={project} />
            </CheckItem>
          );
        }

        if (doc.key === "authorization") {
          return (
            <CheckItem key={doc.key} done={done} label={label}>
              <UploadButton mutation={uploadAuth} inputRef={authRef} hasDoc={done} testId={`button-upload-auth-${project.id}`} />
              <input ref={authRef} type="file" className="hidden" onChange={handleFile(authRef, uploadAuth)} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
            </CheckItem>
          );
        }

        if (doc.key === "hydroBill") {
          const hasPower = !!project.hrspPowerConsumptionUrl || !!project.hydroBillUrl;
          return (
            <CheckItem key={doc.key} done={done} label={label}>
              {!hasPower && (
                <>
                  <UploadButton mutation={uploadPower} inputRef={powerRef} hasDoc={false} testId={`button-upload-power-${project.id}`} />
                  <input ref={powerRef} type="file" className="hidden" onChange={handleFile(powerRef, uploadPower)} accept=".pdf,.jpg,.jpeg,.png" />
                </>
              )}
            </CheckItem>
          );
        }

        if (doc.key === "sld") {
          return (
            <CheckItem key={doc.key} done={done} label={label}>
              <UploadButton mutation={uploadSld} inputRef={sldRef} hasDoc={done} testId={`button-upload-sld-${project.id}`} />
              <input ref={sldRef} type="file" className="hidden" onChange={handleFile(sldRef, uploadSld)} accept=".pdf,.jpg,.jpeg,.png,.dwg" />
            </CheckItem>
          );
        }

        return null;
      })}
    </div>
  );
}
