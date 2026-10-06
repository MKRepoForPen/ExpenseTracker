"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      <h2 className="text-lg font-semibold text-slate-900">Something went wrong</h2>
      <p className="mt-2 text-sm text-slate-500">{error.message || "An unexpected error occurred."}</p>
      <button onClick={reset} className="btn-primary mt-6">
        Try again
      </button>
    </div>
  );
}
