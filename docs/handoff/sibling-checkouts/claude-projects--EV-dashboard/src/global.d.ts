// Declare Leaflet's global `L` so TypeScript compiles without @types/leaflet.
// Leaflet is loaded via CDN in index.html; this file just tells TS it exists.

declare const L: any;
