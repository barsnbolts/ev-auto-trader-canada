"use client";

// Phase C3: per-unit photo gallery. Reads photos from data/unit-photos.json
// (populated by scripts/scrape_unit_gallery.py). Lightbox with arrow-key +
// trackpad swipe support. Hidden when no photos for the unit.

import { useEffect, useState } from "react";
import unitPhotosJson from "@/data/unit-photos.json";

type PhotoEntry = { photos: string[]; scrapedAt?: string; note?: string };

const PHOTOS = unitPhotosJson as Record<string, PhotoEntry>;

export function UnitPhotoGallery({ unitId }: { unitId: string }) {
  const entry = PHOTOS[unitId];
  const photos = entry?.photos ?? [];
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    if (!lightbox) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(false);
      else if (e.key === "ArrowLeft") setActive((i) => (i > 0 ? i - 1 : photos.length - 1));
      else if (e.key === "ArrowRight") setActive((i) => (i + 1) % photos.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, photos.length]);

  if (photos.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mt-3 print:hidden">
        {photos.slice(0, 5).map((url, i) => (
          <button
            key={url}
            onClick={() => {
              setActive(i);
              setLightbox(true);
            }}
            className="aspect-video bg-bg-subtle overflow-hidden rounded card-hover"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Photo ${i + 1}`}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </button>
        ))}
        {photos.length > 5 && (
          <button
            onClick={() => {
              setActive(5);
              setLightbox(true);
            }}
            className="aspect-video bg-bg-subtle rounded text-xs text-fg-subtle hover:text-fg flex items-center justify-center"
          >
            +{photos.length - 5} more
          </button>
        )}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightbox(false)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActive((i) => (i > 0 ? i - 1 : photos.length - 1));
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-3xl px-3 py-2"
            aria-label="Previous photo"
          >
            ‹
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActive((i) => (i + 1) % photos.length);
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-3xl px-3 py-2"
            aria-label="Next photo"
          >
            ›
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[active]}
            alt={`Photo ${active + 1} of ${photos.length}`}
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-xs">
            {active + 1} / {photos.length}
          </div>
          <button
            onClick={() => setLightbox(false)}
            className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl px-3 py-2"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
