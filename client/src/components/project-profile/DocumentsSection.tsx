import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { FILE_CATEGORY_LABELS, type ProjectFile, type Project } from "@shared/schema";
import {
  FolderOpen, Upload, Download, Trash2, ExternalLink, FileText, Image, File,
} from "lucide-react";

interface AsanaCustomField {
  name: string;
  display_value: string | null;
  text_value?: string | null;
}

const TABS = ["uc", "rebates", "contract", "site_visit", "ahj", "install", "payment", "close_off"] as const;

function getSharePointLink(project: Project): string | null {
  const fields = project.asanaCustomFields as AsanaCustomField[] | null;
  if (!fields) return null;
  const spField = fields.find((f) => f.name === "Share Point Link");
  return spField?.text_value || spField?.display_value || null;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return <File className="h-4 w-4 text-muted-foreground" />;
  if (mimeType.startsWith("image/")) return <Image className="h-4 w-4 text-blue-500" />;
  if (mimeType.includes("pdf")) return <FileText className="h-4 w-4 text-red-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

export function DocumentsSection({ project, projectId }: { project: Project; projectId: string }) {
  const [activeTab, setActiveTab] = useState<string>("uc");
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: allFiles = [], isLoading } = useQuery<ProjectFile[]>({
    queryKey: ["/api/projects", projectId, "files"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch(`/api/projects/${projectId}/files`, { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).message || "Upload failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
      toast({ title: "File uploaded" });
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const res = await apiRequest("DELETE", `/api/projects/${projectId}/files/${fileId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
      toast({ title: "File deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const formData = new FormData();
    formData.append("category", activeTab);
    for (let i = 0; i < fileList.length; i++) {
      formData.append("files", fileList[i]);
    }
    uploadMutation.mutate(formData);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const fileCounts: Record<string, number> = {};
  for (const f of allFiles) {
    fileCounts[f.category] = (fileCounts[f.category] || 0) + 1;
  }
  const tabFiles = allFiles.filter((f) => f.category === activeTab);
  const sharePointLink = getSharePointLink(project);

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-muted-foreground" /> Documents
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0" data-testid="badge-total-files">
              {allFiles.length}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {sharePointLink && (
              <a href={sharePointLink} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" data-testid="button-sharepoint">
                  <ExternalLink className="h-3 w-3" /> SharePoint
                </Button>
              </a>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="py-2 px-4 space-y-3">
        <div className="flex flex-wrap gap-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              data-testid={`tab-docs-${tab}`}
            >
              {FILE_CATEGORY_LABELS[tab]}
              {fileCounts[tab] ? (
                <span className="ml-1 text-[10px] opacity-80">({fileCounts[tab]})</span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {FILE_CATEGORY_LABELS[activeTab]} files
          </p>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleUpload}
              data-testid="input-file-upload"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
              data-testid="button-upload-file"
            >
              <Upload className="h-3 w-3" />
              {uploadMutation.isPending ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        ) : tabFiles.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-xs" data-testid="text-no-files">
            No documents in this folder
          </div>
        ) : (
          <div className="space-y-1">
            {tabFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 group"
                data-testid={`file-row-${file.id}`}
              >
                {getFileIcon(file.mimeType)}
                <div className="flex-1 min-w-0">
                  <a
                    href={`/api/projects/${projectId}/files/${file.id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium truncate block hover:underline"
                    data-testid={`link-download-${file.id}`}
                  >
                    {file.fileName}
                  </a>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    {file.fileSize ? <span>{formatFileSize(file.fileSize)}</span> : null}
                    {file.uploadedBy && <span>by {file.uploadedBy}</span>}
                    {file.createdAt && (
                      <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={`/api/projects/${projectId}/files/${file.id}/download`}
                    download={file.fileName}
                  >
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" data-testid={`button-download-${file.id}`}>
                      <Download className="h-3 w-3" />
                    </Button>
                  </a>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(file.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-${file.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
