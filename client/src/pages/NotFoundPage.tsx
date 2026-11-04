import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <main className="page">
      <h1>Page not found</h1>
      <p className="muted">
        <Link to="/">Back to candidates</Link>
      </p>
    </main>
  );
}
