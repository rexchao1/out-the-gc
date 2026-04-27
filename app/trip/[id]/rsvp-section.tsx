"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabase, type RsvpRow } from "../../../lib/supabase";

type Props = {
  tripId: string;
  rsvpDeadline: string;
  initialRsvps: RsvpRow[];
};

export function RsvpSection({ tripId, rsvpDeadline, initialRsvps }: Props) {
  const [name, setName] = useState("");
  const [rsvps, setRsvps] = useState<RsvpRow[]>(initialRsvps);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState<"in" | "out" | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const refreshRsvps = useCallback(async () => {
    let supabase;
    try {
      supabase = getSupabase();
    } catch {
      return;
    }
    const { data, error: fetchError } = await supabase
      .from("rsvps")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true });
    if (!fetchError && data) {
      setRsvps(data as RsvpRow[]);
    }
  }, [tripId]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const deadlineMs = useMemo(() => new Date(rsvpDeadline).getTime(), [rsvpDeadline]);
  const countdown = useMemo(() => formatCountdown(deadlineMs, nowMs), [deadlineMs, nowMs]);

  const { inNames, outNames } = useMemo(() => splitLatestByName(rsvps), [rsvps]);

  async function submit(response: "in" | "out") {
    setError("");
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter your name.");
      return;
    }

    let supabase;
    try {
      supabase = getSupabase();
    } catch {
      setError("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then redeploy.");
      return;
    }

    setSubmitting(response);
    const { error: insertError } = await supabase.from("rsvps").insert({
      trip_id: tripId,
      name: trimmed,
      response,
    });
    setSubmitting(null);

    if (insertError) {
      const parts = [insertError.message, insertError.details, insertError.hint].filter(Boolean);
      setError(parts.join(" — ") || "Could not save RSVP.");
      return;
    }

    setName("");
    await refreshRsvps();
  }

  return (
    <div className="mt-10 border-t border-slate-200 pt-10">
      <h2 className="text-xl font-semibold tracking-tight text-slate-900">RSVP</h2>
      <p className="mt-1 text-sm text-slate-600">Let the group know if you are joining.</p>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
        <span className="font-medium text-slate-700">Time until RSVP deadline: </span>
        {countdown}
      </div>

      <div className="mt-6 space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Your name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jordan Lee"
            required
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-100"
          />
        </label>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={submitting !== null}
            onClick={() => void submit("in")}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {submitting === "in" ? "Saving…" : "I'm In ✅"}
          </button>
          <button
            type="button"
            disabled={submitting !== null}
            onClick={() => void submit("out")}
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {submitting === "out" ? "Saving…" : "I'm Out ❌"}
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
          <h3 className="text-sm font-semibold text-emerald-900">Who&apos;s in</h3>
          <ul className="mt-3 space-y-2 text-sm text-emerald-950">
            {inNames.length === 0 ? (
              <li className="text-emerald-800/80">No one yet.</li>
            ) : (
              inNames.map((n) => (
                <li key={n} className="rounded-lg bg-white/70 px-3 py-2">
                  {n}
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Who&apos;s out</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-800">
            {outNames.length === 0 ? (
              <li className="text-slate-500">No declines yet.</li>
            ) : (
              outNames.map((n) => (
                <li key={n} className="rounded-lg bg-slate-50 px-3 py-2">
                  {n}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function formatCountdown(deadlineMs: number, nowMs: number) {
  if (Number.isNaN(deadlineMs)) {
    return "Unknown deadline.";
  }
  const diff = deadlineMs - nowMs;
  if (diff <= 0) {
    return "Deadline passed.";
  }
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [
    days > 0 ? `${days}d` : null,
    `${hours}h`,
    `${minutes}m`,
    `${seconds}s`,
  ].filter(Boolean);
  return parts.join(" ");
}

/** Latest RSVP per person (case-insensitive name), by `created_at`. */
function splitLatestByName(rows: RsvpRow[]) {
  const sorted = [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const latest = new Map<string, RsvpRow>();
  for (const row of sorted) {
    latest.set(row.name.trim().toLowerCase(), row);
  }
  const inNames: string[] = [];
  const outNames: string[] = [];
  for (const row of latest.values()) {
    if (row.response === "in") inNames.push(row.name.trim());
    else outNames.push(row.name.trim());
  }
  inNames.sort((a, b) => a.localeCompare(b));
  outNames.sort((a, b) => a.localeCompare(b));
  return { inNames, outNames };
}
