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
import { Image as ImageExt } from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Heading1, Heading2, Heading3,
  Table as TableIcon, Redo, Undo,
  ArrowLeft, Save, Loader2, Upload,
  Minus,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const MERGE_FIELDS = [
  { value: "{{customer_name}}", label: "Customer Name" },
  { value: "{{project_name}}", label: "Project Name" },
  { value: "{{address}}", label: "Address" },
  { value: "{{province}}", label: "Province" },
  { value: "{{install_type}}", label: "Install Type" },
  { value: "{{payment_method}}", label: "Payment Method" },
  { value: "{{contractor_name}}", label: "Contractor" },
  { value: "{{due_date}}", label: "Due Date" },
  { value: "{{date}}", label: "Today's Date" },
  { value: "{{signature}}", label: "Signature Field" },
  { value: "{{signer_name}}", label: "Signer Name" },
  { value: "{{signer_date}}", label: "Signing Date" },
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
      ImageExt.configure({ inline: false, allowBase64: true }),
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
    editor.chain().focus().insertContent(
      `<span class="merge-field" data-merge-field="${value}">${value}</span>&nbsp;`
    ).run();
  }, [editor]);

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

        <Separator orientation="vertical" className="h-6 mx-1" />

        <Select onValueChange={insertMergeField}>
          <SelectTrigger className="h-8 w-[180px] text-xs" data-testid="select-merge-field">
            <SelectValue placeholder="Insert merge field..." />
          </SelectTrigger>
          <SelectContent>
            {MERGE_FIELDS.map((mf) => (
              <SelectItem key={mf.value} value={mf.value}>{mf.label}</SelectItem>
            ))}
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
    </div>
  );
}
