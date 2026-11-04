import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { createCandidate } from "../api/candidates";
import { ApiError, errorMessage } from "../api/http";
import { BackLink } from "../components/BackLink";
import { splitServerErrors, type FormErrors } from "../lib/formErrors";

// Field names match the API's JSON keys, so server errors map straight onto them.
const fields = ["name", "email", "role", "phone", "source", "resumeText"] as const;
type Field = (typeof fields)[number];

const labels: Record<Field, string> = {
  name: "Full name",
  email: "Email",
  role: "Role applied for",
  phone: "Phone",
  source: "Source",
  resumeText: "Resume or cover letter",
};

const sources = ["Referral", "LinkedIn", "Careers page", "Job board", "Agency", "Other"];

const noErrors: FormErrors<Field> = { fields: {}, general: [] };

export function AddCandidatePage() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors<Field>>(noErrors);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Stop the browser's own form submit (a full page reload); we send JSON instead.
    // A second submit while saving is impossible: the button is disabled, and
    // browsers do not submit on Enter when the submit button is disabled.
    event.preventDefault();

    // Uncontrolled inputs: the browser keeps what was typed; we read it once, on submit.
    const form = new FormData(event.currentTarget);
    const value = (field: Field) => String(form.get(field) ?? "");

    setSaving(true);
    setErrors(noErrors);
    try {
      const created = await createCandidate({
        name: value("name"),
        email: value("email"),
        role: value("role"),
        resumeText: value("resumeText"),
        phone: value("phone"),
        source: value("source"),
      });
      navigate(`/candidates/${created.id}`);
    } catch (err) {
      // 400 = the server rejected the input: show each problem under its field.
      // Anything else (server down, 500) is one general message.
      setErrors(
        err instanceof ApiError && err.status === 400
          ? splitServerErrors(err.message, fields)
          : { fields: {}, general: [errorMessage(err)] },
      );
      setSaving(false);
    }
  }

  // Props that connect an input to its label, hint and error for screen readers.
  function inputProps(field: Field, hintId?: string) {
    const error = errors.fields[field];
    const describedBy = [hintId, error ? `${field}-error` : undefined].filter(Boolean).join(" ");
    return {
      id: field,
      name: field,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": describedBy || undefined,
    };
  }

  const hasFieldErrors = Object.keys(errors.fields).length > 0;

  return (
    <main className="page page--narrow">
      <BackLink to="/">Candidates</BackLink>
      <h1 className="page-title">Add candidate</h1>
      <p className="page-subtitle">New candidates start in the Applied stage.</p>

      {(hasFieldErrors || errors.general.length > 0) && (
        <div className="alert alert--error" role="alert">
          {hasFieldErrors && <p>Please fix the fields marked below.</p>}
          {errors.general.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}

      <form className="card form-card" onSubmit={handleSubmit}>
        <div className="form-row">
          <FormField field="name" required error={errors.fields.name}>
            <input type="text" required maxLength={200} placeholder="e.g. Mara Okafor" {...inputProps("name")} />
          </FormField>
          <FormField field="email" required error={errors.fields.email}>
            <input type="email" required maxLength={100} placeholder="name@example.com" {...inputProps("email")} />
          </FormField>
        </div>

        <div className="form-row">
          <FormField field="role" required error={errors.fields.role}>
            <input type="text" required maxLength={200} placeholder="e.g. Frontend Engineer" {...inputProps("role")} />
          </FormField>
          <FormField field="phone" error={errors.fields.phone}>
            {/* 30 is the server's overall cap; its 15-digit rule is reported by the server. */}
            <input type="tel" maxLength={30} placeholder="0400 000 000" {...inputProps("phone")} />
          </FormField>
        </div>

        <FormField field="source" error={errors.fields.source}>
          <select defaultValue="" {...inputProps("source")}>
            <option value="">Select a source</option>
            {sources.map((source) => (
              <option key={source}>{source}</option>
            ))}
          </select>
        </FormField>

        <FormField
          field="resumeText"
          required
          error={errors.fields.resumeText}
          hint={<span id="resumeText-hint">The AI summary is generated from this text.</span>}
        >
          <textarea
            rows={10}
            required
            maxLength={100_000}
            placeholder="Paste the resume or cover letter as plain text"
            {...inputProps("resumeText", "resumeText-hint")}
          />
        </FormField>

        <div className="form-actions">
          <button type="submit" className="button button--primary" disabled={saving}>
            {saving ? "Saving…" : "Save candidate"}
          </button>
          <Link to="/" className="button button--secondary">
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}

type FormFieldProps = {
  field: Field;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
};

// Label above the input, a "Required"/"Optional" tag, then optional hint and error text.
// The tag is hidden from screen readers: the input's `required` attribute already says it.
function FormField({ field, required = false, error, hint, children }: FormFieldProps) {
  return (
    <div className="form-field">
      <label htmlFor={field}>
        {labels[field]}{" "}
        <span className="form-field__tag" aria-hidden="true">
          {required ? "Required" : "Optional"}
        </span>
      </label>
      {children}
      {hint && <p className="form-field__hint">{hint}</p>}
      {error && (
        <p className="form-field__error" id={`${field}-error`}>
          {labels[field]} {error}
        </p>
      )}
    </div>
  );
}
