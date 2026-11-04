import { Link, Outlet, useMatch } from "react-router";

// The header shared by every page. The "Add candidate" button is hidden on the
// add page itself, as in the design.
export function Layout() {
  const onAddPage = useMatch("/candidates/new") !== null;

  return (
    <>
      <header className="site-header">
        <div className="site-header__inner">
          <Link to="/" className="brand">
            Candidate Tracker
          </Link>
          {!onAddPage && (
            <Link to="/candidates/new" className="button button--primary">
              <PlusIcon />
              Add candidate
            </Link>
          )}
        </div>
      </header>
      <Outlet />
    </>
  );
}

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}
