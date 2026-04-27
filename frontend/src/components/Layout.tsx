import { NavLink, Outlet, useNavigate } from "react-router-dom";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "px-3 py-1.5 text-sm",
    isActive
      ? "border-b-2 border-pink-400 text-pink-200"
      : "border-b-2 border-transparent text-pink-500 hover:text-pink-300",
  ].join(" ");

export function Layout() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col bg-black">
      <header className="border-b border-zinc-800 bg-black shadow-[0_2px_12px_rgba(255,255,255,0.06)]">
        <div className="max-w-5xl mx-auto px-4">
          {/* Top row: centered TomeKeeper wordmark */}
          <div className="flex justify-center pt-3 pb-1">
            <span className="font-semibold text-pink-300 tracking-wide">
              TomeKeeper
            </span>
          </div>
          {/* Bottom row: nav, also centered so it lives directly under the title */}
          <nav className="flex justify-center flex-wrap">
            <NavLink to="/" end className={navLinkClass}>
              Home
            </NavLink>
            <NavLink to="/library" className={navLinkClass}>
              Library
            </NavLink>
            <NavLink to="/assistant" className={navLinkClass}>
              Assistant
            </NavLink>
            <NavLink to="/flash-sales" className={navLinkClass}>
              Flash sales
            </NavLink>
            <NavLink to="/subscriptions" className={navLinkClass}>
              Subscriptions
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-4">
        <Outlet />
      </main>

      {/* Global floating "✨ Assistant" button — replaces the old "📷"
          photo button. Tap to open the universal entry point that
          accepts text + screenshots + cover photos. The Capture form is
          still reachable from the nav for manual entry; the assistant
          handles every other flow. */}
      <button
        type="button"
        onClick={() => navigate("/assistant")}
        aria-label="Open Book Assistant"
        className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full bg-pink-500 text-black text-2xl shadow-[0_4px_20px_rgba(236,72,153,0.6)] hover:bg-pink-400 flex items-center justify-center"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        ✨
      </button>
    </div>
  );
}
