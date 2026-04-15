"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

type Props = {
  isAdmin: boolean;
};

export function AdminBar({ isAdmin }: Props) {
  const router = useRouter();
  const [showLogin, setShowLogin] = useState(false);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (response.ok) {
        setShowLogin(false);
        setToken("");
        startTransition(() => {
          router.refresh();
        });
      } else {
        setError("パスワードが違います。");
      }
    } catch {
      setError("ネットワークエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    startTransition(() => {
      router.refresh();
    });
  }

  if (isAdmin) {
    return (
      <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-amber-900 px-4 py-2 text-sm font-semibold text-white shadow-lg">
        <span>管理者モード中</span>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium transition hover:bg-white/30"
        >
          ログアウト
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowLogin(true)}
        className="fixed bottom-5 right-5 z-50 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-400 shadow-sm transition hover:border-stone-300 hover:text-stone-600"
      >
        管理者ログイン
      </button>

      {showLogin ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowLogin(false);
              setError(null);
              setToken("");
            }
          }}
        >
          <div className="w-full max-w-sm rounded-[2rem] bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-stone-900">管理者ログイン</h2>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              管理者パスワードを入力してください。ログイン後、カテゴリ設定と関連キーワードの編集ができます。
            </p>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleLogin()}
              placeholder="パスワード"
              autoFocus
              className="mt-4 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-base outline-none transition focus:border-amber-400 focus:bg-white"
            />
            {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleLogin}
                disabled={loading || !token}
                className="flex-1 rounded-full bg-stone-900 py-3 text-sm font-semibold text-white transition hover:bg-amber-900 disabled:cursor-not-allowed disabled:bg-stone-300"
              >
                {loading ? "確認中..." : "ログイン"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogin(false);
                  setError(null);
                  setToken("");
                }}
                className="rounded-full border border-stone-200 px-5 py-3 text-sm font-semibold text-stone-600 transition hover:border-stone-300"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
