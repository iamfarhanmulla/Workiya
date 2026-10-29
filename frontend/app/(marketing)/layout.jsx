// eslint-disable-next-line camelcase -- next/font/google names each export after the font family
import { Plus_Jakarta_Sans, Poppins } from "next/font/google";
import "./styles/base.css";
import "./styles/landing.css";
import "./styles/features.css";
import "./styles/login.css";

// The public pages (landing and login) use the brand fonts; the logo is set in Poppins.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-poppins",
});

export default function MarketingLayout({ children }) {
  return <div className={`${jakarta.variable} ${poppins.variable}`}>{children}</div>;
}
