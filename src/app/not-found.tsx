import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-100 px-6">
      <div className="rounded-[2rem] bg-white p-10 text-center shadow-[0_18px_55px_rgba(55,43,24,0.08)]">
        <p className="text-sm font-semibold tracking-[0.2em] text-stone-500 uppercase">404</p>
        <h1 className="mt-3 text-3xl font-semibold text-stone-900">文書が見つかりません</h1>
        <p className="mt-3 text-sm leading-7 text-stone-600">
          一覧に戻って、別の文書か検索語を試してください。
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-stone-50"
        >
          一覧に戻る
        </Link>
      </div>
    </main>
  );
}
