import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface StaffMember {
  id: string;
  name: string;
  role: string | null;
  active: boolean;
}

interface StaffSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  required?: boolean;
  id?: string;
  testId?: string;
  placeholder?: string;
}

export function StaffSelect({
  value,
  onValueChange,
  label = "Your Name",
  required = true,
  id,
  testId = "select-staff-name",
  placeholder = "Select your name",
}: StaffSelectProps) {
  const { data: staff = [] } = useQuery<StaffMember[]>({
    queryKey: ["/api/staff"],
  });

  const activeStaff = staff.filter((s) => s.active);

  return (
    <div>
      {label && (
        <Label htmlFor={id}>
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
      )}
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} data-testid={testId} className="mt-1">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {activeStaff.map((member) => (
            <SelectItem key={member.id} value={member.name} data-testid={`option-staff-${member.id}`}>
              {member.name}{member.role ? ` (${member.role})` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
