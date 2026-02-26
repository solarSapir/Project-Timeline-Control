import { useRef } from "react";
import { Check, Circle, Upload, Loader2, RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { HrspInvoiceDialog } from "./HrspInvoiceDialog";
import { HrspPaidInvoiceDialog } from "./HrspPaidInvoiceDialog";
import type { Project, HrspRequiredDocument } from "@shared/schema";
import { HRSP_PRE_APPROVAL_STATUSES, HRSP_POST_APPROVAL_STATUSES } from "@shared/schema";

function CheckItem({ done, label, grayed, fileUrl, children }: { done: boolean; label: string; grayed?: boolean; fileUrl?: string | null; children?: React.ReactNode }) {
  const textClass = grayed
    ? "text-[11px] text-muted-foreground/50 line-through"
    : done
      ? "text-[11px] text-green-700 dark:text-green-400"
      : "text-[11px] text-muted-foreground";

  const labelElement = done && fileUrl && !grayed ? (
    <a
      href={fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[11px] text-green-700 dark:text-green-400 hover:underline cursor-pointer"
      data-testid={`link-doc-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {label}
    </a>
  ) : (
    <span className={textClass}>{label}</span>
  );

  return (
    <div className={`flex items-center gap-1.5 ${grayed ? "opacity-50" : ""}`}>
      {done ? (
        <Check className="h-3 w-3 text-green-600 dark:text-green-400 flex-shrink-0" />
      ) : (
        <Circle className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      )}
      {labelElement}
      {!grayed && children}
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
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
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
    <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => inputRef.current?.click()} data-testid={testId}>
      {hasDoc ? <RefreshCw className="h-3 w-3 mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
      {hasDoc ? "Replace" : "Upload"}
    </Button>
  );
}

function getDocStatus(key: string, project: Project): { done: boolean; label: string; fileUrl: string | null } {
  const map: Record<string, { field: keyof Project; label: string }> = {
    invoice: { field: "hrspInvoiceUrl", label: "Invoice" },
    authorization: { field: "hrspAuthDocUrl", label: "Participation Document" },
    sld: { field: "hrspSldUrl", label: "SLD" },
    roofPics: { field: "hrspRoofPicsUrl", label: "Roof Photos" },
    panelNameplate: { field: "hrspPanelNameplateUrl", label: "Panel Nameplate" },
    inverterNameplate: { field: "hrspInverterNameplateUrl", label: "Inverter Nameplate" },
    batteryNameplate: { field: "hrspBatteryNameplateUrl", label: "Battery Nameplate" },
    esaCert: { field: "hrspEsaCertUrl", label: "ESA Certificate" },
    paidInvoice: { field: "hrspPaidInvoiceUrl", label: "Paid Invoice" },
  };

  if (key === "hydroBill") {
    const hasPower = !!project.hrspPowerConsumptionUrl || !!project.hydroBillUrl;
    const isAutoLinked = !project.hrspPowerConsumptionUrl && !!project.hydroBillUrl;
    const url = (project.hrspPowerConsumptionUrl || project.hydroBillUrl || null) as string | null;
    return { done: hasPower, label: isAutoLinked ? "Hydro Bill (from UC)" : "Hydro Bill", fileUrl: url };
  }

  const entry = map[key];
  if (entry) {
    const url = (project[entry.field] || null) as string | null;
    return { done: !!url, label: entry.label, fileUrl: url };
  }
  return { done: false, label: key, fileUrl: null };
}

const UPLOAD_CONFIG: Record<string, { endpoint: string; fieldName: string; msg: string; accept: string }> = {
  invoice: { endpoint: "hrsp-invoice-upload", fieldName: "invoice", msg: "Invoice uploaded", accept: ".pdf,.jpg,.jpeg,.png" },
  authorization: { endpoint: "hrsp-auth-doc", fieldName: "authDoc", msg: "Participation document saved", accept: ".pdf,.jpg,.jpeg,.png,.doc,.docx" },
  hydroBill: { endpoint: "hrsp-power-doc", fieldName: "powerDoc", msg: "Power consumption document saved", accept: ".pdf,.jpg,.jpeg,.png" },
  sld: { endpoint: "hrsp-sld", fieldName: "sldDoc", msg: "SLD document saved", accept: ".pdf,.jpg,.jpeg,.png,.dwg" },
  roofPics: { endpoint: "hrsp-roof-pics", fieldName: "roofPics", msg: "Roof photos saved", accept: ".jpg,.jpeg,.png,.heic" },
  panelNameplate: { endpoint: "hrsp-panel-nameplate", fieldName: "panelNameplate", msg: "Panel nameplate photo saved", accept: ".jpg,.jpeg,.png,.heic" },
  inverterNameplate: { endpoint: "hrsp-inverter-nameplate", fieldName: "inverterNameplate", msg: "Inverter nameplate photo saved", accept: ".jpg,.jpeg,.png,.heic" },
  batteryNameplate: { endpoint: "hrsp-battery-nameplate", fieldName: "batteryNameplate", msg: "Battery nameplate photo saved", accept: ".jpg,.jpeg,.png,.heic" },
  esaCert: { endpoint: "hrsp-esa-cert", fieldName: "esaCert", msg: "ESA certificate saved", accept: ".pdf,.jpg,.jpeg,.png" },
  paidInvoice: { endpoint: "hrsp-paid-invoice-upload", fieldName: "paidInvoice", msg: "Paid invoice uploaded", accept: ".pdf,.jpg,.jpeg,.png" },
};

function UploadDocItem({ docKey, project, done, label, fileUrl, grayed }: {
  docKey: string; project: Project; done: boolean; label: string; fileUrl?: string | null; grayed?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const cfg = UPLOAD_CONFIG[docKey];
  const mutation = useUpload(project.id, cfg?.endpoint || "", cfg?.fieldName || "", cfg?.msg || "");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) mutation.mutate(file);
    e.target.value = "";
  };

  if (docKey === "hydroBill") {
    const hasPower = !!project.hrspPowerConsumptionUrl || !!project.hydroBillUrl;
    return (
      <CheckItem done={done} label={label} grayed={grayed} fileUrl={fileUrl}>
        {!hasPower && !grayed && cfg && (
          <>
            <UploadButton mutation={mutation} inputRef={ref} hasDoc={false} testId={`button-upload-power-${project.id}`} />
            <input ref={ref} type="file" className="hidden" onChange={handleFile} accept={cfg.accept} />
          </>
        )}
      </CheckItem>
    );
  }

  return (
    <CheckItem done={done} label={label} grayed={grayed} fileUrl={fileUrl}>
      {cfg && !grayed && (
        <>
          <UploadButton mutation={mutation} inputRef={ref} hasDoc={done} testId={`button-upload-${docKey}-${project.id}`} />
          <input ref={ref} type="file" className="hidden" onChange={handleFile} accept={cfg.accept} />
        </>
      )}
    </CheckItem>
  );
}

function InvoiceItem({ project, done, label, fileUrl, grayed }: {
  project: Project; done: boolean; label: string; fileUrl?: string | null; grayed?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const cfg = UPLOAD_CONFIG.invoice;
  const mutation = useUpload(project.id, cfg.endpoint, cfg.fieldName, cfg.msg);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) mutation.mutate(file);
    e.target.value = "";
  };

  return (
    <CheckItem done={done} label={label} grayed={grayed} fileUrl={fileUrl}>
      {!grayed && (
        <>
          <HrspInvoiceDialog project={project} />
          {mutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={() => ref.current?.click()}
              data-testid={`button-upload-invoice-${project.id}`}
            >
              <Upload className="h-3 w-3 mr-1" />
              {done ? "Replace" : "Upload"}
            </Button>
          )}
          <input ref={ref} type="file" className="hidden" onChange={handleFile} accept={cfg.accept} />
        </>
      )}
    </CheckItem>
  );
}

function PaidInvoiceItem({ project, done, label, fileUrl }: { project: Project; done: boolean; label: string; fileUrl: string | null }) {
  const ref = useRef<HTMLInputElement>(null);
  const cfg = UPLOAD_CONFIG.paidInvoice;
  const mutation = useUpload(project.id, cfg.endpoint, cfg.fieldName, cfg.msg);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) mutation.mutate(file);
    e.target.value = "";
  };

  return (
    <CheckItem done={done} label={label} fileUrl={fileUrl}>
      {mutation.isPending ? (
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-[10px] px-2"
          onClick={() => ref.current?.click()}
          data-testid={`button-upload-paidInvoice-${project.id}`}
        >
          <Upload className="h-3 w-3 mr-1" />
          {done ? "Replace" : "Upload"}
        </Button>
      )}
      <input ref={ref} type="file" className="hidden" onChange={handleFile} accept={cfg.accept} />
      <HrspPaidInvoiceDialog project={project} />
    </CheckItem>
  );
}

export function HrspChecklist({ project }: { project: Project }) {
  const { data: config } = useQuery<{ requiredDocuments: HrspRequiredDocument[] }>({
    queryKey: ["/api/hrsp-config"],
  });

  const allDocs = config?.requiredDocuments || [];
  const status = project.hrspStatus || "";
  const isPostApproval = HRSP_POST_APPROVAL_STATUSES.some(s => status.toLowerCase().includes(s.toLowerCase()));

  const preDocs = allDocs.filter(d => d.phase === "pre" && d.enabled);
  const closeoffDocs = allDocs.filter(d => d.phase === "closeoff" && d.enabled);

  const preCompleted = preDocs.filter(d => getDocStatus(d.key, project).done).length;
  const closeoffCompleted = closeoffDocs.filter(d => getDocStatus(d.key, project).done).length;

  const showCloseoff = isPostApproval || closeoffDocs.some(d => getDocStatus(d.key, project).done);

  return (
    <div className="mt-2 space-y-2" data-testid={`hrsp-checklist-${project.id}`}>
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 mb-1">
          {isPostApproval ? (
            <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
          ) : null}
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            {isPostApproval ? "Pre-Approval" : `Pre-Approval (${preCompleted}/${preDocs.length})`}
          </span>
          {isPostApproval && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">Approved</span>
          )}
        </div>

        {preDocs.map(doc => {
          const { done, label, fileUrl } = getDocStatus(doc.key, project);

          if (doc.key === "invoice") {
            return (
              <InvoiceItem
                key={doc.key}
                project={project}
                done={isPostApproval || done}
                label={label}
                fileUrl={fileUrl}
                grayed={isPostApproval}
              />
            );
          }

          return (
            <UploadDocItem
              key={doc.key}
              docKey={doc.key}
              project={project}
              done={isPostApproval || done}
              label={label}
              fileUrl={fileUrl}
              grayed={isPostApproval}
            />
          );
        })}
      </div>

      {(showCloseoff || isPostApproval) && closeoffDocs.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-border/50">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Close-Off ({closeoffCompleted}/{closeoffDocs.length})
            </span>
          </div>

          {closeoffDocs.map(doc => {
            const { done, label, fileUrl } = getDocStatus(doc.key, project);

            if (doc.key === "paidInvoice") {
              return (
                <PaidInvoiceItem key={doc.key} project={project} done={done} label={label} fileUrl={fileUrl} />
              );
            }

            return (
              <UploadDocItem
                key={doc.key}
                docKey={doc.key}
                project={project}
                done={done}
                label={label}
                fileUrl={fileUrl}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
