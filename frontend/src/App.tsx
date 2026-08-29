import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthGate } from "./components/AuthGate";
import { Layout } from "./components/Layout";
import { AlertsProvider } from "./lib/alertsContext";
import { AuthProvider } from "./lib/auth";
import { Assistant } from "./pages/Assistant";
import { Capture } from "./pages/Capture";
import { EditionDetail } from "./pages/EditionDetail";
import { FlashSales } from "./pages/FlashSales";
import { Home } from "./pages/Home";
import { Library } from "./pages/Library";
import { PublisherSalesEvents } from "./pages/PublisherSalesEvents";
import { Subscriptions } from "./pages/Subscriptions";

export function App() {
  return (
    <AuthProvider>
      <AuthGate>
        {/* Inside AuthGate so the first alerts fetch happens with a
            session in hand, and above the router so every screen shares
            one copy of which events have notifications switched on. */}
        <AlertsProvider>
        <BrowserRouter basename="/TomeKeeper">
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="assistant" element={<Assistant />} />
              <Route path="library" element={<Library />} />
              <Route path="capture" element={<Capture />} />
              <Route path="flash-sales" element={<FlashSales />} />
              <Route path="subscriptions" element={<Subscriptions />} />
              <Route
                path="publisher-sales-events"
                element={<PublisherSalesEvents />}
              />
              <Route path="editions/:id" element={<EditionDetail />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
        </AlertsProvider>
      </AuthGate>
    </AuthProvider>
  );
}
