import type { ReactNode } from "react";
import { Link } from "react-router";

// "‹ Candidates" link at the top of the add and detail pages.
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="back-link">
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10 3L5 8l5 5" />
      </svg>
      {children}
    </Link>
  );
}
