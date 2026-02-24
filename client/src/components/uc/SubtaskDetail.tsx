import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { X, Upload, Loader2, FileText, Paperclip, Send, ExternalLink, MessageSquare } from "lucide-react";

interface AsanaStory {
  gid: string;
  text: string;
  created_at: string;
  created_by?: { name: string };
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
            <div className="space-y-1">
              {attachments.map((att) => (
                <a key={att.gid} href={att.view_url || att.download_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs p-2 rounded hover:bg-muted transition-colors group" data-testid={`attachment-${att.gid}`}>
                  <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 truncate text-primary group-hover:underline">{att.name}</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                </a>
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
              {stories.map((story) => (
                <div key={story.gid} className="p-2 rounded bg-muted/30 border text-xs" data-testid={`comment-${story.gid}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{story.created_by?.name || 'Unknown'}</span>
                    <span className="text-muted-foreground">
                      {story.created_at ? new Date(story.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-foreground/80">{story.text}</p>
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
