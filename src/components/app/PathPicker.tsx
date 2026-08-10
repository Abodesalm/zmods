import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { pick } from "@/lib/pickers";

export function PathPicker({
  id,
  value,
  onChange,
  placeholder,
  title,
  invalid,
}: {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  title: string;
  invalid?: boolean;
}) {
  const browse = async () => {
    const picked = await pick.folder(title, value || undefined);
    if (picked) onChange(picked);
  };

  return (
    <div className="flex gap-2">
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        className={invalid ? "border-danger focus:border-danger focus:ring-danger/25" : undefined}
      />
      <Button type="button" variant="secondary" onClick={browse} className="shrink-0">
        <FolderOpen />
        Browse
      </Button>
    </div>
  );
}
