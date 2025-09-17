"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  const handleClick = () => {
    signOut({ callbackUrl: "/login" });
  };

  return (
    <button
      onClick={handleClick}
      className="rounded-2xl border border-white/60 bg-panel/70 px-4 py-2 text-sm font-semibold text-ink shadow-soft transition hover:bg-panel focus:outline-none focus:ring-4 focus:ring-ink/15"
    >
      ログアウト
    </button>
  );
}
