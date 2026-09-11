import { useState } from "react";
import { Route, Routes } from "react-router-dom";
import { Toolbar } from "./components/Toolbar.jsx";
import { Footer } from "./components/Footer.jsx";
import { LeagueStatsModal } from "./components/LeagueStatsModal.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { AboutPage } from "./pages/AboutPage.jsx";

function App() {
  const [openLeagueSlug, setOpenLeagueSlug] = useState(null);

  return (
    <>
      <Toolbar onSelectLeague={setOpenLeagueSlug} />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/leagues/:leagueSlug" element={<DashboardPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
      <Footer />
      <LeagueStatsModal
        leagueSlug={openLeagueSlug}
        onClose={() => setOpenLeagueSlug(null)}
      />
    </>
  );
}

export default App;
