import type { Summarizer } from "../../src/ai/summarizer";

// For tests that build the app but never ask for a summary.
// If one is requested anyway, the test fails loudly instead of calling anything real.
export const unusedSummarizer: Summarizer = async () => {
  throw new Error("This test did not expect a summary to be requested");
};
