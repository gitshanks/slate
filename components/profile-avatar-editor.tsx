"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
    <div className="shrink-0">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label={currentAvatar ? "Change profile photo" : "Add profile photo"}
        title={currentAvatar ? "Change profile photo" : "Add profile photo"}
        className="relative h-[5.25rem] w-[5.25rem] overflow-hidden rounded-[1.55rem] border border-border/80 bg-background text-muted-foreground outline-none transition-[border-color,opacity,transform] hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card active:scale-[0.98] disabled:pointer-events-none sm:h-24 sm:w-24 sm:rounded-[1.75rem]"
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
            <UserRound className="h-8 w-8" />
          </span>
        )}
        {uploading ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white">
            <LoaderCircle className="loading-spinner h-6 w-6" />
          </span>
        ) : null}
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
    </div>
  );
}
