"use client";

import { useState } from "react";
import { CATEGORIES, CATEGORY_STYLES, type Category, type ExpenseInput } from "@/lib/types";
import { todayISO } from "@/lib/format";

interface ExpenseFormProps {
  initial?: ExpenseInput;
  submitLabel: string;
  onSubmit: (input: ExpenseInput) => void | Promise<void>;
  onCancel: () => void;
}

type FieldErrors = Partial<Record<keyof ExpenseInput, string>>;

const MAX_AMOUNT = 1_000_000;
const MAX_DESCRIPTION = 120;

function validate(values: { date: string; amount: string; category: string; description: string }): FieldErrors {
  const errors: FieldErrors = {};

  if (!values.date) errors.date = "Please choose a date.";
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date)) errors.date = "Enter a valid date.";
  else if (values.date > todayISO()) errors.date = "Date can't be in the future.";
  else if (values.date < "1900-01-01") errors.date = "Date is too far in the past.";

  const trimmedAmount = values.amount.trim();
  const amount = Number(trimmedAmount);
  if (!trimmedAmount) errors.amount = "Amount is required.";
  else if (!Number.isFinite(amount)) errors.amount = "Enter a valid number.";
  else if (amount <= 0) errors.amount = "Amount must be greater than zero.";
  else if (amount > MAX_AMOUNT) errors.amount = "Amount is unrealistically large.";
  else if (!/^\d+(\.\d{1,2})?$/.test(trimmedAmount)) errors.amount = "Use at most 2 decimal places.";

  if (!(CATEGORIES as readonly string[]).includes(values.category)) errors.category = "Pick a category.";

  const desc = values.description.trim();
  if (!desc) errors.description = "Add a short description.";
  else if (desc.length > MAX_DESCRIPTION) errors.description = `Keep it under ${MAX_DESCRIPTION} characters.`;

  return errors;
}

export function ExpenseForm({ initial, submitLabel, onSubmit, onCancel }: ExpenseFormProps) {
  const [values, setValues] = useState({
    date: initial?.date ?? todayISO(),
    amount: initial ? initial.amount.toFixed(2) : "",
    category: initial?.category ?? ("" as Category | ""),
    description: initial?.description ?? "",
  });
  const [touched, setTouched] = useState<Partial<Record<keyof ExpenseInput, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);

  const errors = validate(values);
  const showError = (field: keyof ExpenseInput) => (touched[field] ? errors[field] : undefined);

  const set = (field: keyof typeof values) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setValues((v) => ({ ...v, [field]: e.target.value }));

  const blur = (field: keyof ExpenseInput) => () => setTouched((t) => ({ ...t, [field]: true }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ date: true, amount: true, category: true, description: true });
    if (Object.keys(errors).length > 0) {
      const firstInvalid = (["amount", "description", "category", "date"] as const).find((f) => errors[f]);
      if (firstInvalid) document.getElementById(`expense-${firstInvalid}`)?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        date: values.date,
        amount: Math.round(Number(values.amount) * 100) / 100,
        category: values.category as Category,
        description: values.description.trim(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <Field label="Amount" error={showError("amount")} htmlFor="expense-amount">
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">$</span>
          <input
            id="expense-amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            autoComplete="off"
            value={values.amount}
            onChange={set("amount")}
            onBlur={blur("amount")}
            aria-invalid={!!showError("amount")}
            className={inputClass(!!showError("amount"), "pl-7 text-lg font-semibold tabular-nums")}
          />
        </div>
      </Field>

      <Field label="Description" error={showError("description")} htmlFor="expense-description">
        <input
          id="expense-description"
          type="text"
          placeholder="e.g. Weekly groceries"
          maxLength={MAX_DESCRIPTION + 20}
          value={values.description}
          onChange={set("description")}
          onBlur={blur("description")}
          aria-invalid={!!showError("description")}
          className={inputClass(!!showError("description"))}
        />
      </Field>

      <Field label="Category" error={showError("category")} htmlFor="expense-category">
        <div id="expense-category" role="radiogroup" tabIndex={-1} className="grid grid-cols-3 gap-2 outline-none">
          {CATEGORIES.map((c) => {
            const selected = values.category === c;
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setValues((v) => ({ ...v, category: c }));
                  setTouched((t) => ({ ...t, category: true }));
                }}
                className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-medium transition ${
                  selected
                    ? "border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-500"
                    : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="text-lg" aria-hidden>
                  {CATEGORY_STYLES[c].icon}
                </span>
                {c}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Date" error={showError("date")} htmlFor="expense-date">
        <input
          id="expense-date"
          type="date"
          max={todayISO()}
          value={values.date}
          onChange={set("date")}
          onBlur={blur("date")}
          aria-invalid={!!showError("date")}
          className={inputClass(!!showError("date"))}
        />
      </Field>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting && <Spinner />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-1.5 text-sm text-rose-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function inputClass(invalid: boolean, extra = "") {
  return `input ${invalid ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20" : ""} ${extra}`;
}

export function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
