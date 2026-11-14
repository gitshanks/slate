"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";

/**
 * Mount this while something that is not itself a Radix layer (the title
 * card) sits on top of an open Radix dialog.
 *
 * A modal dialog traps focus and owns Escape. This renders an invisible,
 * non-modal layer above it: as the newest layer it receives Escape first, and
 * its presence pauses the trap underneath, so focus can live in the card
 * while the dialog stays open and untouched behind it.
 */
export function LayerAboveDialog({
  label,
  onDismiss,
}: {
  label: string;
  onDismiss: () => void;
}) {
  return (
    <DialogPrimitive.Root
      open
      modal={false}
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          role="presentation"
          aria-hidden
          aria-describedby={undefined}
          tabIndex={-1}
          className="sr-only"
          // The card manages its own focus; this layer only steps aside.
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          // Everything the person touches is outside this empty layer.
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogPrimitive.Title>{label}</DialogPrimitive.Title>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
