import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send, Loader2, Paperclip, FileText, ExternalLink, Upload, ImageIcon, Activity, Zap } from "lucide-react";

const ASANA_ASSET_REGEX = /https:\/\/app\.asana\.com\/app\/asana\/-\/get_asset\?asset_id=(\d+)/g;

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
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline" data-testid={`link-main-asset-${assetId}`}>
        <ImageIcon className="h-3 w-3" /> View image in Asana
      </a>
    );
  }

  return (
    <div className="my-1">
      <img src={src} alt="Asana attachment" onError={() => setFailed(true)} onClick={() => setExpanded(!expanded)}
        className={`rounded border cursor-pointer hover:opacity-90 transition-all ${expanded ? 'max-w-full' : 'max-w-[280px] max-h-[180px]'} object-contain`}
        data-testid={`img-main-asset-${assetId}`} loading="lazy" />
    </div>
  );
}

interface AsanaStory {
  gid: string;
  text: string;
  created_at: string;
  created_by?: { name: string };
  resource_subtype?: string;
  type?: string;
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

function isComment(s: AsanaStory): boolean {
  return s.resource_subtype === 'comment_added' || s.type === 'comment' || s.resource_subtype === 'attachment_added';
}

function isSystemEvent(s: AsanaStory): boolean {
  return !isComment(s);
}

function StoryCard({ story }: { story: AsanaStory }) {
  const isSystem = isSystemEvent(story);

  return (
    <div
      className={`p-3 rounded-lg border text-sm ${isSystem ? 'bg-muted/20 border-muted' : 'bg-muted/30'}`}
      data-testid={`main-comment-${story.gid}`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          {isSystem && <Zap className="h-3 w-3 text-amber-500 flex-shrink-0" />}
          <span className={`font-medium text-xs ${isSystem ? 'text-muted-foreground' : ''}`}>
            {story.created_by?.name || 'Unknown'}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {story.created_at ? new Date(story.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
        </span>
      </div>
      {story.attachment ? (
        <a
          href={story.attachment.view_url || story.attachment.download_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 p-2.5 rounded-md bg-background border hover:bg-muted/50 transition-colors group"
          data-testid={`main-inline-attachment-${story.attachment.gid}`}
        >
          <div className="flex-shrink-0 w-9 h-9 rounded bg-red-100 dark:bg-red-950 flex items-center justify-center">
            <FileText className="h-4 w-4 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-primary group-hover:underline truncate">{story.attachment.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {story.attachment.name.toLowerCase().endsWith('.pdf') ? 'PDF' :
               story.attachment.name.toLowerCase().match(/\.(png|jpg|jpeg|gif|webp)$/) ? 'Image' : 'File'}
              {' · Click to view'}
            </p>
          </div>
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0" />
        </a>
      ) : (
        <StoryText text={story.text} />
      )}
    </div>
  );
}

export function MainTimeline({ projectId, asanaGid }: { projectId: string; asanaGid: string | null }) {
  const { toast } = useToast();
  const [commentText, setCommentText] = useState("");
  const [activeTab, setActiveTab] = useState<'comments' | 'all'>('comments');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: stories = [], isLoading: storiesLoading, refetch: refetchStories } = useQuery<AsanaStory[]>({
    queryKey: ['/api/projects', projectId, 'stories'],
    enabled: !!asanaGid,
  });

  const { data: attachments = [], isLoading: attachmentsLoading, refetch: refetchAttachments } = useQuery<AsanaAttachment[]>({
    queryKey: ['/api/subtasks', asanaGid, 'attachments'],
    enabled: !!asanaGid,
  });

  const commentMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest("POST", `/api/asana/tasks/${asanaGid}/comment`, { text });
      return res.json();
    },
    onSuccess: () => {
      setCommentText("");
      refetchStories();
      toast({ title: "Comment posted to Asana timeline" });
    },
    onError: (err: Error) => {
      toast({ title: "Error posting comment", description: err.message, variant: "destructive" });
    }
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/subtasks/${asanaGid}/attachment`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Failed to upload');
      return res.json();
    },
    onSuccess: () => {
      refetchAttachments();
      refetchStories();
      toast({ title: "File uploaded to Asana timeline" });
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (err: Error) => {
      toast({ title: "Error uploading file", description: err.message, variant: "destructive" });
    }
  });

  if (!asanaGid) {
    return null;
  }

  const visibleStories = stories.filter(s => s.text?.trim() || s.attachment);
  const filtered = activeTab === 'comments'
    ? visibleStories.filter(s => isComment(s))
    : visibleStories;

  const sorted = [...filtered].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const commentCount = visibleStories.filter(s => isComment(s)).length;
  const allCount = visibleStories.length;

  return (
    <Card data-testid="main-timeline-card">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          Project Main Timeline
          <span className="text-xs text-muted-foreground font-normal ml-1">(Asana Parent Task)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2 px-4 space-y-4">
        <div className="flex gap-2">
          <Textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment to the project timeline..."
            className="text-sm min-h-[60px]"
            data-testid="input-main-timeline-comment"
          />
          <div className="flex flex-col gap-1 self-end">
            <Button
              size="sm"
              className="h-8"
              onClick={() => { if (commentText.trim()) commentMutation.mutate(commentText.trim()); }}
              disabled={commentMutation.isPending || !commentText.trim()}
              data-testid="button-main-timeline-send"
            >
              {commentMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            </Button>
            <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMutation.mutate(f); }} data-testid="input-main-timeline-upload" />
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
              data-testid="button-main-timeline-upload"
            >
              {uploadMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            </Button>
          </div>
        </div>

        {attachmentsLoading ? (
          <Skeleton className="h-8" />
        ) : attachments.length > 0 && (
          <div>
            <h5 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Paperclip className="h-3 w-3" /> Attachments ({attachments.length})
            </h5>
            <div className="space-y-1">
              {attachments.map((att) => (
                <a key={att.gid} href={att.view_url || att.download_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs p-2 rounded hover:bg-muted transition-colors group" data-testid={`main-attachment-${att.gid}`}>
                  <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 truncate text-primary group-hover:underline">{att.name}</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="border-t pt-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-0 border rounded-md overflow-hidden">
              <button
                onClick={() => setActiveTab('comments')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'comments'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                }`}
                data-testid="tab-comments"
              >
                <MessageSquare className="h-3 w-3" />
                Comments ({commentCount})
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                }`}
                data-testid="tab-all-activity"
              >
                <Activity className="h-3 w-3" />
                All activity ({allCount})
              </button>
            </div>
          </div>

          {storiesLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
          ) : sorted.length > 0 ? (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {sorted.map((story) => (
                <StoryCard key={story.gid} story={story} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              {activeTab === 'comments' ? 'No comments on the project timeline yet' : 'No activity on the project timeline yet'}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
