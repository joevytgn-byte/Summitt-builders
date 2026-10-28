"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Modal({
  open, onClose, title, subtitle, children, footer, size = "md", closeOnOverlay = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  closeOnOverlay?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (closeOnOverlay && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-panel" data-size={size} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div>
            <div className="modal-title">{title}</div>
            {subtitle && <div className="modal-sub">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} className="icon-btn -mr-1 -mt-1" aria-label="Close dialog">
            <X size={17} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function SubmitButton({ pending, children, className, onClick }: { pending?: boolean; children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <button type="submit" disabled={pending} className={cn("btn btn-primary", className)} onClick={onClick}>
      {pending ? <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : null}
      {pending ? "Saving…" : children}
    </button>
  );
}

export function ConfirmSubmit({ children, message, className }: { children: ReactNode; message: string; className?: string }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
