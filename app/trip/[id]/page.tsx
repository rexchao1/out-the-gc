import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabase, type RsvpRow, type TripRow } from "../../../lib/supabase";
import { CopyLinkButton } from "./copy-link-button";
import { RsvpSection } from "./rsvp-section";

export const dynamic = "force-dynamic";

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data, error } = await getSupabase()
    .from("trips")
    .select("*")
    .eq("id", id)
    .single<TripRow>();

  if (error || !data) {
    notFound();
  }

  const rsvpsResult = await getSupabase()
    .from("rsvps")
    .select("*")
    .eq("trip_id", id)
    .order("created_at", { ascending: true });

  const initialRsvps: RsvpRow[] = (rsvpsResult.data ?? []) as RsvpRow[];

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-14">
      <section className="w-full rounded-3xl border border-black/5 bg-white/85 p-8 shadow-sm backdrop-blur sm:p-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-700">
            Back to Home
          </Link>
          <CopyLinkButton tripId={data.id} />
        </div>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{data.trip_name}</h1>
        <p className="mt-2 text-slate-600">Your trip has been created! Shareable link coming soon.</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Field label="Destination" value={data.destination} />
          <Field label="Organizer" value={data.organizer_name} />
          <Field label="Trip Start" value={formatDate(data.start_date)} />
          <Field label="Trip End" value={formatDate(data.end_date)} />
          <Field label="Cost Per Person" value={formatCurrency(data.cost_per_person)} />
          <Field label="RSVP Deadline" value={formatDateTime(data.rsvp_deadline)} />
          <Field label="Trip ID" value={data.id} fullWidth />
          <Field label="Created At" value={formatDateTime(data.created_at)} fullWidth />
        </div>

        <RsvpSection tripId={data.id} rsvpDeadline={data.rsvp_deadline} initialRsvps={initialRsvps} />
      </section>
    </main>
  );
}

function Field({ label, value, fullWidth = false }: { label: string; value: string; fullWidth?: boolean }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${fullWidth ? "sm:col-span-2" : ""}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-900">{value}</p>
    </div>
  );
}

function formatDate(raw: string) {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString();
}

function formatDateTime(raw: string) {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString();
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value);
}
