import { useLocation } from "react-router";

// Shows the router's current path in the page (hidden), so tests can check navigation.
export function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location" hidden>
      {location.pathname + location.search}
    </output>
  );
}
