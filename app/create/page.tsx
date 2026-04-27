"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabase } from "../../lib/supabase";

type CreateTripForm = {
  tripName: string;
  destination: string;
  startDate: string;
  endDate: string;
  costPerPerson: string;
  rsvpDeadline: string;
  organizerName: string;
};

const initialForm: CreateTripForm = {
  tripName: "",
  destination: "",
  startDate: "",
  endDate: "",
  costPerPerson: "",
  rsvpDeadline: "",
  organizerName: "",
};

export default function CreateTripPage() {
  const router = useRouter();
  const [form, setForm] = useState<CreateTripForm>(initialForm);
  const [error, setError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function onChange<K extends keyof CreateTripForm>(key: K, value: CreateTripForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate() {
    if (new Date(form.endDate) < new Date(form.startDate)) {
      return "End date must be on or after start date.";
    }

    const rsvp = new Date(form.rsvpDeadline);
    const start = new Date(form.startDate);
    if (rsvp > start) {
      return "RSVP deadline must be before the trip start date.";
    }

    const cost = Number(form.costPerPerson);
    if (!Number.isFinite(cost) || cost <= 0) {
      return "Estimated cost per person must be greater than 0.";
    }

    return "";
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const validationMessage = validate();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    const payload = {
      tripName: form.tripName.trim(),
      destination: form.destination.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      estimatedCostPerPerson: Number(form.costPerPerson),
      rsvpDeadline: form.rsvpDeadline,
      organizerName: form.organizerName.trim(),
    };
    console.log("create-trip-form", payload);

    setIsSubmitting(true);
    const { data, error: insertError } = await getSupabase()
      .from("trips")
      .insert({
        trip_name: payload.tripName,
        destination: payload.destination,
        start_date: payload.startDate,
        end_date: payload.endDate,
        cost_per_person: payload.estimatedCostPerPerson,
        rsvp_deadline: payload.rsvpDeadline,
        organizer_name: payload.organizerName,
      })
      .select("id")
      .single();
    setIsSubmitting(false);

    if (insertError) {
      setError(insertError.message || "Could not save trip. Please try again.");
      return;
    }

    if (!data?.id) {
      setError("Trip saved but no id was returned.");
      return;
    }

    router.push(`/trip/${data.id}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-14">
      <section className="w-full rounded-3xl border border-black/5 bg-white/85 p-8 shadow-sm backdrop-blur sm:p-10">
        <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-700">
          Back to Home
        </Link>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Create a Trip</h1>
        <p className="mt-2 text-slate-600">Fill out the details below to start your group plan.</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <Field label="Trip name">
            <input
              required
              type="text"
              value={form.tripName}
              onChange={(e) => onChange("tripName", e.target.value)}
              placeholder="Miami Summer Trip"
              className={inputClass}
            />
          </Field>

          <Field label="Destination">
            <input
              required
              type="text"
              value={form.destination}
              onChange={(e) => onChange("destination", e.target.value)}
              placeholder="Miami, FL"
              className={inputClass}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Trip start date">
              <input
                required
                type="date"
                value={form.startDate}
                onChange={(e) => onChange("startDate", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Trip end date">
              <input
                required
                type="date"
                value={form.endDate}
                onChange={(e) => onChange("endDate", e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Estimated cost per person (USD)">
            <input
              required
              type="number"
              min="1"
              step="0.01"
              value={form.costPerPerson}
              onChange={(e) => onChange("costPerPerson", e.target.value)}
              placeholder="1200"
              className={inputClass}
            />
          </Field>

          <Field label="RSVP deadline">
            <input
              required
              type="datetime-local"
              value={form.rsvpDeadline}
              onChange={(e) => onChange("rsvpDeadline", e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Organizer name">
            <input
              required
              type="text"
              value={form.organizerName}
              onChange={(e) => onChange("organizerName", e.target.value)}
              placeholder="Alex Johnson"
              className={inputClass}
            />
          </Field>

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          ) : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--accent)] px-5 py-3 text-base font-semibold text-[var(--accent-foreground)] transition hover:opacity-90"
          >
            {isSubmitting ? "Creating..." : "Create Trip"}
          </button>
        </form>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-100";
