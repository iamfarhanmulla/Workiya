// Line icons used across the landing and login pages (24px grid, stroke follows the text colour).

function Line({
  children, className, width = 2, stroke = "currentColor",
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function ArrowRight({ className = "arrow" }) {
  return <Line className={className} width={2.2}><path d="M5 12h14M13 6l6 6-6 6" /></Line>;
}

export function ArrowLeft() {
  return <Line><path d="M19 12H5M11 6l-6 6 6 6" /></Line>;
}

export function Check({ width = 2.6, stroke }) {
  return <Line width={width} stroke={stroke}><path d="m5 12.5 4.5 4.5L19 7.5" /></Line>;
}

export function Pin() {
  return (
    <Line>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </Line>
  );
}

export function Camera() {
  return (
    <Line width={2.2}>
      <rect x="3" y="6" width="18" height="14" rx="3" />
      <circle cx="12" cy="13" r="3.5" />
    </Line>
  );
}

export function CameraOutline() {
  return (
    <Line>
      <rect x="3" y="6" width="18" height="14" rx="3" />
      <circle cx="12" cy="13" r="3.5" />
      <path d="M8.5 6 10 3.5h4L15.5 6" />
    </Line>
  );
}

export function Bars() {
  return <Line><path d="M4 20V10M10 20V5M16 20v-7M21 20H3" /></Line>;
}

export function Clock() {
  return <Line><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Line>;
}

export function Mail({ className }) {
  return (
    <Line className={className} width={1.8}>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m4 7 8 6 8-6" />
    </Line>
  );
}

export function Lock({ className, width = 2 }) {
  return (
    <Line className={className} width={width}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </Line>
  );
}

export function Moon() {
  return <Line><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></Line>;
}

export function Menu() {
  return <Line><path d="M4 7h16M4 12h16M4 17h16" /></Line>;
}

export function Plus() {
  return <Line width={2.4}><path d="M12 5v14M5 12h14" /></Line>;
}
