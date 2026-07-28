"use client";

// A submit button that shows a spinner and disables itself while its form's
// server action is running — instant feedback + double-submit protection.
// Use inside any <form action={...}>: <SubmitButton>Save</SubmitButton>.
import { useFormStatus } from "react-dom";
import type { ComponentProps } from "react";

export default function SubmitButton({
  children,
  pendingText,
  className = "",
  ...props
}: ComponentProps<"button"> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      {...props}
      disabled={pending || props.disabled}
      aria-busy={pending}
      className={`inline-flex items-center justify-center gap-1.5 ${pending ? "cursor-wait opacity-70" : ""} ${className}`}
    >
      {pending && (
        <svg className="h-3.5 w-3.5 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {pending ? pendingText ?? children : children}
    </button>
  );
}
