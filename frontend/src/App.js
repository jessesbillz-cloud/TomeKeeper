import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Capture } from "./pages/Capture";
import { EditionDetail } from "./pages/EditionDetail";
import { Home } from "./pages/Home";
import { Library } from "./pages/Library";
export function App() {
    return (_jsx(BrowserRouter, { children: _jsx(Routes, { children: _jsxs(Route, { element: _jsx(Layout, {}), children: [_jsx(Route, { index: true, element: _jsx(Home, {}) }), _jsx(Route, { path: "library", element: _jsx(Library, {}) }), _jsx(Route, { path: "capture", element: _jsx(Capture, {}) }), _jsx(Route, { path: "editions/:id", element: _jsx(EditionDetail, {}) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }) }) }));
}
