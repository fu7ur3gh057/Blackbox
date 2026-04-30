"use client";

import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { Globe2, MapPin } from "lucide-react";

/**
 * World "matrix" map — continents are rendered as a grid of dots, only
 * the cells that fall inside the simplified continent polygons get
 * drawn. The server's pin is a pulsing pale-green dot with two halo
 * rings.
 *
 * TODO: wire this to the backend (`/api/system/location` ipinfo lookup
 * cached per-process). Until then the location is a hardcoded stub —
 * Frankfurt, Germany — same shape as the future API response.
 */

// Hardcoded server location placeholder. Replace with API call once
// the backend exposes geo info.
const SERVER = {
  city: "Frankfurt",
  country: "Germany",
  iso: "DE",
  ip: "5.134.48.242",
  lat: 50.11,
  lng: 8.68,
};

// SVG viewBox is 200×100. Lng -180..180 → x 0..200, lat 80..-80 → y 0..100.
function project(lat: number, lng: number): [number, number] {
  return [(lng + 180) / 360 * 200, (80 - lat) / 160 * 100];
}

const [PIN_X, PIN_Y] = project(SERVER.lat, SERVER.lng);

// Hand-tuned simplified continent polygons (200×100 viewBox, equirect).
const CONTINENTS = [
  // North America (Canada + USA + Mexico)
  "8,18 22,12 38,14 50,14 60,18 62,28 56,38 44,46 32,52 24,52 18,46 12,40 6,30",
  // Central America
  "44,46 56,46 56,55 50,58 46,55",
  // South America
  "50,55 60,55 62,68 58,80 50,82 46,75 46,65",
  // Greenland
  "62,8 78,8 80,18 72,22 64,18",
  // Europe
  "92,18 100,14 116,16 120,28 110,32 100,30 92,28",
  // North Africa
  "94,32 116,32 118,48 110,52 104,52 96,48",
  // Sub-Saharan Africa
  "100,52 116,50 118,62 114,72 108,72 100,68",
  // Russia (huge top band)
  "100,8 178,10 180,22 162,28 130,28 110,28 100,22",
  // Middle East / Central Asia
  "118,28 142,28 144,42 130,44 120,42",
  // South Asia (India)
  "130,44 146,44 148,55 138,58 132,55",
  // Southeast Asia / China
  "146,28 178,30 180,46 162,46 148,42",
  // Indonesia / Phil
  "150,52 178,52 180,60 164,60 152,58",
  // Australia
  "158,68 180,66 182,78 168,82 158,78",
];

const DOTS_PER_ROW = 64;
const DOT_ROWS    = 32;

export function ServerLocation() {
  // build static dot grid coordinates once
  const [dots, setDots] = useState<Array<{ cx: number; cy: number }>>([]);
  useEffect(() => {
    const out: Array<{ cx: number; cy: number }> = [];
    const stepX = 200 / DOTS_PER_ROW;
    const stepY = 100 / DOT_ROWS;
    for (let r = 0; r < DOT_ROWS; r++) {
      for (let c = 0; c < DOTS_PER_ROW; c++) {
        out.push({ cx: c * stepX + stepX / 2, cy: r * stepY + stepY / 2 });
      }
    }
    setDots(out);
  }, []);

  return (
    <Panel className="overflow-hidden">
      <PanelHeader className="flex items-center justify-between pb-2">
        <PanelTitle className="flex items-center gap-2">
          <Globe2 size={14} className="text-accent-pale" />
          Server location
        </PanelTitle>
        <div className="flex items-center gap-2">
          <span className="pill-ghost font-mono">{SERVER.iso}</span>
          <span className="pill-green">live</span>
        </div>
      </PanelHeader>

      <PanelBody className="pt-3">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-5 items-center">
          {/* Map */}
          <div className="relative w-full">
            <svg viewBox="0 0 200 100" className="w-full">
              <defs>
                {/* Each cell of the grid is masked to land — cleaner than
                    dotting the whole rectangle and praying the polygon
                    overlaps nicely. */}
                <mask id="land-mask">
                  <rect x="0" y="0" width="200" height="100" fill="black" />
                  {CONTINENTS.map((p, i) => (
                    <polygon key={i} points={p} fill="white" />
                  ))}
                </mask>

                {/* radial glow for the pin */}
                <radialGradient id="pin-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%"   stopColor="#FFFFFF" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
                </radialGradient>
              </defs>

              {/* faint outline of the world bounds */}
              <rect
                x="0" y="0" width="200" height="100"
                fill="rgba(224,224,229,0.025)"
                stroke="rgba(224,224,229,0.10)"
                strokeWidth="0.3"
                strokeDasharray="0.6 1.2"
                rx="1.5"
              />

              {/* Equator + prime meridian */}
              <line x1="0" y1="50" x2="200" y2="50" stroke="rgba(224,224,229,0.10)" strokeWidth="0.25" strokeDasharray="0.6 1.2" />
              <line x1="100" y1="0" x2="100" y2="100" stroke="rgba(224,224,229,0.10)" strokeWidth="0.25" strokeDasharray="0.6 1.2" />

              {/* Dot grid clipped to land */}
              <g mask="url(#land-mask)">
                {dots.map((d, i) => (
                  <circle
                    key={i}
                    cx={d.cx}
                    cy={d.cy}
                    r={0.55}
                    fill="#E0E0E5"
                    opacity={0.55}
                  />
                ))}
              </g>

              {/* Server pin: glow + ring + core */}
              <circle cx={PIN_X} cy={PIN_Y} r={6} fill="url(#pin-glow)" />
              <circle cx={PIN_X} cy={PIN_Y} r={3.2} fill="none" stroke="#FFFFFF" strokeWidth="0.6">
                <animate attributeName="r" values="3;7;3" dur="2.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.85;0;0.85" dur="2.4s" repeatCount="indefinite" />
              </circle>
              <circle cx={PIN_X} cy={PIN_Y} r={1.4} fill="#FFFFFF" />
              <circle cx={PIN_X} cy={PIN_Y} r={0.7} fill="#FFFFFF" />
            </svg>

            {/* Subtle scanline overlay just on the map */}
            <div
              className="absolute inset-0 pointer-events-none rounded-lg"
              style={{
                backgroundImage:
                  "linear-gradient(to bottom, rgba(224,224,229,0.06) 0%, rgba(224,224,229,0.06) 1px, transparent 1px, transparent 4px)",
                opacity: 0.6,
              }}
            />
          </div>

          {/* Coordinates panel */}
          <div className="font-mono text-[12px] space-y-3 lg:border-l lg:border-white/[0.05] lg:pl-5">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-ink-mute mb-1">location</div>
              <div className="text-ink-strong text-[15px] font-semibold tracking-tight">
                {SERVER.city}, {SERVER.country}
              </div>
              <div className="flex items-center gap-1.5 text-accent-pale text-[11px] mt-1">
                <MapPin size={11} />
                <span>{SERVER.lat.toFixed(2)}°N · {SERVER.lng.toFixed(2)}°E</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-ink-mute mb-1">ip address</div>
              <div className="text-ink-strong tabular-nums">{SERVER.ip}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-ink-mute mb-1">timezone</div>
              <div className="text-ink-dim">CET (UTC+1)</div>
            </div>
          </div>
        </div>
      </PanelBody>
    </Panel>
  );
}
