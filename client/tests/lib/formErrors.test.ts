import { describe, it, expect } from "vitest";
import { splitServerErrors } from "../../src/lib/formErrors";

const fields = ["name", "email", "resumeText"] as const;

describe("splitServerErrors", () => {
  it("puts each problem under its field", () => {
    expect(splitServerErrors("name: is required; email: must be a valid email address", fields)).toEqual({
      fields: { name: "is required", email: "must be a valid email address" },
      general: [],
    });
  });

  it("keeps problems for unknown fields, or without a field, as general messages", () => {
    expect(splitServerErrors("body: must be an object; Something odd", fields)).toEqual({
      fields: {},
      general: ["body: must be an object", "Something odd"],
    });
  });

  it("keeps the first problem when one field has two", () => {
    const result = splitServerErrors("name: is required; name: must be text", fields);
    expect(result.fields).toEqual({ name: "is required" });
  });

  it("does not mistake a field name that is only a prefix", () => {
    // "resumeTextExtra" is not "resumeText".
    expect(splitServerErrors("resumeTextExtra: no", fields).fields).toEqual({});
  });
});
