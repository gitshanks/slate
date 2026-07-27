"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, LoaderCircle, Trash2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 650 * 1024;
const AVATAR_SIZE = 512;

type DecodedImage = ImageBitmap | HTMLImageElement;

function imageDimensions(image: DecodedImage) {
  if (image instanceof HTMLImageElement) {
    return { width: image.naturalWidth, height: image.naturalHeight };
  }
  return { width: image.width, height: image.height };
}

function canvasBlob(
  canvas: HTMLCanvasElement,
  type: "image/webp" | "image/jpeg",
  quality: number
) {
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, quality)
  );
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to the broadly supported object-URL path.
    }
  }

  const source = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Image could not be decoded."));
      image.src = source;
    });
  } finally {
    URL.revokeObjectURL(source);
  }
}

async function prepareAvatar(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("Choose an image smaller than 10 MB.");
  }

  const image = await decodeImage(file);
  const { width, height } = imageDimensions(image);
  const crop = Math.min(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot process that image.");

  context.fillStyle = "#111113";
  context.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  context.drawImage(
    image,
    (width - crop) / 2,
    (height - crop) / 2,
    crop,
    crop,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE
  );

  if ("close" in image && typeof image.close === "function") image.close();

  let blob = await canvasBlob(canvas, "image/webp", 0.86);
  if (!blob || blob.type !== "image/webp") {
    blob = await canvasBlob(canvas, "image/jpeg", 0.86);
  }
  if (blob && blob.size > MAX_UPLOAD_BYTES) {
    blob = await canvasBlob(
      canvas,
      blob.type === "image/webp" ? "image/webp" : "image/jpeg",
      0.68
    );
  }
  if (!blob || blob.size > MAX_UPLOAD_BYTES) {
    throw new Error("We couldn't make that image small enough to upload.");
  }

  const extension = blob.type === "image/webp" ? "webp" : "jpg";
  return new File([blob], `avatar.${extension}`, { type: blob.type });
}

async function responseMessage(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as {
      error?: string;
      avatarUrl?: string | null;
    };
    return { message: data.error || fallback, avatarUrl: data.avatarUrl };
  } catch {
    return { message: fallback, avatarUrl: undefined };
  }
}

export function ProfileAvatarEditor({
  avatarUrl,
  displayName,
}: {
  avatarUrl: string | null;
  displayName: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [currentAvatar, setCurrentAvatar] = useState(avatarUrl);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    []
  );

  function replaceObjectUrl(next: string | null) {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = next?.startsWith("blob:") ? next : null;
    setCurrentAvatar(next);
  }

  async function upload(file: File) {
    const previousAvatar = currentAvatar;
    setBusy("upload");

    try {
      const prepared = await prepareAvatar(file);
      replaceObjectUrl(URL.createObjectURL(prepared));

      const body = new FormData();
      body.set("avatar", prepared);
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body,
      });
      const result = await responseMessage(
        response,
        "We couldn't save that profile photo."
      );
      if (!response.ok || !result.avatarUrl) throw new Error(result.message);

      replaceObjectUrl(result.avatarUrl);
      toast.success("Profile photo updated.");
      router.refresh();
    } catch (error) {
      replaceObjectUrl(previousAvatar);
      toast.error(
        error instanceof Error
          ? error.message
          : "We couldn't save that profile photo."
      );
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    const previousAvatar = currentAvatar;
    setBusy("remove");
    try {
      const response = await fetch("/api/profile/avatar", { method: "DELETE" });
      const result = await responseMessage(
        response,
        "We couldn't remove that profile photo."
      );
      if (!response.ok) throw new Error(result.message);

      replaceObjectUrl(null);
      toast.success("Profile photo removed.");
      router.refresh();
    } catch (error) {
      replaceObjectUrl(previousAvatar);
      toast.error(
        error instanceof Error
          ? error.message
          : "We couldn't remove that profile photo."
      );
    } finally {
      setBusy(null);
    }
  }

  const uploading = busy === "upload";
  const removing = busy === "remove";

  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy !== null}
        aria-label={currentAvatar ? "Change profile photo" : "Add profile photo"}
        className="group relative h-14 w-14 overflow-hidden rounded-2xl border border-border bg-background text-muted-foreground outline-none transition-[border-color,transform] hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card active:scale-[0.97] disabled:pointer-events-none sm:h-16 sm:w-16"
      >
        {currentAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentAvatar}
            alt={`${displayName} profile photo`}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            <UserRound className="h-6 w-6" />
          </span>
        )}
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition-[background-color,opacity] group-hover:bg-black/45 group-hover:opacity-100 group-focus-visible:bg-black/45 group-focus-visible:opacity-100",
            uploading && "bg-black/55 opacity-100"
          )}
        >
          {uploading ? (
            <LoaderCircle className="h-5 w-5 animate-spin" />
          ) : (
            <Camera className="h-5 w-5" />
          )}
        </span>
        {!uploading && (
          <span className="absolute -right-px -bottom-px flex h-5 w-5 items-center justify-center rounded-tl-lg bg-foreground text-background group-hover:opacity-0 group-focus-visible:opacity-0">
            <Camera className="h-3 w-3" />
          </span>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />

      {currentAvatar && (
        <button
          type="button"
          onClick={() => void remove()}
          disabled={busy !== null}
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        >
          {removing ? (
            <LoaderCircle className="h-2.5 w-2.5 animate-spin" />
          ) : (
            <Trash2 className="h-2.5 w-2.5" />
          )}
          Remove
        </button>
      )}
    </div>
  );
}
