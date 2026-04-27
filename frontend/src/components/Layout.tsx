import { NavLink, Outlet } from "react-router-dom";

import { PhotoCaptureButton } from "./PhotoCaptureButton";

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
        <div className="max-w-5xl mx-auto px-4">
          {/* Top row: centered TomeKeeper wordmark */}
          <div className="flex justify-center pt-3 pb-1">
            <span className="font-semibold text-pink-300 tracking-wide">
              TomeKeeper
            </span>
          </div>
          {/* Bottom row: nav, also centered so it lives directly under the title */}
          <nav className="flex justify-center">
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

      {/* Global floating "take photo" button — visible on every screen.
          Tap to open the rear camera; once a photo is captured the user is
          navigated to /capture with the image attached as router state. */}
      <PhotoCaptureButton
        to="/capture"
        label="📷"
        mode="camera"
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-pink-500 text-black text-2xl shadow-[0_4px_16px_rgba(236,72,153,0.5)] hover:bg-pink-400 disabled:opacity-50 flex items-center justify-center"
      />
    </div>
  );
}
