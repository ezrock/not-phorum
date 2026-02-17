import Link from 'next/link';

interface TopicPaginationProps {
  currentPage: number;
  totalPages: number;
  topicId: number;
}

function buildPageHref(topicId: number, page: number) {
  if (page <= 1) return `/forum/topic/${topicId}`;
  return `/forum/topic/${topicId}?page=${page}`;
}

export function TopicPagination({ currentPage, totalPages, topicId }: TopicPaginationProps) {
  if (totalPages <= 1) return null;

  const visiblePages = Array.from(
    new Set([
      1,
      totalPages,
      Math.max(1, currentPage - 1),
      currentPage,
      Math.min(totalPages, currentPage + 1),
    ])
  ).sort((a, b) => a - b);

  return (
    <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap items-center justify-center gap-2 text-sm">
      {currentPage > 1 ? (
        <Link href={buildPageHref(topicId, currentPage - 1)} className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50">
          Edellinen
        </Link>
      ) : (
        <span className="px-3 py-1 rounded border border-gray-200 text-gray-400">Edellinen</span>
      )}

      {visiblePages.map((page) =>
        page === currentPage ? (
          <span key={page} className="px-3 py-1 rounded bg-yellow-100 text-yellow-900 font-semibold border border-yellow-200">
            {page}
          </span>
        ) : (
          <Link key={page} href={buildPageHref(topicId, page)} className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50">
            {page}
          </Link>
        )
      )}

      {currentPage < totalPages ? (
        <Link href={buildPageHref(topicId, currentPage + 1)} className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50">
          Seuraava
        </Link>
      ) : (
        <span className="px-3 py-1 rounded border border-gray-200 text-gray-400">Seuraava</span>
      )}
    </div>
  );
}
