import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, UserCheck, UserX } from "lucide-react";

interface StaffMember {
  id: string;
  name: string;
  role: string | null;
  active: boolean;
  createdAt: string;
}

export function StaffManager() {
  const { toast } = useToast();
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");

  const { data: staff = [], isLoading } = useQuery<StaffMember[]>({
    queryKey: ["/api/staff"],
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/staff", { name: newName, role: newRole || null });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      setNewName("");
      setNewRole("");
      toast({ title: "Staff member added" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add", description: err.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const res = await apiRequest("PATCH", `/api/staff/${id}`, { active });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/staff/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      toast({ title: "Staff member removed" });
    },
  });

  const handleAdd = () => {
    if (!newName.trim()) return;
    addMutation.mutate();
  };

  return (
    <div className="space-y-4" data-testid="section-staff-manager">
      <p className="text-sm text-muted-foreground">
        Manage team members who use the app. Active members appear in staff dropdowns across all views.
      </p>

      <div className="flex gap-2">
        <Input
          placeholder="Name (e.g. Kay)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="max-w-[200px]"
          data-testid="input-staff-name"
        />
        <Input
          placeholder="Role (optional)"
          value={newRole}
          onChange={(e) => setNewRole(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="max-w-[200px]"
          data-testid="input-staff-role"
        />
        <Button
          onClick={handleAdd}
          disabled={!newName.trim() || addMutation.isPending}
          size="sm"
          data-testid="button-add-staff"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : staff.length === 0 ? (
        <p className="text-sm text-muted-foreground">No staff members yet. Add your team above.</p>
      ) : (
        <div className="border rounded-md divide-y">
          {staff.map((member) => (
            <div
              key={member.id}
              className={`flex items-center gap-3 px-4 py-2.5 ${!member.active ? "opacity-50" : ""}`}
              data-testid={`staff-row-${member.id}`}
            >
              <span className="font-medium text-sm flex-1" data-testid={`text-staff-name-${member.id}`}>
                {member.name}
              </span>
              {member.role && (
                <span className="text-xs text-muted-foreground">{member.role}</span>
              )}
              <Badge
                variant={member.active ? "default" : "secondary"}
                className="text-[10px] cursor-pointer"
                onClick={() => toggleMutation.mutate({ id: member.id, active: !member.active })}
                data-testid={`badge-staff-status-${member.id}`}
              >
                {member.active ? (
                  <><UserCheck className="h-3 w-3 mr-1" />Active</>
                ) : (
                  <><UserX className="h-3 w-3 mr-1" />Inactive</>
                )}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => deleteMutation.mutate(member.id)}
                data-testid={`button-delete-staff-${member.id}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
