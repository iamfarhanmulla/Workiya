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
    <div className="co-pagination" style={{ margin: "0 20px 20px" }}>
      <span>Showing {from}–{to} of {total}</span>
      <div className="co-page-btns">
        <button
          type="button"
          className="co-page-btn"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <span className="co-page-btn active" aria-current="page">{page}</span>
        <button
          type="button"
          className="co-page-btn"
          aria-label="Next page"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>
    </div>
  );
}
