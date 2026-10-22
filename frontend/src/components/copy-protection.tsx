"use client";

import { useEffect } from "react";

function isCopyAllowed(target: EventTarget | null | undefined) {
  const element =
    target instanceof Element
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;

  return Boolean(
    element?.closest(
      'input, textarea, select, [contenteditable="true"], [data-copy-allowed], td, th, pre, code',
    ),
  );
}

export function CopyProtection() {
  useEffect(() => {
    function blockContextMenu(event: MouseEvent) {
      const target = event.target;
      const isImage = target instanceof Element && Boolean(target.closest("img"));
      if (isImage || !isCopyAllowed(target)) event.preventDefault();
    }

    function blockImageDrag(event: DragEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest("img")) event.preventDefault();
    }

    function blockUnapprovedCopy(event: ClipboardEvent) {
      if (!isCopyAllowed(document.getSelection()?.anchorNode)) event.preventDefault();
    }

    document.addEventListener("contextmenu", blockContextMenu);
    document.addEventListener("dragstart", blockImageDrag, true);
    document.addEventListener("copy", blockUnapprovedCopy);

    return () => {
      document.removeEventListener("contextmenu", blockContextMenu);
      document.removeEventListener("dragstart", blockImageDrag, true);
      document.removeEventListener("copy", blockUnapprovedCopy);
    };
  }, []);

  return null;
}
