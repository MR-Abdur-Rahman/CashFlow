import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function UserAvatar({
  url,
  name,
  size = 40,
  className,
}: {
  url?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();
  return (
    <Avatar style={{ height: size, width: size }} className={cn("border border-border", className)}>
      {url ? <AvatarImage src={url} alt={name ?? "avatar"} /> : null}
      <AvatarFallback className="bg-primary/20 text-primary font-semibold">
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}
