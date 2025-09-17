"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    setLoading(false);

    if (!response || response.error) {
      setError("メールアドレスまたはパスワードが正しくありません。");
      return;
    }

    router.push(callbackUrl);
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-ink">サインイン</h2>
        <p className="text-sm text-ink-muted">
          ご登録のメールアドレスとパスワードでログインしてください。
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
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
            autoComplete="current-password"
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
          {loading ? "サインイン中..." : "サインイン"}
        </button>
      </form>
      <div className="text-center text-sm text-ink-muted">
        アカウントをお持ちでない場合は{" "}
        <Link href="/signup" className="text-accent font-medium hover:underline">
          新規登録
        </Link>
      </div>
    </div>
  );
}
