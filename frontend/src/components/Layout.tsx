import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { SelectedDayContext } from "../lib/selectedDayContext";

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
  // Shared "what day did the user tap on Home's calendar" state.
  // Home pushes its selected ISO day here via SelectedDayContext so
  // the floating "+ Sale" button below can forward it on to
  // /flash-sales as ?starts=YYYY-MM-DD — preserving the auto-
  // prefill-the-date behavior the old inline "+ Flash sale" link
  // on the dashboard used to have.
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  // The floating button (rendered below) has absorbed the function
  // of the dashboard's old inline "+ Flash sale" pink button: a
  // single tap from any screen lands on /flash-sales with the
  // add-form already open and scrolled to. We signal "open the
  // form" by pushing a ?add=1 search param; FlashSales.tsx watches
  // for that param and handles both the form-open and the scroll.
  // When we're already on /flash-sales we use replace: true so the
  // back button doesn't get cluttered with intermediate ?add=1
  // entries — push otherwise so the back button returns to the
  // page the user came from.
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
        <SelectedDayContext.Provider value={{ selectedDay, setSelectedDay }}>
          <Outlet />
        </SelectedDayContext.Provider>
      </main>

      {/* Global floating "+ Sale" button — sits in the old
          "✨ Assistant" surface spot. Tap from any page to open
          the FlashSales add-form (the page picks ?add=1 up and
          scrolls itself to the top). The flash-sales LIST is still
          reachable from the "Flash sales" top-nav link.

          If Home has pushed a selectedDay into context (i.e. the
          user tapped a day on the calendar before hitting Sale),
          we forward it as ?starts=YYYY-MM-DD so FlashSales can
          prefill the add-form's date — exactly the way the old
          inline "+ Flash sale" Link on the dashboard did. */}
      <button
        type="button"
        onClick={() => {
          const url = selectedDay
            ? `/flash-sales?starts=${selectedDay}&add=1`
            : "/flash-sales?add=1";
          navigate(url, { replace: onFlashSales });
        }}
        aria-label="Add flash sale"
        className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full bg-pink-500 text-black shadow-[0_4px_20px_rgba(236,72,153,0.6)] hover:bg-pink-400 flex flex-col items-center justify-center leading-none"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <span className="text-xl" aria-hidden>➕</span>
        <span className="text-[10px] font-semibold mt-0.5">Sale</span>
      </button>
    </div>
  );
}
