"use client";

import Pagination from "@/components/Pagination";
import { usePaged } from "@/hooks/usePaged";

// Shows one page of `items` (15 rows by default) through the render function `children`,
// followed by previous / next controls when there is more than one page.
// <Paged items={rows}>{(pageRows) => <MyTable rows={pageRows} />}</Paged>
export default function Paged({
  items, pageSize, resetKey, children,
}) {
  const paged = usePaged(items, { pageSize, resetKey });
  return (
    <>
      {children(paged.pageItems)}
      <Pagination
        page={paged.page}
        pageSize={paged.pageSize}
        total={paged.total}
        onPage={paged.setPage}
      />
    </>
  );
}
