import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Project } from "@shared/schema";

export function HrspPaidInvoiceDialog({ project }: { project: Project }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [installDate, setInstallDate] = useState(project.hrspInstallDate || "");
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setInstallDate(project.hrspInstallDate || "");
    }
  }, [open, project.hrspInstallDate]);

  const hasOriginalInvoice = !!project.hrspServiceAddress && !!project.hrspQuoteNumber;

  const handleGenerate = async () => {
    if (!installDate) {
      toast({ title: "Missing field", description: "Installation date is required", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await apiRequest("POST", `/api/projects/${project.id}/hrsp-paid-invoice`, { installDate });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Paid invoice generated", description: "HRSP paid invoice created and uploaded to Asana" });
      setOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate paid invoice";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" data-testid={`button-generate-paid-invoice-${project.id}`}>
          <FileText className="h-3 w-3 mr-1" />
          Generate
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Paid Invoice</DialogTitle>
          <DialogDescription>
            This generates the same invoice marked as "PAID" with the installation date filled in.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">{project.name}</p>

          {!hasOriginalInvoice && (
            <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200 text-sm">
              The original pre-approval invoice must be generated first before creating a paid version.
            </div>
          )}

          {hasOriginalInvoice && (
            <>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Quote #: {project.hrspQuoteNumber}</p>
                <p>Service Address: {project.hrspServiceAddress}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="installDate" className="text-sm">Installation Date</Label>
                <Input
                  id="installDate"
                  type="date"
                  value={installDate}
                  onChange={(e) => setInstallDate(e.target.value)}
                  data-testid="input-install-date"
                />
              </div>
              <Button
                onClick={handleGenerate}
                disabled={loading || !installDate}
                className="w-full"
                data-testid="button-submit-paid-invoice"
              >
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                {loading ? "Generating..." : "Generate Paid Invoice & Upload to Asana"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
