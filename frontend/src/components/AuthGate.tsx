import { type ReactNode } from "react";

/** Auth disabled. */
export function AuthGate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
