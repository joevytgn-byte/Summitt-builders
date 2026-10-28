"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/modal";
import { useToast } from "@/components/toast";
import { cn } from "@/lib/utils";

type Result = { ok: boolean; error?: string; message?: string; id?: string; redirectTo?: string };

export function ActionForm({
  action, children, className, submitLabel = "Save", submitClassName, resetOnSuccess = false, onDone, footer,
}: {
  action: (fd: FormData) => Promise<Result>;
  children: ReactNode;
  className?: string;
  submitLabel?: string;
  submitClassName?: string;
  resetOnSuccess?: boolean;
  onDone?: (result: Result) => void;
  footer?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        const form = e.currentTarget;
        const fd = new FormData(form);
        startTransition(async () => {
          const res = await action(fd);
          if (!res.ok) {
            setError(res.error ?? "Something went wrong.");
            toast.push({ title: "Could not save", description: res.error, tone: "error" });
            return;
          }
          toast.push({ title: res.message ?? "Saved", tone: "success" });
          if (resetOnSuccess) form.reset();
          onDone?.(res);
          if (res.redirectTo) router.push(res.redirectTo);
          else router.refresh();
        });
      }}
    >
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[11.5px] text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}
      {children}
      {footer !== false && (
        <div className="mt-5 flex justify-end gap-2">
          <button type="submit" disabled={pending} className={cn("btn btn-primary", submitClassName)}>
            {pending && <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
            {pending ? "Saving…" : submitLabel}
          </button>
        </div>
      )}
    </form>
  );
}

export function ActionModal({
  trigger, title, subtitle, size = "md", action, children, submitLabel = "Save", successRedirect, disabled,
}: {
  trigger: ReactNode;
  title: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg";
  action: (fd: FormData) => Promise<Result>;
  children: ReactNode;
  submitLabel?: string;
  successRedirect?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <>
      <span onClick={(e) => { if (disabled) { e.preventDefault(); e.stopPropagation(); } else setOpen(true); }} className={disabled ? "cursor-not-allowed opacity-50" : "contents"}>
        {trigger}
      </span>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        subtitle={subtitle}
        size={size}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" form="action-modal-form" disabled={pending} className="btn btn-primary">
              {pending && <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
              {pending ? "Saving…" : submitLabel}
            </button>
          </>
        }
      >
        <form
          id="action-modal-form"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              const res = await action(fd);
              if (!res.ok) {
                setError(res.error ?? "Something went wrong.");
                return;
              }
              toast.push({ title: res.message ?? "Saved", tone: "success" });
              setOpen(false);
              const target = successRedirect && res.id ? `${successRedirect}/${res.id}` : undefined;
              if (target) router.push(target);
              router.refresh();
            });
          }}
        >
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[11.5px] text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}
          {children}
        </form>
      </Modal>
    </>
  );
}

export function ActionButton({
  action, label, icon, variant = "ghost", size = "sm", confirm, className, onResult,
}: {
  action: () => Promise<Result>;
  label: ReactNode;
  icon?: ReactNode;
  variant?: "primary" | "outline" | "ghost" | "dark" | "soft" | "danger";
  size?: "sm" | "md";
  confirm?: string;
  className?: string;
  onResult?: (res: Result) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className={cn(`btn btn-${variant}`, size === "sm" && "btn-sm", className)}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        startTransition(async () => {
          const res = await action();
          if (!res.ok) {
            toast.push({ title: "Action failed", description: res.error, tone: "error" });
            return;
          }
          toast.push({ title: res.message ?? "Done", tone: "success" });
          onResult?.(res);
          router.refresh();
        });
      }}
    >
      {pending ? <span className="size-3 animate-spin rounded-full border-2 border-current/25 border-t-current" /> : icon}
      {label}
    </button>
  );
}

export function StatusSelect({
  value, options, action, label, width = 148,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  action: (next: string) => Promise<Result>;
  label?: string;
  width?: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState(value);

  return (
    <select
      aria-label={label ?? "Change status"}
      className="select input-sm"
      style={{ width }}
      value={current}
      disabled={pending}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const next = e.target.value;
        setCurrent(next);
        startTransition(async () => {
          const res = await action(next);
          if (!res.ok) {
            toast.push({ title: "Update failed", description: res.error, tone: "error" });
            setCurrent(value);
            return;
          }
          toast.push({ title: res.message ?? "Status updated", tone: "success" });
          router.refresh();
        });
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function InlineNoteForm({
  action, hidden, placeholder = "Add a note…", submitLabel = "Add note",
}: {
  action: (fd: FormData) => Promise<Result>;
  hidden: Record<string, string>;
  placeholder?: string;
  submitLabel?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState("");

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData();
        for (const [k, v] of Object.entries(hidden)) fd.set(k, v);
        fd.set("note", value);
        startTransition(async () => {
          const res = await action(fd);
          if (!res.ok) {
            toast.push({ title: "Could not add note", description: res.error, tone: "error" });
            return;
          }
          setValue("");
          toast.push({ title: res.message ?? "Note added", tone: "success" });
          router.refresh();
        });
      }}
    >
      <textarea
        className="textarea" rows={2} value={value} placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="flex justify-end">
        <button type="submit" disabled={pending || !value.trim()} className="btn btn-outline btn-sm">
          {pending && <span className="size-3 animate-spin rounded-full border-2 border-current/25 border-t-current" />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
