import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "介護と障害福祉サービスの通知文Wiki",
  description:
    "介護と障害福祉サービスの通知文を検索し、詳細ページで該当の単語や文章を強調表示できる検索ページです。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
