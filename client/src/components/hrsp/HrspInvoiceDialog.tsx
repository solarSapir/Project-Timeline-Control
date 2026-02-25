import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Download, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Project } from "@shared/schema";

export function HrspInvoiceDialog({ project }: { project: Project }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serviceAddress, setServiceAddress] = useState(project.hrspServiceAddress || "");
  const [quoteNumber, setQuoteNumber] = useState(project.hrspQuoteNumber || "");
  const [quoteDate, setQuoteDate] = useState(project.hrspQuoteDate || "");
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setServiceAddress(project.hrspServiceAddress || "");
      setQuoteNumber(project.hrspQuoteNumber || "");
      setQuoteDate(project.hrspQuoteDate || "");
    }
  }, [open, project.hrspServiceAddress, project.hrspQuoteNumber, project.hrspQuoteDate]);

  const handleGenerate = async () => {
    if (!serviceAddress || !quoteDate || !quoteNumber) {
      toast({ title: "Missing fields", description: "All fields are required", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await apiRequest("POST", `/api/projects/${project.id}/hrsp-invoice`, {
        serviceAddress,
        quoteDate,
        quoteNumber,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Invoice generated", description: "HRSP invoice created and uploaded to Asana" });
      setOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate invoice";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" data-testid={`button-generate-invoice-${project.id}`}>
          <FileText className="h-3 w-3 mr-1" />
          Generate
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate HRSP Invoice</DialogTitle>
          <DialogDescription>Fill in the project details to generate a compliant HRSP invoice PDF.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {project.name}
          </p>
          <div className="space-y-2">
            <Label htmlFor="serviceAddress" className="text-sm">Service Address</Label>
            <Textarea
              id="serviceAddress"
              value={serviceAddress}
              onChange={(e) => setServiceAddress(e.target.value)}
              placeholder="Enter the customer's service address"
              rows={3}
              data-testid="input-service-address"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="quoteNumber" className="text-sm">Quote Number</Label>
              <Input
                id="quoteNumber"
                value={quoteNumber}
                onChange={(e) => setQuoteNumber(e.target.value)}
                placeholder="e.g. 25254"
                data-testid="input-quote-number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quoteDate" className="text-sm">Quote Date</Label>
              <Input
                id="quoteDate"
                type="date"
                value={quoteDate}
                onChange={(e) => setQuoteDate(e.target.value)}
                data-testid="input-quote-date"
              />
            </div>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={loading || !serviceAddress || !quoteDate || !quoteNumber}
            className="w-full"
            data-testid="button-submit-invoice"
          >
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
            {loading ? "Generating..." : "Generate & Upload to Asana"}
          </Button>
          {project.hrspInvoiceUrl && (
            <a
              href={`/api/projects/${project.id}/hrsp-invoice/download`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              data-testid={`link-download-invoice-${project.id}`}
            >
              <Download className="h-3 w-3" />
              Download last generated invoice
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
