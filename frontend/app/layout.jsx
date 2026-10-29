// eslint-disable-next-line camelcase -- next/font/google names each export after the font family
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Script from "next/script";
import "./styles/tokens.css";
import "./globals.css";
import "./styles/workiya-ui.css";
import ReduxProvider from "@/components/ReduxProvider";

// The font variables sit on <html> so tokens.css (on :root) can read them.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

export const metadata = {
  title: "Workiya",
  description: "Workiya workforce platform",
};

// Runs before the page paints: applies the saved light / dark choice (same "wk-theme" key as
// ThemeProvider) so there is no flash, and marks that JavaScript is on for scroll reveals.
const EARLY_SCRIPT = "try{var t=localStorage.getItem('wk-theme');"
  + "if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}"
  + "document.documentElement.classList.add('js')";

export default function RootLayout({ children }) {
  return (
    // The early script changes <html> before React hydrates, so its attributes may differ.
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <Script id="wk-early" strategy="beforeInteractive">{EARLY_SCRIPT}</Script>
        <link
          rel="stylesheet"
          // eslint-disable-next-line @stylistic/max-len -- one Google Fonts URL, kept unsplit
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body suppressHydrationWarning>
        <ReduxProvider>{children}</ReduxProvider>
      </body>
    </html>
  );
}
