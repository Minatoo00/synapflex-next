"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      const message = typeof data.error === "string" ? data.error : "アカウントの作成に失敗しました";
      setError(message);
      setLoading(false);
      return;
    }

    const signInResult = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (signInResult?.error) {
      setError("サインインに失敗しました。ログインページから再度お試しください。");
      return;
    }

    router.push("/initial-survey");
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-ink">新規アカウント作成</h2>
        <p className="text-sm text-ink-muted">
          Synaplexの全機能をご利用いただくためのアカウントを作成します。
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium text-ink">
            お名前（任意）
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-2xl border border-white/40 bg-panel/60 px-4 py-3 text-ink shadow-soft focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/20 transition"
            placeholder="山田 太郎"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-ink">
            メールアドレス
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-2xl border border-white/40 bg-panel/60 px-4 py-3 text-ink shadow-soft focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/20 transition"
            placeholder="name@example.com"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-ink">
            パスワード
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-2xl border border-white/40 bg-panel/60 px-4 py-3 text-ink shadow-soft focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/20 transition"
            placeholder="8文字以上で設定してください"
          />
        </div>
        {error && (
          <p className="text-sm text-red-500 bg-red-50/80 border border-red-100 rounded-xl px-4 py-2">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-ink text-white py-3 text-sm font-medium shadow-elevated hover:bg-ink/90 focus:outline-none focus:ring-4 focus:ring-ink/20 transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "登録中..." : "アカウントを作成"}
        </button>
      </form>
      <div className="text-center text-sm text-ink-muted">
        既にアカウントをお持ちの方は{" "}
        <Link href="/login" className="text-accent font-medium hover:underline">
          ログイン
        </Link>
      </div>
    </div>
  );
}
