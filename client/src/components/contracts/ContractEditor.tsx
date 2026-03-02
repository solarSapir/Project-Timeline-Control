import { useState, useCallback, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Underline } from "@tiptap/extension-underline";
import { TextAlign } from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Image as TiptapImage } from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extension-placeholder";
import { mergeAttributes } from "@tiptap/core";

const ResizableImage = TiptapImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: null, renderHTML: (attrs) => attrs.width ? { width: attrs.width } : {} },
      height: { default: null, renderHTML: (attrs) => attrs.height ? { height: attrs.height } : {} },
      style: { default: null, renderHTML: (attrs) => attrs.style ? { style: attrs.style } : {} },
      "data-align": {
        default: null,
        renderHTML: (attrs) => {
          const align = attrs["data-align"];
          if (!align) return {};
          return { "data-align": align };
        },
      },
    };
  },
  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
  },
});
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Heading1, Heading2, Heading3,
  Table as TableIcon, Redo, Undo,
  ArrowLeft, Save, Loader2, Upload,
  Minus, ImageIcon,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const MERGE_FIELDS = [
  { group: "Client Information", fields: [
    { value: "{{client_name}}", label: "Client Name" },
    { value: "{{project_address}}", label: "Project Address" },
    { value: "{{client_phone}}", label: "Client Phone" },
    { value: "{{client_email}}", label: "Client Email" },
  ]},
  { group: "Project Details", fields: [
    { value: "{{project_name}}", label: "Project Name" },
    { value: "{{province}}", label: "Province" },
    { value: "{{install_type}}", label: "Install Type" },
    { value: "{{contractor_name}}", label: "Contractor" },
    { value: "{{project_description}}", label: "Project Description" },
    { value: "{{due_date}}", label: "Due Date" },
  ]},
  { group: "Pricing", fields: [
    { value: "{{subtotal}}", label: "Subtotal (before tax)" },
    { value: "{{hst_rate}}", label: "HST Rate" },
    { value: "{{hst_amount}}", label: "HST Amount" },
    { value: "{{total_price}}", label: "Total Price (incl. tax)" },
  ]},
  { group: "Payment", fields: [
    { value: "{{payment_method}}", label: "Payment Method" },
    { value: "{{helcim_link}}", label: "Helcim Invoice Link" },
  ]},
  { group: "Dates & Signatures", fields: [
    { value: "{{date}}", label: "Today's Date" },
    { value: "{{rep_name}}", label: "Representative Name" },
    { value: "{{signature}}", label: "Representative Signature" },
    { value: "{{client_initials}}", label: "Client Initials" },
  ]},
];

interface Props {
  templateId: string;
  initialContent?: string;
  templateName: string;
  onClose: () => void;
}

export function ContractEditor({ templateId, initialContent, templateName, onClose }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [customFieldOpen, setCustomFieldOpen] = useState(false);
  const [customFieldName, setCustomFieldName] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      TextStyle,
      Color,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      ResizableImage.configure({ inline: false, allowBase64: true }),
      Placeholder.configure({
        placeholder: "Start typing your contract here, or import a Word document...",
      }),
    ],
    content: initialContent || "",
    editorProps: {
      attributes: {
        class: "contract-editor-content prose prose-sm max-w-none focus:outline-none min-h-[600px] p-8",
      },
    },
  });

  const handleSave = useCallback(async () => {
    if (!editor) return;
    setSaving(true);
    try {
      const html = editor.getHTML();
      await apiRequest("PATCH", `/api/document-templates/${templateId}`, {
        htmlContent: html,
      });
      toast({ title: "Contract template saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates", templateId] });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Save failed";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [editor, templateId, toast]);

  const handleImportDocx = useCallback(async (file: File) => {
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/document-templates/${templateId}/import-docx`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Import failed");
      }
      const { html } = await res.json();
      if (editor && html) {
        editor.commands.setContent(html);
        toast({ title: "Document imported successfully" });
      }
      setImportDialogOpen(false);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Import failed";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }, [editor, templateId, toast]);

  const insertMergeField = useCallback((value: string) => {
    if (!editor) return;
    if (value === "__custom__") {
      setCustomFieldOpen(true);
      return;
    }
    editor.chain().focus().insertContent(
      `<span class="merge-field" data-merge-field="${value}">${value}</span>&nbsp;`
    ).run();
  }, [editor]);

  const handleCustomFieldInsert = useCallback(() => {
    if (!editor || !customFieldName.trim()) return;
    const sanitized = customFieldName.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (!sanitized) return;
    const fieldValue = `{{${sanitized}}}`;
    editor.chain().focus().insertContent(
      `<span class="merge-field" data-merge-field="${fieldValue}">${fieldValue}</span>&nbsp;`
    ).run();
    setCustomFieldName("");
    setCustomFieldOpen(false);
  }, [editor, customFieldName]);

  const insertTable = useCallback(() => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center justify-between gap-4 px-4 py-2 border-b bg-background shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-back-from-editor">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h3 className="text-lg font-semibold">{templateName}</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)} data-testid="button-import-docx">
            <Upload className="h-4 w-4 mr-1" />
            Import .docx
          </Button>
          <Button onClick={handleSave} disabled={saving} size="sm" data-testid="button-save-contract">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1 px-4 py-1.5 border-b bg-muted/30 flex-wrap shrink-0">
        <Button
          variant="ghost" size="sm" className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          data-testid="button-undo"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost" size="sm" className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          data-testid="button-redo"
        >
          <Redo className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <Button
          variant={editor.isActive("bold") ? "secondary" : "ghost"} size="sm" className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().toggleBold().run()}
          data-testid="button-bold"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant={editor.isActive("italic") ? "secondary" : "ghost"} size="sm" className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          data-testid="button-italic"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant={editor.isActive("underline") ? "secondary" : "ghost"} size="sm" className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          data-testid="button-underline"
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>
        <Button
          variant={editor.isActive("strike") ? "secondary" : "ghost"} size="sm" className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          data-testid="button-strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <Button
          variant={editor.isActive("heading", { level: 1 }) ? "secondary" : "ghost"} size="sm" className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          data-testid="button-h1"
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          variant={editor.isActive("heading", { level: 2 }) ? "secondary" : "ghost"} size="sm" className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          data-testid="button-h2"
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          variant={editor.isActive("heading", { level: 3 }) ? "secondary" : "ghost"} size="sm" className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          data-testid="button-h3"
        >
          <Heading3 className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <Button
          variant={editor.isActive({ textAlign: "left" }) ? "secondary" : "ghost"} size="sm" className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          data-testid="button-align-left"
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          variant={editor.isActive({ textAlign: "center" }) ? "secondary" : "ghost"} size="sm" className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          data-testid="button-align-center"
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          variant={editor.isActive({ textAlign: "right" }) ? "secondary" : "ghost"} size="sm" className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          data-testid="button-align-right"
        >
          <AlignRight className="h-4 w-4" />
        </Button>
        <Button
          variant={editor.isActive({ textAlign: "justify" }) ? "secondary" : "ghost"} size="sm" className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          data-testid="button-align-justify"
        >
          <AlignJustify className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <Button
          variant={editor.isActive("bulletList") ? "secondary" : "ghost"} size="sm" className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          data-testid="button-bullet-list"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant={editor.isActive("orderedList") ? "secondary" : "ghost"} size="sm" className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          data-testid="button-ordered-list"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={insertTable} data-testid="button-insert-table">
          <TableIcon className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost" size="sm" className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          data-testid="button-hr"
        >
          <Minus className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <div className="flex items-center gap-1">
          <input
            type="color"
            className="w-7 h-7 cursor-pointer border rounded"
            value={editor.getAttributes("textStyle").color || "#000000"}
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            data-testid="input-text-color"
          />
        </div>

        {editor.isActive("image") && (
          <>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <div className="flex items-center gap-1">
              <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <Button
                variant={editor.getAttributes("image")["data-align"] !== "center" && editor.getAttributes("image")["data-align"] !== "right" ? "secondary" : "ghost"}
                size="sm" className="h-7 w-7 p-0"
                onClick={() => editor.chain().focus().updateAttributes("image", { "data-align": null }).run()}
                data-testid="button-img-align-left"
              >
                <AlignLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={editor.getAttributes("image")["data-align"] === "center" ? "secondary" : "ghost"}
                size="sm" className="h-7 w-7 p-0"
                onClick={() => editor.chain().focus().updateAttributes("image", { "data-align": "center" }).run()}
                data-testid="button-img-align-center"
              >
                <AlignCenter className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={editor.getAttributes("image")["data-align"] === "right" ? "secondary" : "ghost"}
                size="sm" className="h-7 w-7 p-0"
                onClick={() => editor.chain().focus().updateAttributes("image", { "data-align": "right" }).run()}
                data-testid="button-img-align-right"
              >
                <AlignRight className="h-3.5 w-3.5" />
              </Button>
              <Separator orientation="vertical" className="h-5 mx-0.5" />
              {[40, 60, 80, 120, 200].map((size) => (
                <Button
                  key={size}
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1.5 text-xs"
                  onClick={() => {
                    editor.chain().focus().updateAttributes("image", {
                      width: `${size}px`,
                      style: `max-height: ${size}px; width: auto;`,
                    }).run();
                  }}
                  data-testid={`button-img-size-${size}`}
                >
                  {size}px
                </Button>
              ))}
              <Input
                type="number"
                className="h-7 w-16 text-xs"
                placeholder="px"
                min={20}
                max={800}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = parseInt((e.target as HTMLInputElement).value);
                    if (val >= 20 && val <= 800) {
                      editor.chain().focus().updateAttributes("image", {
                        width: `${val}px`,
                        style: `max-height: ${val}px; width: auto;`,
                      }).run();
                    }
                  }
                }}
                data-testid="input-img-custom-size"
              />
            </div>
          </>
        )}

        <Separator orientation="vertical" className="h-6 mx-1" />

        <Select onValueChange={insertMergeField} value="">
          <SelectTrigger className="h-8 w-[180px] text-xs" data-testid="select-merge-field">
            <SelectValue placeholder="Insert merge field..." />
          </SelectTrigger>
          <SelectContent className="max-h-[320px]">
            {MERGE_FIELDS.map((group) => (
              <SelectGroup key={group.group}>
                <SelectLabel className="text-xs font-semibold text-muted-foreground">{group.group}</SelectLabel>
                {group.fields.map((mf) => (
                  <SelectItem key={mf.value} value={mf.value}>{mf.label}</SelectItem>
                ))}
              </SelectGroup>
            ))}
            <SelectGroup>
              <SelectItem value="__custom__" className="border-t mt-1 pt-1 font-medium text-primary">
                + Custom Field...
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900">
        <div className="max-w-[850px] mx-auto my-8 bg-white dark:bg-gray-800 shadow-lg rounded-sm min-h-[1100px] border">
          <EditorContent editor={editor} data-testid="contract-editor-content" />
        </div>
      </div>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Document</DialogTitle>
            <DialogDescription>
              Upload a Word document (.docx) to import its content into the editor. The formatting will be preserved as closely as possible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select File</Label>
              <Input
                type="file"
                accept=".docx,.doc"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImportDocx(file);
                }}
                disabled={importing}
                data-testid="input-import-file"
              />
              <p className="text-xs text-muted-foreground">Supported: .docx (Microsoft Word)</p>
            </div>
            {importing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Converting document...
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={customFieldOpen} onOpenChange={(open) => { setCustomFieldOpen(open); if (!open) setCustomFieldName(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Custom Merge Field</DialogTitle>
            <DialogDescription>
              Enter a name for your custom field. It will be inserted as a placeholder that can be filled in when generating the contract.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Field Name</Label>
              <Input
                value={customFieldName}
                onChange={(e) => setCustomFieldName(e.target.value)}
                placeholder="e.g. system_size, panel_count, warranty_years"
                onKeyDown={(e) => { if (e.key === "Enter") handleCustomFieldInsert(); }}
                data-testid="input-custom-field-name"
                autoFocus
              />
              {customFieldName.trim() && (
                <p className="text-xs text-muted-foreground">
                  Will insert: <span className="font-mono text-primary">{`{{${customFieldName.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")}}}`}</span>
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCustomFieldOpen(false); setCustomFieldName(""); }}>Cancel</Button>
            <Button onClick={handleCustomFieldInsert} disabled={!customFieldName.trim()} data-testid="button-insert-custom-field">Insert Field</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
