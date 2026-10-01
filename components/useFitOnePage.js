"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// ============================================================
// useFitOnePage — muatkan isi dokumen cetak ke tepat 1 halaman,
// seperti "Fit Sheet on One Page" di Excel: sebesar apa pun isi,
// skala menyesuaikan.
// Teknik (deterministik di semua browser, termasuk saat print):
// sesudah render, tinggi isi diukur terhadap jatah 1 halaman
// kertas F4. Bila berlebih, isi dibungkus box dengan tinggi
// eksplisit hasil skala + overflow hidden, dan isi di dalamnya
// di-scale seragam via transform. Tinggi eksplisit-lah yang
// menentukan pagination cetak (dijamin 1 halaman), sedangkan
// transform hanya mengecilkan tampilan tanpa mengubah wrapping
// teks (lebar box dalam tidak diubah) — mirip perkecil fotokopi.
// ============================================================

// Tinggi kertas F4 13 inci dalam px CSS (1in = 96px).
const PAGE_H_PX = 13 * 96;
// Margin aman: target sedikit di bawah jatah penuh agar beda wrap
// layar-vs-print tidak menumpahkan baris terakhir ke halaman 2.
const FIT_SAFETY = 0.97;

/**
 * @param {string} docKey kunci dokumen (ganti NPD -> ukur ulang dari 100%)
 * @param {number} padYcm total padding vertikal sheet dalam cm (atas + bawah)
 * @returns {{ innerRef: import("react").RefObject, fitWrapStyle: object|undefined, fitInnerStyle: object|undefined }}
 */
export function useFitOnePage(docKey, padYcm) {
  const innerRef = useRef(null);
  const [fit, setFit] = useState({ z: 1, h: 0 });
  const keyRef = useRef(docKey);

  // Ganti dokumen -> ukur ulang dari 100%. Dijaga ref agar tidak
  // menimpa hasil fit pada render awal (passive effect jalan belakangan).
  useEffect(() => {
    if (keyRef.current !== docKey) {
      keyRef.current = docKey;
      setFit({ z: 1, h: 0 });
    }
  }, [docKey]);

  // Sesudah render: bila isi melebihi jatah 1 halaman, kunci skalanya.
  // Dijalankan tiap render (tanpa deps) agar data yang datang belakangan
  // (items/budget) ikut terukur; guard di dalam mencegah loop.
  useLayoutEffect(() => {
    if (fit.z !== 1) return;
    const el = innerRef.current;
    if (!el) return;
    const h = el.getBoundingClientRect().height;
    const avail = (PAGE_H_PX - (padYcm / 2.54) * 96) * FIT_SAFETY;
    if (h > avail && h > 0) {
      const z = avail / h;
      if (z < 0.999) setFit({ z, h: Math.ceil(avail) + 2 });
    }
  });

  if (fit.z === 1) {
    return { innerRef, fitWrapStyle: undefined, fitInnerStyle: undefined };
  }
  return {
    innerRef,
    fitWrapStyle: { height: `${fit.h}px`, overflow: "hidden" },
    fitInnerStyle: { transform: `scale(${fit.z})`, transformOrigin: "top center" },
  };
}
