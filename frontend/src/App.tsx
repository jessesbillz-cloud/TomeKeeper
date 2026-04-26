import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { Capture } from "./pages/Capture";
import { EditionDetail } from "./pages/EditionDetail";
import { FlashSales } from "./pages/FlashSales";
import { Home } from "./pages/Home";
import { Library } from "./pages/Library";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="library" element={<Library />} />
          <Route path="capture" element={<Capture />} />
          <Route path="flash-sales" element={<FlashSales />} />
          <Route path="editions/:id" element={<EditionDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
