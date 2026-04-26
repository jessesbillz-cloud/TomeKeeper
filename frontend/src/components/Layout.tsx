import { NavLink, Outlet } from "react-router-dom";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "px-3 py-1.5 text-sm",
    isActive
      ? "border-b-2 border-pink-400 text-pink-200"
      : "border-b-2 border-transparent text-pink-500 hover:text-pink-300",
  ].join(" ");

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-black">
      <header className="border-b border-zinc-800 bg-black shadow-[0_2px_12px_rgba(255,255,255,0.06)]">
        <div className="max-w-5xl mx-auto px-4 flex items-center">
          <span className="font-semibold mr-4 text-pink-300">TomeKeeper</span>
          <nav className="flex">
            <NavLink to="/" end className={navLinkClass}>
              Home
            </NavLink>
            <NavLink to="/library" className={navLinkClass}>
              Library
            </NavLink>
            <NavLink to="/capture" className={navLinkClass}>
              Capture
            </NavLink>
            <NavLink to="/flash-sales" className={navLinkClass}>
              Flash sales
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-4">
        <Outlet />
      </main>
    </div>
  );
}
