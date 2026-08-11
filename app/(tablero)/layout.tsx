import { Header } from "@/components/header";

export default function TableroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <footer className="no-print pb-4 pt-8 text-center text-xs text-ink-muted/50">
        MaxP02 - Vercel
      </footer>
    </div>
  );
}
