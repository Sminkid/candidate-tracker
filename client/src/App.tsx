import { Route, Routes } from "react-router";
import { Layout } from "./components/Layout";
import { CandidateListPage } from "./pages/CandidateListPage";
import { NotFoundPage } from "./pages/NotFoundPage";

// All routes. main.tsx wraps this in a BrowserRouter; tests wrap it in a
// MemoryRouter so they can start on any URL.
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<CandidateListPage />} />
        {/* Next screens: /candidates/new (add form), /candidates/:id (detail). */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
