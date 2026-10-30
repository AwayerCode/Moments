import { EntryPage } from "./pages/EntryPage.tsx";
import { FridgePage } from "./pages/FridgePage.tsx";

export default function App() {
  const path = window.location.pathname;
  if (path.startsWith("/gallery")) {
    return <FridgePage />;
  }
  return <EntryPage />;
}
