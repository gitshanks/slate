"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { Camera, LoaderCircle, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { captureAnalytics } from "@/lib/analytics";

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
  round = false,
}: {
  avatarUrl: string | null;
  displayName: string;
  /** A circle ringed in the page colour, as the profile header shows it. */
  round?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [currentAvatar, setCurrentAvatar] = useState(avatarUrl);
  const [uploading, setUploading] = useState(false);

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
    setUploading(true);

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
      captureAnalytics("profile_avatar_updated", {
        source_type: prepared.type,
        source_size_bucket:
          prepared.size < 100_000
            ? "under_100kb"
            : prepared.size < 300_000
              ? "100-300kb"
              : "300kb+",
      });
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
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="group/avatar relative shrink-0">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label={currentAvatar ? "Change profile photo" : "Add profile photo"}
        title={currentAvatar ? "Change profile photo" : "Add profile photo"}
        className={cn(
          "relative block h-[5.5rem] w-[5.5rem] overflow-hidden bg-card text-muted-foreground outline-none transition-[box-shadow,transform] duration-150 ease-[var(--ease-ui-out)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.97] disabled:pointer-events-none",
          round
            ? "rounded-full border-4 border-background"
            : "rounded-[1.6rem] ring-1 ring-foreground/10 hover:ring-foreground/25 sm:h-28 sm:w-28 sm:rounded-[2rem]",
        )}
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
            {displayName.trim() ? (
              <span className="text-[2.25rem] font-semibold leading-none tracking-[-0.04em] text-foreground/80 sm:text-[2.75rem]">
                {displayName.trim().slice(0, 1).toLocaleUpperCase()}
              </span>
            ) : (
              <UserRound className="h-8 w-8" />
            )}
          </span>
        )}
        {uploading ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white">
            <LoaderCircle className="loading-spinner h-6 w-6" />
          </span>
        ) : null}
      </button>
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-foreground text-background ring-4 ring-background transition-transform duration-150 ease-[var(--ease-ui-out)] group-hover/avatar:scale-105"
      >
        <Camera className="h-3.5 w-3.5" strokeWidth={2.25} />
      </span>

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
    </div>
  );
}
