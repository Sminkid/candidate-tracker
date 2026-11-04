import { Route, Routes } from "react-router";
import { Layout } from "./components/Layout";
import { AddCandidatePage } from "./pages/AddCandidatePage";
import { CandidateDetailPage } from "./pages/CandidateDetailPage";
import { CandidateListPage } from "./pages/CandidateListPage";
import { NotFoundPage } from "./pages/NotFoundPage";

// All routes. main.tsx wraps this in a BrowserRouter; tests wrap it in a
// MemoryRouter so they can start on any URL.
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<CandidateListPage />} />
        <Route path="candidates/new" element={<AddCandidatePage />} />
        <Route path="candidates/:id" element={<CandidateDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
