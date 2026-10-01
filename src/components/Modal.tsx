"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { CloseIcon } from "./icons";

/**
 * A modal or side drawer on the native <dialog>: the browser traps focus,
 * closes on Escape, and returns focus to the control that opened it.
 */
export function Modal({
  open,
  onClose,
  title,
  variant = "modal",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  variant?: "modal" | "drawer";
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={variant}
      aria-label={title}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose(); // click on the backdrop
      }}
    >
      {open && (
        <div className="p-6 sm:p-8">
          <div className="mb-5 flex items-start justify-between gap-4">
            <h2 className="text-[1.75rem] leading-[1.05] font-extrabold tracking-[-0.03em]">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mt-1 -mr-1 grid size-10 shrink-0 place-items-center rounded-full transition-colors hover:bg-cream-deep"
            >
              <CloseIcon className="size-5" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
