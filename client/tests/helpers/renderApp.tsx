import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { AppRoutes } from "../../src/App";
import { LocationProbe } from "./LocationProbe";

// Renders the whole app at a given URL, as a user would see it.
// currentPath() reports where the app has navigated to (there is no address bar in tests).
export function renderApp(url = "/") {
  const user = userEvent.setup();
  const result = render(
    <MemoryRouter initialEntries={[url]}>
      <AppRoutes />
      <LocationProbe />
    </MemoryRouter>,
  );
  const currentPath = () => screen.getByTestId("location").textContent;
  return { user, currentPath, ...result };
}
