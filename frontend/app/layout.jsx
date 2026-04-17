import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import ReduxProvider from "@/components/ReduxProvider";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta"
});

export const metadata = {
  title: "Workiya",
  description: "Workiya workforce platform"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body className={plusJakartaSans.variable} suppressHydrationWarning>
        <ReduxProvider>{children}</ReduxProvider>
      </body>
    </html>
  );
}
