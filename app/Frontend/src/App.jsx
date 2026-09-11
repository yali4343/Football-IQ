import { Route, Routes } from "react-router-dom";
import { Footer } from "./components/Footer.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { AboutPage } from "./pages/AboutPage.jsx";

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/leagues/:leagueSlug" element={<DashboardPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
      <Footer />
    </>
  );
}

export default App;
