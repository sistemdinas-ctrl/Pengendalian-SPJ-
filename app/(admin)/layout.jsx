import AdminShell from "../../components/AdminShell";

// Migrasi dari: src/router/index.js
// path "/" + component AdminLayout -> layout grup "(admin)" ini.
// Semua halaman di folder ini otomatis dibungkus sidebar + header.
export default function AdminLayout({ children }) {
  return <AdminShell>{children}</AdminShell>;
}
