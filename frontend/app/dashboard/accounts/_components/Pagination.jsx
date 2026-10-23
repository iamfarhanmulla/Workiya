"use client";

// Previous / next paging, shown only when there is more than one page.
export default function Pagination({
  page, pageSize, total, onPage,
}) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="wk-pagination">
      <span>{`Showing ${from}–${to} of ${total}`}</span>
      <div className="wk-pages">
        <button
          type="button"
          className="wk-page"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <span className="material-symbols-outlined" aria-hidden="true">chevron_left</span>
        </button>
        <span className="wk-page" aria-current="page">{`${page} / ${pages}`}</span>
        <button
          type="button"
          className="wk-page"
          aria-label="Next page"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
        </button>
      </div>
    </div>
  );
}
