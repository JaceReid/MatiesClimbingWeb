import React from "react";
import Navbar from "./components/Navbar";
import { BrowserRouter, Router, Routes, Route } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.css";
import HomePage from "./pages/home";
import NewsPage from "./pages/news";
import AboutPage from "./pages/about";
import GalleryPage from "./pages/gallery";
import NoPage from "./pages/nopage";
import SignupPage from "./pages/signup";
import GearPage from "./pages/gear";
import GearAdminPage from "./pages/gearadmin";

function App() {
  return (
    <>
      <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/gear" element={<GearPage />} />
          <Route path="/admin/gear" element={<GearAdminPage />} />
          <Route path="*" element={<NoPage />} />
        </Routes>
    </>
  );
}

export default App;
