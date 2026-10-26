"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSelector } from "react-redux";
import { selectUser } from "@/store/authSlice";
import { useTerminology } from "@/hooks/useTerminology";
import { useTheme } from "@/components/ThemeProvider";
import Dropdown from "@/components/Dropdown";
import UserMenu from "@/components/UserMenu";
import {
  ACTIVITY_CREATORS, SETTINGS_LINKS, SETTINGS_ROLES, buildNav, isActive, isGroupActive,
} from "@/components/navConfig";

const current = (pathname, href) => (isActive(pathname, href) ? "page" : undefined);

function Icon({ name }) {
  return <span className="material-symbols-outlined" aria-hidden="true">{name}</span>;
}

function NavGroup({ group, pathname }) {
  const active = isGroupActive(pathname, group);
  return (
    <Dropdown
      as="li"
      triggerClassName={`wk-topnav-link${active ? " is-active" : ""}`}
      triggerContent={(
        <>
          {group.label}
          <Icon name="expand_more" />
        </>
      )}
    >
      {(close) => group.items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="wk-menu-item"
          aria-current={current(pathname, item.href)}
          onClick={close}
        >
          {item.label}
        </Link>
      ))}
    </Dropdown>
  );
}

function DesktopNav({ entries, pathname }) {
  return (
    <nav aria-label="Main">
      <ul className="wk-topnav-links">
        {entries.map((entry) => (entry.items
          ? <NavGroup key={entry.label} group={entry} pathname={pathname} />
          : (
            <li key={entry.href}>
              <Link
                href={entry.href}
                className="wk-topnav-link"
                aria-current={current(pathname, entry.href)}
              >
                {entry.label}
              </Link>
            </li>
          )))}
      </ul>
    </nav>
  );
}

function SettingsMenu({ pathname }) {
  const active = SETTINGS_LINKS.some((l) => isActive(pathname, l.href));
  return (
    <Dropdown
      align="end"
      triggerClassName={`wk-btn wk-btn--ghost wk-btn--icon${active ? " is-active" : ""}`}
      triggerLabel="Company settings"
      triggerContent={<Icon name="settings" />}
    >
      {(close) => SETTINGS_LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="wk-menu-item"
          aria-current={current(pathname, l.href)}
          onClick={close}
        >
          <Icon name={l.icon} />
          {l.label}
        </Link>
      ))}
    </Dropdown>
  );
}

function ThemeButton() {
  const { theme, toggle } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className="wk-btn wk-btn--ghost wk-btn--icon"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
    >
      <Icon name={theme === "dark" ? "light_mode" : "dark_mode"} />
    </button>
  );
}

function MobileNav({
  entries, pathname, showSettings, onNavigate,
}) {
  const link = (item) => (
    <Link
      key={item.href}
      href={item.href}
      className="wk-mobilenav-link"
      aria-current={current(pathname, item.href)}
      onClick={onNavigate}
    >
      {item.label}
    </Link>
  );
  const group = (label, items) => (
    <div key={label} role="group" aria-label={label}>
      <div className="wk-mobilenav-heading" aria-hidden="true">{label}</div>
      {items.map(link)}
    </div>
  );
  return (
    <nav id="wk-mobilenav" className="wk-mobilenav" aria-label="Main menu">
      {entries.map((entry) => (entry.items ? group(entry.label, entry.items) : link(entry)))}
      {showSettings && group("Company settings", SETTINGS_LINKS)}
    </nav>
  );
}

function BrandAndMenuButton({ mobileOpen, onToggle }) {
  return (
    <>
      <button
        type="button"
        className="wk-btn wk-btn--ghost wk-btn--icon wk-topnav-burger"
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        aria-expanded={mobileOpen}
        aria-controls="wk-mobilenav"
        onClick={onToggle}
      >
        <Icon name={mobileOpen ? "close" : "menu"} />
      </button>
      <Link href="/dashboard" className="wk-topnav-brand">
        <span className="wk-logo" aria-hidden="true">W</span>
        <span className="wk-topnav-brand-name">Workiya</span>
      </Link>
      <span className="wk-topnav-divider" aria-hidden="true" />
    </>
  );
}

function NewActivityLink({ label }) {
  return (
    <Link href="/dashboard/activities" className="wk-btn wk-btn--primary" aria-label={label}>
      <Icon name="add" />
      <span className="wk-topnav-new-label" aria-hidden="true">{label}</span>
    </Link>
  );
}

export default function TopNav() {
  const pathname = usePathname();
  const user = useSelector(selectUser);
  const { t } = useTerminology();
  const [mobileOpen, setMobileOpen] = useState(false);
  const entries = buildNav(t, user?.roleCode);
  const showSettings = SETTINGS_ROLES.includes(user?.roleCode);

  return (
    <header className="wk-app wk-topnav">
      <div className="wk-topnav-inner">
        <BrandAndMenuButton mobileOpen={mobileOpen} onToggle={() => setMobileOpen((o) => !o)} />
        <DesktopNav entries={entries} pathname={pathname} />
        <span className="wk-topnav-spacer" />
        {ACTIVITY_CREATORS.includes(user?.roleCode) && (
          <NewActivityLink label={`New ${t("activity.singular")}`} />
        )}
        <ThemeButton />
        {showSettings && <SettingsMenu pathname={pathname} />}
        <UserMenu />
      </div>
      {mobileOpen && (
        <MobileNav
          entries={entries}
          pathname={pathname}
          showSettings={showSettings}
          onNavigate={() => setMobileOpen(false)}
        />
      )}
    </header>
  );
}
