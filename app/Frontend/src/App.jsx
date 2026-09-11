import { Route, Routes } from "react-router-dom";
import { Toolbar } from "./components/Toolbar.jsx";
import { Footer } from "./components/Footer.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { AboutPage } from "./pages/AboutPage.jsx";
import { LeagueInfoPage } from "./pages/LeagueInfoPage.jsx";

function App() {
  return (
    <>
      <Toolbar />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/leagues/:leagueSlug" element={<DashboardPage />} />
        <Route path="/leagues/:leagueSlug/info" element={<LeagueInfoPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
      <Footer />
    </>
  );
}

export default App;
