import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Adds matchers like toBeInTheDocument(). Each test starts with an empty
// page and a fresh fetch stub.
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
