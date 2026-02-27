import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { X, Upload, Loader2, FileText, Paperclip, Send, ExternalLink, MessageSquare, ImageIcon, Download } from "lucide-react";

const ASANA_ASSET_REGEX = /https:\/\/app\.asana\.com\/app\/asana\/-\/get_asset\?asset_id=(\d+)/g;

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];

function isImageFile(name: string): boolean {
  const lower = name.toLowerCase();
  return IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext));
}

function StoryText({ text }: { text: string }) {
  const parts: Array<{ type: 'text' | 'image'; content: string; assetId?: string }> = [];
  let lastIndex = 0;
  const regex = new RegExp(ASANA_ASSET_REGEX.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'image', content: match[0], assetId: match[1] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }

  if (parts.every(p => p.type === 'text')) {
    return <p className="whitespace-pre-wrap text-foreground/80">{text}</p>;
  }

  return (
    <div className="space-y-1">
      {parts.map((part, i) => {
        if (part.type === 'text') {
          const trimmed = part.content.trim();
          if (!trimmed) return null;
          return <p key={i} className="whitespace-pre-wrap text-foreground/80">{part.content}</p>;
        }
        return <AsanaImagePreview key={i} assetId={part.assetId!} />;
      })}
    </div>
  );
}

function AsanaImagePreview({ assetId }: { assetId: string }) {
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const src = `/api/asana/asset/${assetId}`;

  if (failed) {
    return (
      <a href={`https://app.asana.com/app/asana/-/get_asset?asset_id=${assetId}`} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline" data-testid={`link-asset-${assetId}`}>
        <ImageIcon className="h-3 w-3" /> View image in Asana
      </a>
    );
  }

  return (
    <div className="my-1">
      <img src={src} alt="Asana attachment" onError={() => setFailed(true)} onClick={() => setExpanded(!expanded)}
        className={`rounded border cursor-pointer hover:opacity-90 transition-all ${expanded ? 'max-w-full' : 'max-w-[280px] max-h-[180px]'} object-contain`}
        data-testid={`img-asset-${assetId}`} loading="lazy" />
    </div>
  );
}

function AttachmentPreview({ attachment }: { attachment: AsanaAttachment }) {
  const [expanded, setExpanded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const isImage = isImageFile(attachment.name);
  const previewUrl = `/api/asana/asset/${attachment.gid}`;

  if (isImage && !imgFailed) {
    return (
      <div className="rounded-lg border bg-background overflow-hidden" data-testid={`attachment-${attachment.gid}`}>
        <div
          className="cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <img
            src={previewUrl}
            alt={attachment.name}
            onError={() => setImgFailed(true)}
            className={`w-full object-contain bg-muted/30 ${expanded ? 'max-h-[500px]' : 'max-h-[160px]'} transition-all`}
            loading="lazy"
            data-testid={`img-preview-${attachment.gid}`}
          />
        </div>
        <div className="px-3 py-2 flex items-center gap-2 border-t">
          <ImageIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <span className="text-xs font-medium truncate flex-1">{attachment.name}</span>
          <a
            href={attachment.download_url || attachment.view_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
            data-testid={`link-download-${attachment.gid}`}
          >
            <Download className="h-3 w-3" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <a
      href={attachment.view_url || attachment.download_url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors group"
      data-testid={`attachment-${attachment.gid}`}
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-100 dark:bg-red-950 flex items-center justify-center">
        <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-primary group-hover:underline truncate">{attachment.name}</p>
        <p className="text-[10px] text-muted-foreground">
          {attachment.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'File'} · Download
        </p>
      </div>
      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0" />
    </a>
  );
}

function InlineAttachmentPreview({ attachment, authorName, date }: { attachment: NonNullable<AsanaStory['attachment']>; authorName: string; date: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isImage = isImageFile(attachment.name);
  const previewUrl = `/api/asana/asset/${attachment.gid}`;

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1.5">
        {authorName} attached {attachment.name}
      </p>
      {isImage && !imgFailed ? (
        <div className="rounded-lg border overflow-hidden bg-background">
          <div className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
            <img
              src={previewUrl}
              alt={attachment.name}
              onError={() => setImgFailed(true)}
              className={`w-full object-contain bg-muted/20 ${expanded ? 'max-h-[500px]' : 'max-h-[200px]'} transition-all`}
              loading="lazy"
              data-testid={`img-inline-${attachment.gid}`}
            />
          </div>
          <div className="px-3 py-1.5 border-t flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground truncate flex-1">{attachment.name}</span>
            <a
              href={attachment.download_url || attachment.view_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-primary hover:underline flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              Download
            </a>
          </div>
        </div>
      ) : (
        <a
          href={attachment.view_url || attachment.download_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-2.5 rounded-lg border bg-background hover:bg-muted/50 transition-colors group"
          data-testid={`inline-attachment-${attachment.gid}`}
        >
          <div className="flex-shrink-0 w-8 h-8 rounded bg-red-100 dark:bg-red-950 flex items-center justify-center">
            <FileText className="h-4 w-4 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-primary group-hover:underline truncate">{attachment.name}</p>
            <p className="text-[10px] text-muted-foreground">
              {attachment.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'File'} · Click to view
            </p>
          </div>
          <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0" />
        </a>
      )}
    </div>
  );
}

interface AsanaStory {
  gid: string;
  text: string;
  created_at: string;
  created_by?: { name: string };
  resource_subtype?: string;
  attachment?: {
    gid: string;
    name: string;
    view_url?: string;
    download_url?: string;
  };
}

interface AsanaAttachment {
  gid: string;
  name: string;
  view_url?: string;
  download_url?: string;
}

export function SubtaskDetail({ subtaskGid, subtaskName, onClose }: { subtaskGid: string; subtaskName: string; onClose: () => void }) {
  const { toast } = useToast();
  const [commentText, setCommentText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: stories = [], isLoading: storiesLoading, refetch: refetchStories } = useQuery<AsanaStory[]>({
    queryKey: ['/api/subtasks', subtaskGid, 'stories'],
  });

  const { data: attachments = [], isLoading: attachmentsLoading, refetch: refetchAttachments } = useQuery<AsanaAttachment[]>({
    queryKey: ['/api/subtasks', subtaskGid, 'attachments'],
  });

  const commentMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest("POST", `/api/subtasks/${subtaskGid}/comment`, { text });
      return res.json();
    },
    onSuccess: () => {
      setCommentText("");
      refetchStories();
      toast({ title: "Comment posted to Asana" });
    },
    onError: (err: Error) => {
      toast({ title: "Error posting comment", description: err.message, variant: "destructive" });
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/subtasks/${subtaskGid}/attachment`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Failed to upload');
      return res.json();
    },
    onSuccess: () => {
      refetchAttachments();
      refetchStories();
      toast({ title: "File uploaded to Asana" });
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (err: Error) => {
      toast({ title: "Error uploading file", description: err.message, variant: "destructive" });
    }
  });

  return (
    <div className="border rounded-lg bg-card mt-2" data-testid={`subtask-detail-${subtaskGid}`}>
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50">
        <h4 className="text-sm font-medium truncate flex-1">{subtaskName}</h4>
        <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-close-subtask">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
        <div>
          <h5 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
            <Paperclip className="h-3 w-3" /> Attachments ({attachments.length})
          </h5>
          {attachmentsLoading ? (
            <Skeleton className="h-8" />
          ) : attachments.length > 0 ? (
            <div className="grid gap-2">
              {attachments.map((att) => (
                <AttachmentPreview key={att.gid} attachment={att} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No attachments</p>
          )}
          <div className="mt-2">
            <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMutation.mutate(f); }} data-testid="input-upload-file" />
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending} data-testid="button-upload-file">
              {uploadMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
              Upload File
            </Button>
          </div>
        </div>

        <div className="border-t pt-3">
          <h5 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
            <MessageSquare className="h-3 w-3" /> Comments ({stories.length})
          </h5>
          <div className="flex gap-2 mb-3">
            <Textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Leave a note..." className="text-xs min-h-[60px]" data-testid="input-comment" />
            <Button size="sm" className="self-end h-8" onClick={() => { if (commentText.trim()) commentMutation.mutate(commentText.trim()); }}
              disabled={commentMutation.isPending || !commentText.trim()} data-testid="button-send-comment">
              {commentMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            </Button>
          </div>
          {storiesLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
          ) : stories.length > 0 ? (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {stories.filter(s => s.text?.trim() || s.attachment).map((story) => (
                <div key={story.gid} className="p-2.5 rounded-lg bg-muted/30 border text-xs" data-testid={`comment-${story.gid}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-medium">{story.created_by?.name || 'Unknown'}</span>
                    <span className="text-muted-foreground">
                      {story.created_at ? new Date(story.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  {story.attachment ? (
                    <InlineAttachmentPreview
                      attachment={story.attachment}
                      authorName={story.created_by?.name || 'Unknown'}
                      date={story.created_at ? new Date(story.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
                    />
                  ) : (
                    <StoryText text={story.text} />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No comments yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
