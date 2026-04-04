import "./globals.css";

export const metadata = {
  title: "Workiya",
  description: "Workiya workforce platform"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
