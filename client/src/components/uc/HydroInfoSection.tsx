import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, Zap, Hash, Building2, User, FileText } from "lucide-react";
import type { Project } from "@shared/schema";

interface AsanaCustomField {
  name: string;
  display_value: string | null;
}

export function HydroInfoSection({ project }: { project: Project }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [hydroCompany, setHydroCompany] = useState(project.hydroCompanyName || '');
  const [hydroAccount, setHydroAccount] = useState(project.hydroAccountNumber || '');
  const [hydroName, setHydroName] = useState(project.hydroCustomerName || '');

  const hasInfo = project.hydroCompanyName || project.hydroAccountNumber || project.hydroCustomerName;
  const hasFile = project.hydroBillUrl;

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const res = await apiRequest("PATCH", `/api/projects/${project.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: "Hydro info saved" });
      setEditing(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('hydroBill', file);
      const res = await fetch(`/api/projects/${project.id}/hydro-bill`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Failed to upload');
      return res.json();
    },
    onSuccess: (data: { extracted?: { hydroCompanyName?: string; hydroAccountNumber?: string; hydroCustomerName?: string }; aiError?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      if (data.extracted && (data.extracted.hydroCompanyName || data.extracted.hydroAccountNumber || data.extracted.hydroCustomerName)) {
        const parts = [];
        if (data.extracted.hydroCompanyName) parts.push(data.extracted.hydroCompanyName);
        if (data.extracted.hydroAccountNumber) parts.push(`Acct: ${data.extracted.hydroAccountNumber}`);
        if (data.extracted.hydroCustomerName) parts.push(data.extracted.hydroCustomerName);
        toast({ title: "Hydro bill uploaded & scanned", description: `Extracted: ${parts.join(', ')}` });
      } else {
        const reason = data.aiError || "Could not auto-extract fields";
        toast({ title: "Hydro bill uploaded to Asana", description: `${reason} — you can enter them manually.` });
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (err: Error) => {
      toast({ title: "Error uploading", description: err.message, variant: "destructive" });
    }
  });

  const utilityFromAsana = (project.asanaCustomFields as AsanaCustomField[] | null)?.find(
    (f) => f.name === 'Utility Name'
  )?.display_value;

  const fileInput = (
    <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx"
      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMutation.mutate(f); }} data-testid={`input-hydro-upload-${project.id}`} />
  );

  if (!editing && !hasInfo && !hasFile) {
    return (
      <div className="mt-2 pt-2 border-t">
        <div className="flex items-center flex-wrap gap-1">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1 mr-auto">
            <Zap className="h-3 w-3" /> Hydro Bill Info
          </p>
          {fileInput}
          <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 gap-1" onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending} data-testid={`button-upload-hydro-${project.id}`}>
            {uploadMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            {uploadMutation.isPending ? 'Scanning...' : 'Upload & Scan Bill'}
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 gap-1" onClick={() => {
            setHydroCompany(utilityFromAsana || '');
            setEditing(true);
          }} data-testid={`button-add-hydro-${project.id}`}>
            <Hash className="h-3 w-3" /> Enter Manually
          </Button>
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="mt-2 pt-2 border-t space-y-2" data-testid={`hydro-edit-${project.id}`}>
        <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
          <Zap className="h-3 w-3" /> Hydro Bill Information
        </p>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-[10px]">Hydro Company</Label>
            <Input className="h-7 text-xs" value={hydroCompany} onChange={(e) => setHydroCompany(e.target.value)}
              placeholder="e.g. Toronto Hydro" data-testid={`input-hydro-company-${project.id}`} />
          </div>
          <div>
            <Label className="text-[10px]">Account Number</Label>
            <Input className="h-7 text-xs" value={hydroAccount} onChange={(e) => setHydroAccount(e.target.value)}
              placeholder="Account #" data-testid={`input-hydro-account-${project.id}`} />
          </div>
          <div>
            <Label className="text-[10px]">Customer Name (on bill)</Label>
            <Input className="h-7 text-xs" value={hydroName} onChange={(e) => setHydroName(e.target.value)}
              placeholder="Exact name on bill" data-testid={`input-hydro-name-${project.id}`} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" className="h-7 text-xs" disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate({ hydroCompanyName: hydroCompany, hydroAccountNumber: hydroAccount, hydroCustomerName: hydroName })}
            data-testid={`button-save-hydro-${project.id}`}>
            {saveMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
            Save
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(false)} data-testid={`button-cancel-hydro-${project.id}`}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 pt-2 border-t" data-testid={`hydro-info-${project.id}`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
          <Zap className="h-3 w-3" /> Hydro Bill Info
        </p>
        <div className="flex items-center gap-1">
          {fileInput}
          <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5 gap-1" onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending} data-testid={`button-upload-hydro-${project.id}`}>
            {uploadMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            {uploadMutation.isPending ? 'Scanning...' : hasFile ? 'Re-upload' : 'Upload & Scan'}
          </Button>
          <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5" onClick={() => {
            setHydroCompany(project.hydroCompanyName || utilityFromAsana || '');
            setHydroAccount(project.hydroAccountNumber || '');
            setHydroName(project.hydroCustomerName || '');
            setEditing(true);
          }} data-testid={`button-edit-hydro-${project.id}`}>
            Edit
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px]">
        {project.hydroCompanyName && (
          <span className="flex items-center gap-1"><Building2 className="h-3 w-3 text-muted-foreground" /> {project.hydroCompanyName}</span>
        )}
        {project.hydroAccountNumber && (
          <span className="flex items-center gap-1"><Hash className="h-3 w-3 text-muted-foreground" /> {project.hydroAccountNumber}</span>
        )}
        {project.hydroCustomerName && (
          <span className="flex items-center gap-1"><User className="h-3 w-3 text-muted-foreground" /> {project.hydroCustomerName}</span>
        )}
        {hasFile && project.hydroBillUrl !== 'uploaded' && (
          <a href={project.hydroBillUrl!} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-green-600 dark:text-green-400 hover:underline cursor-pointer"
            data-testid={`link-hydro-view-${project.id}`}>
            <FileText className="h-3 w-3" /> View Bill
          </a>
        )}
        {hasFile && project.hydroBillUrl === 'uploaded' && (
          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <FileText className="h-3 w-3" /> Bill on Asana
          </span>
        )}
      </div>
    </div>
  );
}
