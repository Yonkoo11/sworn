import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Landing } from "./pages/Landing";
import { ReceiptPage } from "./pages/ReceiptPage";
import { Nav } from "./components/Nav";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Nav />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/r/:chatId" element={<ReceiptPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
