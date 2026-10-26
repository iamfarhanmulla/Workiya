// Page title, one-line description and the page's main actions (right side).
export default function PageHeader({ title, sub, children }) {
  return (
    <div className="wk-page-hd">
      <div>
        <h1 className="wk-page-title">{title}</h1>
        {sub && <p className="wk-page-sub">{sub}</p>}
      </div>
      {children && <div className="wk-actions">{children}</div>}
    </div>
  );
}
