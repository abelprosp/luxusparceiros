import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/ui/theme-provider';
import { AuthProvider } from '@/components/auth/auth-provider';
import { NotificationsProvider } from '@/components/notifications/notifications-provider';
import { ToasterProvider } from '@/components/ui/toaster';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Luxus Parceiros - Admin',
  description: 'Plataforma administrativa Luxus Telefonia',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <ToasterProvider>
              <NotificationsProvider>{children}</NotificationsProvider>
            </ToasterProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
