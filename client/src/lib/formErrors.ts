// The server reports every problem in one message, joined by "; ", e.g.
//   "name: is required; email: must be a valid email address"
// (built by validate() in server/src/routes/http.ts from Zod's issues).
// This splits it so each problem can be shown under its own field.

export type FormErrors<Field extends string> = {
  fields: Partial<Record<Field, string>>;
  // Problems that do not belong to a known field (e.g. "body: ...").
  general: string[];
};

export function splitServerErrors<Field extends string>(message: string, fields: readonly Field[]): FormErrors<Field> {
  const result: FormErrors<Field> = { fields: {}, general: [] };

  for (const part of message.split("; ")) {
    const separator = part.indexOf(": ");
    const name = separator === -1 ? undefined : fields.find((field) => field === part.slice(0, separator));

    if (name === undefined) {
      result.general.push(part);
    } else if (result.fields[name] === undefined) {
      // Zod can report two problems for one field; the first is enough to act on.
      result.fields[name] = part.slice(separator + 2);
    }
  }
  return result;
}
