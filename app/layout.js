import './globals.css';

export const metadata = {
  title: 'DET — Daily Expense Tracker',
  description: 'Premium daily expense tracking — admin panel & API',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
