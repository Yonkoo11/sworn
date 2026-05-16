import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Landing } from "./pages/Landing";
import { ReceiptPage } from "./pages/ReceiptPage";
import { Spec } from "./pages/Spec";
import { Integrate } from "./pages/Integrate";
import { Nav } from "./components/Nav";
import { Footer } from "./components/Footer";
import "./styles.css";
import "./spec.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <a className="skip-link" href="#main">Skip to content</a>
      <Nav />
      <div id="main">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/r/:chatId" element={<ReceiptPage />} />
          <Route path="/spec" element={<Spec />} />
          <Route path="/integrate" element={<Integrate />} />
        </Routes>
      </div>
      <Footer />
    </BrowserRouter>
  </StrictMode>
);
