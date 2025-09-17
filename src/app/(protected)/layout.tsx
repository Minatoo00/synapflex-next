import type { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen bg-surface/70">
      <header className="sticky top-0 z-50 border-b border-white/40 bg-panel/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-5">
          <Link href="/dashboard" className="flex items-center gap-3 text-ink">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-ink text-white text-lg font-semibold shadow-soft">
              ✴︎
            </span>
            <div>
              <p className="text-sm font-semibold tracking-wide uppercase text-ink-muted">Synaplex</p>
              <p className="text-base font-semibold leading-tight">Cognitive Insights Studio</p>
            </div>
          </Link>
          <div className="flex items-center gap-4 text-sm text-ink-muted">
            <div className="rounded-2xl bg-white/60 px-4 py-2 shadow-soft">
              {session?.user?.email}
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
