import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface/60 flex items-center justify-center px-6 py-12">
      <div className="max-w-lg w-full space-y-8">
        <header className="text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-panel/80 backdrop-blur-sm shadow-soft flex items-center justify-center text-lg font-semibold text-ink">
            ✴︎
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-ink">Synaplex</h1>
            <p className="text-ink-muted text-sm">脳科学インサイトを日常に届けるパーソナルコンパニオン</p>
          </div>
        </header>
        <main className="bg-panel/90 backdrop-blur-md shadow-elevated rounded-3xl border border-white/40 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
