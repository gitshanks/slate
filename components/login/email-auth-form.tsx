"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, Mail } from "lucide-react";
import {
  requestEmailLoginCode,
  verifyEmailLoginCode,
  type RequestEmailCodeState,
  type VerifyEmailCodeState,
} from "@/lib/email-auth-actions";

const REQUEST_INITIAL: RequestEmailCodeState = { step: "email" };
const VERIFY_INITIAL: VerifyEmailCodeState = {};

export function EmailAuthForm({
  creating,
  redirectTo,
}: {
  creating: boolean;
  redirectTo: string;
}) {
  const [requestState, requestAction] = useActionState(
    requestEmailLoginCode,
    REQUEST_INITIAL,
  );
  const [verifyState, verifyAction] = useActionState(
    verifyEmailLoginCode,
    VERIFY_INITIAL,
  );
  const resetParams = new URLSearchParams();
  if (creating) resetParams.set("mode", "create");
  if (redirectTo !== "/app") resetParams.set("next", redirectTo);
  const resetHref = `/login${resetParams.size ? `?${resetParams}` : ""}`;

  if (requestState.step === "code" && requestState.email) {
    return (
      <div className="mt-8">
        <p className="text-center text-sm leading-6 text-white/65">
          Enter the code sent to <span className="font-medium text-white/90">{requestState.maskedEmail}</span>
        </p>
        <form action={verifyAction} className="mt-5 space-y-3">
          <input type="hidden" name="email" value={requestState.email} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <label className="sr-only" htmlFor="email-code">Six-digit code</label>
          <input
            id="email-code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
            placeholder="000000"
            className="h-[58px] w-full rounded-2xl border border-white/10 bg-[#121214]/90 px-5 text-center font-mono text-xl tracking-[0.34em] text-white outline-none transition-[border-color,box-shadow] placeholder:text-white/20 focus:border-[#ADEBB3]/60 focus:shadow-[0_0_0_4px_rgba(173,235,179,0.1)]"
          />
          {verifyState.error ? <InlineError message={verifyState.error} /> : null}
          <SubmitButton
            idleLabel={creating ? "Create my slate" : "Sign in"}
            pendingLabel="Checking code"
          />
        </form>
        <a
          href={resetHref}
          className="mt-4 block text-center text-xs font-medium text-white/55 transition-colors hover:text-white/90"
        >
          Use a different email
        </a>
      </div>
    );
  }

  return (
    <form action={requestAction} className="mt-8 space-y-3">
      <label className="sr-only" htmlFor="email">Email address</label>
      <div className="relative">
        <Mail className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" aria-hidden />
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          autoFocus
          placeholder="you@example.com"
          className="h-[58px] w-full rounded-2xl border border-white/10 bg-[#121214]/90 pl-12 pr-5 text-sm text-white outline-none transition-[border-color,box-shadow] placeholder:text-white/30 focus:border-[#ADEBB3]/60 focus:shadow-[0_0_0_4px_rgba(173,235,179,0.1)]"
        />
      </div>
      {requestState.error ? <InlineError message={requestState.error} /> : null}
      <SubmitButton idleLabel="Continue with email" pendingLabel="Sending code" />
    </form>
  );
}

function SubmitButton({ idleLabel, pendingLabel }: { idleLabel: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="group flex h-[58px] w-full items-center justify-center gap-3 rounded-2xl bg-[#ADEBB3] px-6 text-sm font-semibold text-[#0b0d0b] shadow-[0_18px_55px_rgba(60,120,68,0.22)] transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 active:scale-[0.985] disabled:cursor-wait disabled:transform-none disabled:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ADEBB3] focus-visible:ring-offset-4 focus-visible:ring-offset-black"
    >
      {pending ? (
        <>
          <span className="flex items-center gap-1" aria-hidden>
            <span className="loading-dot h-1.5 w-1.5 rounded-full bg-[#0b0d0b] [animation-delay:-180ms]" />
            <span className="loading-dot h-1.5 w-1.5 rounded-full bg-[#0b0d0b] [animation-delay:-90ms]" />
            <span className="loading-dot h-1.5 w-1.5 rounded-full bg-[#0b0d0b]" />
          </span>
          {pendingLabel}
        </>
      ) : (
        <>
          {idleLabel}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
        </>
      )}
    </button>
  );
}

function InlineError({ message }: { message: string }) {
  return <p role="alert" className="rounded-xl border border-red-300/15 bg-red-500/10 px-3 py-2.5 text-xs leading-5 text-red-100/90">{message}</p>;
}
