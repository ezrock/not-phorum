'use client';

import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center px-4" style={{ minHeight: 'calc(100vh - 4rem)' }}>
      <div className="text-center">
        <h2 className="text-4xl font-bold text-gray-800 mb-4">Jokin meni pieleen</h2>
        <p className="text-gray-600 mb-8">
          {error.message || 'Odottamaton virhe tapahtui.'}
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={reset}
            className="px-6 py-3 bg-gray-800 text-yellow-400 font-bold rounded hover:bg-gray-700 transition"
          >
            Yritä uudelleen
          </button>
          <Link
            href="/"
            className="px-6 py-3 border border-gray-300 text-gray-700 font-bold rounded hover:bg-gray-50 transition"
          >
            Etusivulle
          </Link>
        </div>
      </div>
    </div>
  );
}
