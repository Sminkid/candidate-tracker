import { describe, it, expect } from "vitest";
import { formatShortDate } from "../../src/lib/format";
import { readListFilters, roleOptions, writeListFilters } from "../../src/lib/listFilters";
import { isStage } from "../../src/lib/stages";
import { makeCandidate } from "../helpers/api";

describe("formatShortDate", () => {
  const now = new Date("2026-11-05T12:00:00Z");

  it("leaves out the year for dates in the current year", () => {
    expect(formatShortDate("2026-11-03T12:00:00Z", now)).toBe("3 Nov");
  });

  it("shows the year for older dates, so they are not mistaken for recent ones", () => {
    expect(formatShortDate("2025-11-03T12:00:00Z", now)).toBe("3 Nov 2025");
  });
});

describe("isStage", () => {
  it.each(["applied", "rejected"])("accepts %s", (value) => {
    expect(isStage(value)).toBe(true);
  });

  it.each(["", "Applied", "hired", null, 3])("rejects %j", (value) => {
    expect(isStage(value)).toBe(false);
  });
});

describe("readListFilters", () => {
  it("reads stage, role and sort from the URL", () => {
    const params = new URLSearchParams("stage=offer&role=Data+Analyst&sort=stage");
    expect(readListFilters(params)).toEqual({ stage: "offer", role: "Data Analyst", sort: "stage" });
  });

  it("ignores values the API would reject, instead of sending them", () => {
    const params = new URLSearchParams("stage=hired&role=%20%20&sort=name");
    expect(readListFilters(params)).toEqual({ stage: undefined, role: undefined, sort: "createdAt" });
  });
});

describe("writeListFilters", () => {
  it("leaves defaults out of the URL", () => {
    expect(writeListFilters({ sort: "createdAt" }).toString()).toBe("");
  });

  it("round-trips through readListFilters", () => {
    const filters = { stage: "interview" as const, role: "UX Designer", sort: "stage" as const };
    expect(readListFilters(writeListFilters(filters))).toEqual(filters);
  });
});

describe("roleOptions", () => {
  it("lists each role once, sorted", () => {
    const candidates = ["Data Analyst", "Backend Engineer", "Data Analyst"].map((role) => makeCandidate({ role }));
    expect(roleOptions(candidates)).toEqual(["Backend Engineer", "Data Analyst"]);
  });

  it("keeps the selected role even when no candidate has it", () => {
    expect(roleOptions([makeCandidate({ role: "Data Analyst" })], "UX Designer")).toEqual([
      "Data Analyst",
      "UX Designer",
    ]);
  });
});
