import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "px-2 py-1 text-xs sm:text-sm whitespace-nowrap",
    isActive
      ? "border-b-2 border-pink-400 text-pink-200"
      : "border-b-2 border-transparent text-pink-500 hover:text-pink-300",
  ].join(" ");

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  // When we're already on the flash-sales page, the floating button
  // shouldn't waste the tap on a self-navigation — it should be the
  // "add flash sale" trigger so the user doesn't have to scroll to
  // the top of the page to find it. We signal that by pushing a
  // ?add=1 search param onto the current URL; FlashSales.tsx watches
  // for that and opens its form + scrolls to top.
  const onFlashSales = location.pathname === "/flash-sales";
  return (
    <div className="min-h-screen flex flex-col bg-black">
      <header className="border-b border-zinc-800 bg-black shadow-[0_2px_12px_rgba(255,255,255,0.06)]">
        <div className="max-w-5xl mx-auto px-4">
          {/* Top row: centered TomeKeeper wordmark — fiery silvery pink */}
          <div className="flex justify-center pt-3 pb-0.5">
            <span
              className="font-bold text-lg tracking-wide bg-gradient-to-r from-rose-600 via-pink-100 to-pink-500 bg-clip-text text-transparent drop-shadow-[0_0_6px_rgba(236,72,153,0.35)]"
            >
              TomeKeeper
            </span>
          </div>
          {/* Nav: single row directly under the title (no wrap, tight spacing) */}
          <nav className="flex justify-center items-center gap-0.5 pb-1">
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

      {/* Global floating button. Context-aware:
            - on /flash-sales it's "➕ Add" and pushes ?add=1 so the
              FlashSales page opens its add-form and scrolls to top
              (saves the user a trip to the top "+ Add flash sale"
              button in the sticky header);
            - on every other page it's "⚡ Sale" and jumps to the
              flash sales list. */}
      <button
        type="button"
        onClick={() => {
          if (onFlashSales) {
            // Same path + new param keeps the FlashSales page
            // mounted; the effect there picks up ?add=1 and opens
            // the form. replace: true so back-button behaviour
            // isn't littered with intermediate ?add=1 entries.
            navigate("/flash-sales?add=1", { replace: true });
          } else {
            navigate("/flash-sales");
          }
        }}
        aria-label={onFlashSales ? "Add flash sale" : "Open Flash sales"}
        className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full bg-pink-500 text-black shadow-[0_4px_20px_rgba(236,72,153,0.6)] hover:bg-pink-400 flex flex-col items-center justify-center leading-none"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <span className="text-xl" aria-hidden>
          {onFlashSales ? "➕" : "⚡"}
        </span>
        <span className="text-[10px] font-semibold mt-0.5">
          {onFlashSales ? "Add" : "Sale"}
        </span>
      </button>
    </div>
  );
}
