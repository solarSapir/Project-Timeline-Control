import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Trash2, Save, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";

GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface TemplateField {
  id?: string;
  templateId: string;
  tag: string;
  label: string;
  fieldType: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontColor: string;
  options: string | null;
  required: boolean;
  defaultValue: string | null;
  sortOrder: number;
}

interface TemplateData {
  id: string;
  name: string;
  viewType: string;
  fileName: string;
  mimeType: string;
  pageCount: number;
  fields: TemplateField[];
}

const DEFAULT_VALUES = [
  { value: "", label: "None" },
  { value: "project.name", label: "Project Name" },
  { value: "project.province", label: "Province" },
  { value: "project.installType", label: "Install Type" },
  { value: "project.paymentMethod", label: "Payment Method" },
  { value: "project.contractorName", label: "Contractor" },
  { value: "project.asanaDueDate", label: "Due Date" },
];

interface Props {
  templateId: string;
  onClose: () => void;
}

export function TemplateFieldEditor({ templateId, onClose }: Props) {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [selectedField, setSelectedField] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState<{ fieldIdx: number; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [resizing, setResizing] = useState<{ fieldIdx: number; startX: number; startY: number; origW: number; origH: number } | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [pdfPageDataUrl, setPdfPageDataUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const { data: template, isLoading } = useQuery<TemplateData>({
    queryKey: ["/api/document-templates", templateId],
  });

  useEffect(() => {
    if (template?.fields) {
      setFields(template.fields.map((f, i) => ({
        ...f,
        page: f.page || 1,
        fontSize: f.fontSize || 12,
        fontColor: f.fontColor || "#000000",
        required: f.required || false,
        sortOrder: f.sortOrder ?? i,
        fieldType: f.fieldType || "text",
      })));
    }
  }, [template]);

  const previewUrl = `/api/document-templates/${templateId}/preview`;
  const isImage = template?.mimeType?.startsWith("image/");
  const isPdf = template?.mimeType === "application/pdf";

  useEffect(() => {
    if (!isPdf || !template) return;
    let cancelled = false;
    setPdfLoading(true);
    setPdfPageDataUrl(null);

    (async () => {
      try {
        const loadingTask = getDocument(previewUrl);
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        const page = await pdf.getPage(currentPage);
        if (cancelled) return;

        const scale = 2;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        await page.render({ canvasContext: ctx, viewport }).promise;
        if (cancelled) return;

        setPdfPageDataUrl(canvas.toDataURL("image/png"));
      } catch (err) {
        console.error("PDF render error:", err);
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isPdf, template, currentPage, previewUrl]);
  const pageCount = template?.pageCount || 1;

  const pageFields = fields.filter((f) => f.page === currentPage);

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    if (dragging || resizing) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-field-box]") || target.closest("[data-field-handle]")) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newField: TemplateField = {
      templateId,
      tag: `field_${fields.length + 1}`,
      label: `Field ${fields.length + 1}`,
      fieldType: "text",
      page: currentPage,
      x: Math.max(0, Math.min(x, 90)),
      y: Math.max(0, Math.min(y, 95)),
      width: 15,
      height: 3,
      fontSize: 12,
      fontColor: "#000000",
      options: null,
      required: false,
      defaultValue: null,
      sortOrder: fields.length,
    };

    setFields([...fields, newField]);
    setSelectedField(fields.length);
  }, [fields, templateId, currentPage, dragging, resizing]);

  const handleMouseDown = useCallback((e: React.MouseEvent, fieldIdx: number, type: "drag" | "resize") => {
    e.stopPropagation();
    e.preventDefault();
    const globalIdx = fields.findIndex((f) => f === pageFields[fieldIdx]);
    const field = fields[globalIdx];
    if (type === "drag") {
      setDragging({ fieldIdx: globalIdx, startX: e.clientX, startY: e.clientY, origX: field.x, origY: field.y });
    } else {
      setResizing({ fieldIdx: globalIdx, startX: e.clientX, startY: e.clientY, origW: field.width, origH: field.height });
    }
    setSelectedField(globalIdx);
  }, [fields, pageFields]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();

      if (dragging) {
        const dx = ((e.clientX - dragging.startX) / rect.width) * 100;
        const dy = ((e.clientY - dragging.startY) / rect.height) * 100;
        setFields((prev) => prev.map((f, i) => i === dragging.fieldIdx ? { ...f, x: Math.max(0, Math.min(dragging.origX + dx, 100 - f.width)), y: Math.max(0, Math.min(dragging.origY + dy, 100 - f.height)) } : f));
      }
      if (resizing) {
        const dw = ((e.clientX - resizing.startX) / rect.width) * 100;
        const dh = ((e.clientY - resizing.startY) / rect.height) * 100;
        setFields((prev) => prev.map((f, i) => i === resizing.fieldIdx ? { ...f, width: Math.max(3, Math.min(resizing.origW + dw, 100 - f.x)), height: Math.max(1.5, Math.min(resizing.origH + dh, 100 - f.y)) } : f));
      }
    };

    const handleMouseUp = () => {
      setDragging(null);
      setResizing(null);
    };

    if (dragging || resizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragging, resizing]);

  const updateField = (idx: number, updates: Partial<TemplateField>) => {
    setFields((prev) => prev.map((f, i) => i === idx ? { ...f, ...updates } : f));
  };

  const deleteField = (idx: number) => {
    setFields((prev) => prev.filter((_, i) => i !== idx));
    setSelectedField(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const toSave = fields.map((f, i) => ({
        templateId: f.templateId,
        tag: f.tag,
        label: f.label,
        fieldType: f.fieldType,
        page: f.page,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        fontSize: f.fontSize,
        fontColor: f.fontColor,
        options: f.options,
        required: f.required,
        defaultValue: f.defaultValue,
        sortOrder: i,
      }));

      await apiRequest("PUT", `/api/document-templates/${templateId}/fields`, { fields: toSave });
      toast({ title: `Saved ${fields.length} field${fields.length !== 1 ? "s" : ""}` });
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates", templateId] });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Save failed";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!template) {
    return <p className="text-muted-foreground">Template not found.</p>;
  }

  const selected = selectedField !== null ? fields[selectedField] : null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center justify-between gap-4 px-4 py-2 border-b bg-background shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-back-templates">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h3 className="text-lg font-semibold">{template.name}</h3>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Click to place fields. Drag to move. Drag corner to resize.
          </span>
        </div>
        <div className="flex items-center gap-2">
          {pageCount > 1 && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={currentPage <= 1} onClick={() => setCurrentPage(currentPage - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs w-16 text-center">{currentPage}/{pageCount}</span>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={currentPage >= pageCount} onClick={() => setCurrentPage(currentPage + 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <span className="text-sm text-muted-foreground">{fields.length} field{fields.length !== 1 ? "s" : ""}</span>
          <Button onClick={handleSave} disabled={saving} size="sm" data-testid="button-save-fields">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Fields
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 overflow-auto p-4">
          <div
            ref={containerRef}
            className="relative border rounded-lg overflow-hidden bg-white cursor-crosshair select-none mx-auto"
            style={{ maxWidth: 900 }}
            onClick={handleContainerClick}
            data-testid="template-canvas"
          >
            {isImage && (
              <img
                src={previewUrl}
                alt={template.name}
                className="w-full h-auto"
                draggable={false}
                onLoad={(e) => {
                  const img = e.target as HTMLImageElement;
                  setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
                }}
              />
            )}
            {isPdf && (
              pdfLoading ? (
                <div className="w-full bg-gray-50 flex items-center justify-center" style={{ minHeight: 800 }}>
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : pdfPageDataUrl ? (
                <img
                  src={pdfPageDataUrl}
                  alt={`Page ${currentPage}`}
                  className="w-full h-auto"
                  draggable={false}
                />
              ) : (
                <div className="w-full bg-gray-50 flex items-center justify-center" style={{ minHeight: 800 }}>
                  <p className="text-muted-foreground text-sm">Failed to render PDF page</p>
                </div>
              )
            )}

            {pageFields.map((field, pageIdx) => {
              const globalIdx = fields.indexOf(field);
              const isSelected = selectedField === globalIdx;

              return (
                <div
                  key={globalIdx}
                  data-field-box
                  className={`absolute cursor-move transition-shadow ${isSelected ? "ring-2 ring-primary shadow-lg z-20" : "ring-1 ring-blue-400/60 z-10"}`}
                  style={{
                    left: `${field.x}%`,
                    top: `${field.y}%`,
                    width: `${field.width}%`,
                    height: `${field.height}%`,
                    backgroundColor: isSelected ? "rgba(59, 130, 246, 0.15)" : "rgba(59, 130, 246, 0.08)",
                  }}
                  onMouseDown={(e) => handleMouseDown(e, pageIdx, "drag")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedField(globalIdx);
                  }}
                  data-testid={`field-box-${globalIdx}`}
                >
                  <span className="absolute top-0 left-0.5 text-[9px] font-medium text-blue-700 leading-tight truncate max-w-full px-0.5">
                    {field.tag}
                  </span>
                  <div
                    data-field-handle
                    className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-primary cursor-se-resize rounded-tl-sm"
                    onMouseDown={(e) => handleMouseDown(e, pageIdx, "resize")}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="w-72 shrink-0 border-l bg-background overflow-auto">
          <div className="p-3">
            <h4 className="text-sm font-semibold mb-3">Field Properties</h4>
            {selected ? (
              <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Tag (identifier)</Label>
                      <Input
                        value={selected.tag}
                        onChange={(e) => updateField(selectedField!, { tag: e.target.value })}
                        className="h-8 text-sm"
                        data-testid="input-field-tag"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Display Label</Label>
                      <Input
                        value={selected.label}
                        onChange={(e) => updateField(selectedField!, { label: e.target.value })}
                        className="h-8 text-sm"
                        data-testid="input-field-label"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Field Type</Label>
                      <Select value={selected.fieldType} onValueChange={(v) => updateField(selectedField!, { fieldType: v })}>
                        <SelectTrigger className="h-8 text-sm" data-testid="select-field-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="date">Date</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="select">Select (Dropdown)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {selected.fieldType === "select" && (
                      <div className="space-y-1">
                        <Label className="text-xs">Options (comma-separated)</Label>
                        <Input
                          value={selected.options || ""}
                          onChange={(e) => updateField(selectedField!, { options: e.target.value })}
                          placeholder="Option 1, Option 2, Option 3"
                          className="h-8 text-sm"
                          data-testid="input-field-options"
                        />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Font Size</Label>
                        <Input
                          type="number"
                          min={6}
                          max={72}
                          value={selected.fontSize}
                          onChange={(e) => updateField(selectedField!, { fontSize: parseInt(e.target.value) || 12 })}
                          className="h-8 text-sm"
                          data-testid="input-field-font-size"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Font Color</Label>
                        <div className="flex items-center gap-1">
                          <input
                            type="color"
                            value={selected.fontColor}
                            onChange={(e) => updateField(selectedField!, { fontColor: e.target.value })}
                            className="w-8 h-8 cursor-pointer border rounded"
                            data-testid="input-field-font-color"
                          />
                          <Input
                            value={selected.fontColor}
                            onChange={(e) => updateField(selectedField!, { fontColor: e.target.value })}
                            className="h-8 text-sm flex-1"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Auto-fill From</Label>
                      <Select value={selected.defaultValue || "none"} onValueChange={(v) => updateField(selectedField!, { defaultValue: v === "none" ? null : v })}>
                        <SelectTrigger className="h-8 text-sm" data-testid="select-field-default">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          {DEFAULT_VALUES.map((dv) => (
                            <SelectItem key={dv.value || "none"} value={dv.value || "none"}>{dv.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Required</Label>
                      <Switch
                        checked={selected.required}
                        onCheckedChange={(v) => updateField(selectedField!, { required: v })}
                        data-testid="switch-field-required"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <p>X: {selected.x.toFixed(1)}%</p>
                      <p>Y: {selected.y.toFixed(1)}%</p>
                      <p>W: {selected.width.toFixed(1)}%</p>
                      <p>H: {selected.height.toFixed(1)}%</p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={() => deleteField(selectedField!)}
                      data-testid="button-delete-field"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Delete Field
                    </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4">
                  Click on a field to edit its properties, or click on the template to place a new field.
                </p>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
