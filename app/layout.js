import "./globals.css";

export const metadata = { title: "Ad Spend Sync", description: "Fetch daily ad spend from Triple Whale into the monthly Google Sheet." };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
