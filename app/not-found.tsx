import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="container-narrow py-24 text-center">
      <h1 className="text-4xl font-semibold">
        This page could not be found.
      </h1>

      <p className="mt-3 text-sm muted">
        The URL may be incorrect or the page may have moved.
      </p>

      <Link
        href="/"
        className="mt-6 inline-flex rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--bg)]"
      >
        Back Home
      </Link>
    </main>
  );
}