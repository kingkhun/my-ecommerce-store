import "./globals.css";
// 1. Import the Provider you just created
import { CartProvider } from '@/app/context/CartContext'; 
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {/* 2. Wrap the children so every page has access to the cart */}
        <CartProvider>
          {children}
        </CartProvider>
      </body>
    </html>
  );
}
/*
import "./globals.css"; // Make sure this line exists!

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
} */

