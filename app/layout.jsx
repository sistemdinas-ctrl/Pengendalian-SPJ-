import "./globals.css";

export const metadata = {
  title: "Kendali Anggaran",
  description:
    "Sistem Informasi Cair — Monitoring Pagu & Realisasi Anggaran Dinas Kepemudaan dan Olahraga Kabupaten Bojonegoro",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased font-sans bg-[var(--color-surface)] text-slate-900">
        {children}
      </body>
    </html>
  );
}
