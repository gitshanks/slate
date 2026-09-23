"use client";

import * as React from "react";
import { Check, Copy, Link2, LogOut, UserMinus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createSharedListInvite, leaveList, removeSharedListMember } from "@/lib/shared-list-actions";
import type { SharedListPerson } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ShareListButtonProps {
  listId: string;
  listName: string;
  owner: SharedListPerson | null;
  members: SharedListPerson[];
  isOwner: boolean;
  iconOnly?: boolean;
  className?: string;
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function PersonAvatar({ person }: { person: SharedListPerson }) {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-1 ring-border">
      {person.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : initials(person.displayName)}
    </span>
  );
}

export function ShareListButton({ listId, listName, owner, members, isOwner, iconOnly = false, className }: ShareListButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [inviteUrl, setInviteUrl] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const people = owner ? [owner, ...members] : members;

  function copyInvite() {
    startTransition(async () => {
      try {
        const invite = await createSharedListInvite(listId);
        const url = `${window.location.origin}/join/${invite.token}`;
        setInviteUrl(url);
        await navigator.clipboard.writeText(url);
        setCopied(true);
        toast.success("Invite link copied");
        window.setTimeout(() => setCopied(false), 1800);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn’t create an invite");
      }
    });
  }

  function removeMember(person: SharedListPerson) {
    startTransition(async () => {
      try {
        await removeSharedListMember(listId, person.id);
        toast.success(`${person.displayName} removed`);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn’t update access");
      }
    });
  }

  function leave() {
    startTransition(async () => {
      try {
        await leaveList(listId);
      } catch (error) {
        if (error && typeof error === "object" && "digest" in error && String((error as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw error;
        toast.error(error instanceof Error ? error.message : "Couldn’t leave the list");
      }
    });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`People with access to ${listName}`}
          onClick={(event) => { event.preventDefault(); event.stopPropagation(); }}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background/85 text-muted-foreground backdrop-blur-sm transition-colors hover:border-primary/40 hover:text-primary",
            iconOnly ? "h-8 w-8" : "h-9 px-3 text-xs font-medium",
            className,
          )}
        >
          <Users className="h-3.5 w-3.5" />
          {!iconOnly ? <span>{people.length > 1 ? `${people.length} people` : "Share list"}</span> : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[340px] max-w-[calc(100vw-2rem)] p-0" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-semibold">People with access</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Everyone here can add, remove, and arrange titles.</p>
        </div>
        <div className="max-h-64 space-y-1 overflow-y-auto p-2">
          {owner ? (
            <div className="flex items-center gap-3 rounded-lg px-2 py-2">
              <PersonAvatar person={owner} />
              <span className="min-w-0 flex-1 truncate text-sm">{owner.displayName}</span>
              <span className="text-[11px] text-muted-foreground">Owner</span>
            </div>
          ) : null}
          {members.map((member) => (
            <div key={member.id} className="group/member flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/50">
              <PersonAvatar person={member} />
              <span className="min-w-0 flex-1 truncate text-sm">{member.displayName}</span>
              {isOwner ? (
                <button type="button" disabled={pending} onClick={() => removeMember(member)} className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground opacity-70 hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 sm:opacity-0 sm:group-hover/member:opacity-100 sm:focus-visible:opacity-100" aria-label={`Remove ${member.displayName}`}>
                  <UserMinus className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
        <div className="border-t border-border p-3">
          {isOwner ? (
            <div className="space-y-2">
              <button type="button" disabled={pending} onClick={copyInvite} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-[filter,transform] hover:brightness-105 active:scale-[0.99] disabled:opacity-50">
                {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                {pending ? "Creating link…" : copied ? "Copied" : "Copy invite link"}
              </button>
              {inviteUrl ? (
                <button type="button" className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-[11px] text-muted-foreground hover:text-foreground" onClick={() => navigator.clipboard.writeText(inviteUrl)}>
                  <Copy className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{inviteUrl}</span>
                </button>
              ) : <p className="text-center text-[11px] text-muted-foreground">Invite links expire after 30 days.</p>}
            </div>
          ) : (
            <button type="button" disabled={pending} onClick={leave} className="flex h-9 w-full items-center justify-center gap-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50">
              <LogOut className="h-3.5 w-3.5" />
              Leave list
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
