import type { SharedListPerson } from "@/lib/types";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export function ListPeople({ people, className }: { people: SharedListPerson[]; className?: string }) {
  const shown = people.slice(0, 3);
  if (shown.length < 2) return null;
  return (
    <div className={cn("flex items-center", className)} aria-label={`Shared by ${people.map((person) => person.displayName).join(", ")}`}>
      {shown.map((person, index) => (
        <span key={person.id} className={cn("relative grid h-7 w-7 place-items-center overflow-hidden rounded-full border-2 border-card bg-muted text-[9px] font-semibold text-muted-foreground", index > 0 && "-ml-2")} title={person.displayName}>
          {person.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : initials(person.displayName)}
        </span>
      ))}
      {people.length > shown.length ? (
        <span className="-ml-2 grid h-7 min-w-7 place-items-center rounded-full border-2 border-card bg-muted px-1.5 text-[9px] font-semibold text-muted-foreground">+{people.length - shown.length}</span>
      ) : null}
    </div>
  );
}
