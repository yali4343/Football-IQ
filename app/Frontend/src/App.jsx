import { Route, Routes } from "react-router-dom";
import { Footer } from "./components/Footer.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/leagues/:leagueSlug" element={<DashboardPage />} />
      </Routes>
      <Footer />
    </>
  );
}

export default App;
