import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink, Outlet } from "react-router-dom";
const navLinkClass = ({ isActive }) => [
    "px-3 py-1.5 text-sm",
    isActive
        ? "border-b-2 border-zinc-900 text-zinc-900"
        : "border-b-2 border-transparent text-zinc-600 hover:text-zinc-900",
].join(" ");
export function Layout() {
    return (_jsxs("div", { className: "min-h-screen flex flex-col", children: [_jsx("header", { className: "border-b border-zinc-300 bg-white", children: _jsxs("div", { className: "max-w-5xl mx-auto px-4 flex items-center", children: [_jsx("span", { className: "font-semibold mr-4", children: "TomeKeeper" }), _jsxs("nav", { className: "flex", children: [_jsx(NavLink, { to: "/", end: true, className: navLinkClass, children: "Home" }), _jsx(NavLink, { to: "/library", className: navLinkClass, children: "Library" }), _jsx(NavLink, { to: "/capture", className: navLinkClass, children: "Capture" })] })] }) }), _jsx("main", { className: "flex-1 max-w-5xl mx-auto w-full px-4 py-4", children: _jsx(Outlet, {}) })] }));
}
