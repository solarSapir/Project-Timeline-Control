import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, FileText, Download, ChevronDown, ChevronRight } from "lucide-react";
import { LogoSpinner } from "@/components/ui/logo-spinner";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { HrspInvoiceTemplate, HrspRequiredDocument } from "@shared/schema";

interface HrspConfigResponse {
  invoiceTemplate: HrspInvoiceTemplate;
  requiredDocuments: HrspRequiredDocument[];
  updatedAt: string | null;
}

function DocumentRequirements({ title, docs, onChange }: {
  title: string;
  docs: HrspRequiredDocument[];
  onChange: (updated: HrspRequiredDocument[]) => void;
}) {
  const toggle = (key: string) => {
    onChange(docs.map(d => d.key === key ? { ...d, enabled: !d.enabled } : d));
  };

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</h4>
      {docs.map(doc => (
        <div key={doc.key} className="flex items-start gap-3 p-3 rounded-lg border bg-card" data-testid={`doc-requirement-${doc.key}`}>
          <Switch checked={doc.enabled} onCheckedChange={() => toggle(doc.key)} data-testid={`switch-doc-${doc.key}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{doc.label}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{doc.type}</span>
            </div>
            {doc.description && <p className="text-xs text-muted-foreground mt-0.5">{doc.description}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

const TEMPLATE_FIELDS: { key: keyof HrspInvoiceTemplate; label: string; type: "text" | "number"; group: string }[] = [
  { key: "companyName", label: "Company Name", type: "text", group: "Company" },
  { key: "address1", label: "Address Line 1", type: "text", group: "Company" },
  { key: "address2", label: "Address Line 2", type: "text", group: "Company" },
  { key: "city", label: "City / Province / Postal", type: "text", group: "Company" },
  { key: "phone", label: "Phone", type: "text", group: "Company" },
  { key: "email", label: "Email", type: "text", group: "Company" },
  { key: "gstHst", label: "GST/HST Registration", type: "text", group: "Company" },
  { key: "panelMake", label: "Panel Make", type: "text", group: "Solar Panels" },
  { key: "panelModel", label: "Panel Model", type: "text", group: "Solar Panels" },
  { key: "panelWatt", label: "Panel Watt", type: "number", group: "Solar Panels" },
  { key: "panelQty", label: "Panel Qty", type: "number", group: "Solar Panels" },
  { key: "totalKwDc", label: "Total kW DC", type: "number", group: "Solar Panels" },
  { key: "panelCost", label: "Panel Cost ($)", type: "number", group: "Solar Panels" },
  { key: "batteryMake", label: "Battery Make", type: "text", group: "Battery" },
  { key: "batteryModel", label: "Battery Model", type: "text", group: "Battery" },
  { key: "batterySize", label: "Battery Size", type: "text", group: "Battery" },
  { key: "batteryCost", label: "Battery Cost ($)", type: "number", group: "Battery" },
  { key: "otherCost", label: "Other Cost ($)", type: "number", group: "Totals" },
  { key: "subtotal", label: "Subtotal ($)", type: "number", group: "Totals" },
  { key: "hstRate", label: "HST Rate (decimal)", type: "number", group: "Totals" },
  { key: "hst", label: "HST Amount ($)", type: "number", group: "Totals" },
  { key: "total", label: "Total ($)", type: "number", group: "Totals" },
  { key: "pvOnlyPreTax", label: "PV Only Pre-tax ($)", type: "number", group: "Totals" },
];

function InvoiceTemplateEditor({ template, onChange }: { template: HrspInvoiceTemplate; onChange: (t: HrspInvoiceTemplate) => void }) {
  const [expanded, setExpanded] = useState(false);
  const groups = [...new Set(TEMPLATE_FIELDS.map(f => f.group))];

  const updateField = (key: keyof HrspInvoiceTemplate, value: string) => {
    const field = TEMPLATE_FIELDS.find(f => f.key === key);
    const parsed = field?.type === "number" ? parseFloat(value) || 0 : value;
    onChange({ ...template, [key]: parsed });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-sm font-medium hover:text-primary transition-colors"
          data-testid="toggle-invoice-template"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Edit Template Values
        </button>
        <a
          href="/api/projects/hrsp-invoice/sample"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          data-testid="link-download-sample"
        >
          <Download className="h-3.5 w-3.5" />
          Download Sample Invoice
        </a>
      </div>

      {expanded && (
        <div className="space-y-4 pt-2">
          {groups.map(group => (
            <div key={group}>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{group}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TEMPLATE_FIELDS.filter(f => f.group === group).map(field => (
                  <div key={field.key} className="space-y-1">
                    <Label className="text-xs">{field.label}</Label>
                    <Input
                      type={field.type}
                      step={field.type === "number" ? "0.01" : undefined}
                      value={String(template[field.key])}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      className="h-8 text-sm"
                      data-testid={`input-template-${field.key}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HrspConfigEditor() {
  const { toast } = useToast();
  const [template, setTemplate] = useState<HrspInvoiceTemplate | null>(null);
  const [docs, setDocs] = useState<HrspRequiredDocument[] | null>(null);

  const { data: config, isLoading } = useQuery<HrspConfigResponse>({
    queryKey: ["/api/hrsp-config"],
  });

  useEffect(() => {
    if (config) {
      setTemplate(config.invoiceTemplate);
      setDocs(config.requiredDocuments);
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", "/api/hrsp-config", {
        invoiceTemplate: template,
        requiredDocuments: docs,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hrsp-config"] });
      toast({ title: "HRSP configuration saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading || !template || !docs) {
    return <LogoSpinner size="sm" className="p-8" />;
  }

  const preDocs = docs.filter(d => d.phase === "pre");
  const closeoffDocs = docs.filter(d => d.phase === "closeoff");

  const updateDocs = (phase: "pre" | "closeoff", updated: HrspRequiredDocument[]) => {
    const other = docs.filter(d => d.phase !== phase);
    setDocs([...other, ...updated].sort((a, b) => {
      const order = docs.map(d => d.key);
      return order.indexOf(a.key) - order.indexOf(b.key);
    }));
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <DocumentRequirements
          title="Pre-Approval Documents"
          docs={preDocs}
          onChange={(updated) => updateDocs("pre", updated)}
        />
        <DocumentRequirements
          title="Close-Off Documents"
          docs={closeoffDocs}
          onChange={(updated) => updateDocs("closeoff", updated)}
        />
      </div>

      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4" />
          Invoice Template
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Equipment specs and pricing used when generating HRSP invoices. The paid invoice uses the same template marked as "PAID".
        </p>
        <InvoiceTemplateEditor template={template} onChange={setTemplate} />
      </div>

      <div className="flex justify-end pt-2">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          size="lg"
          data-testid="button-save-hrsp-config"
        >
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save HRSP Configuration
        </Button>
      </div>
    </div>
  );
}
