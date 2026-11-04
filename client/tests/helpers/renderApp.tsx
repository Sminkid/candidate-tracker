import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { AppRoutes } from "../../src/App";

// Renders the whole app at a given URL, as a user would see it.
export function renderApp(url = "/") {
  const user = userEvent.setup();
  const result = render(
    <MemoryRouter initialEntries={[url]}>
      <AppRoutes />
    </MemoryRouter>,
  );
  return { user, ...result };
}
