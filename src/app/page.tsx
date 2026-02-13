import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4">
      <h1 className="text-3xl font-semibold tracking-tight">Trading Journal</h1>
      <p className="max-w-md text-center text-muted-foreground">
        Track and analyze your trading activity.
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        <Link
          href="/dashboard"
          className="rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-90"
        >
          Dashboard
        </Link>
        <Link
          href="/trades"
          className="rounded-lg border border-border bg-card px-6 py-3 font-medium hover:bg-muted"
        >
          Trade History
        </Link>
      </div>
    </div>
  );
}
