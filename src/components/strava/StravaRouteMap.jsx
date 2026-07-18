import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { activityRouteLatLngs } from "../../lib/stravaPolyline";

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (!positions?.length) return;
    if (positions.length === 1) {
      map.setView(positions[0], 15);
      return;
    }
    map.fitBounds(positions, { padding: [28, 28], maxZoom: 16 });
  }, [map, positions]);
  return null;
}

/**
 * @param {{ activity: Record<string, unknown>|null, className?: string }} props
 */
export default function StravaRouteMap({ activity, className = "" }) {
  const positions = useMemo(() => activityRouteLatLngs(activity || {}), [activity]);

  if (positions.length < 2) {
    return (
      <div
        className={`flex h-48 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center ${className}`}
      >
        <p className="px-4 text-[12px] text-slate-400">Rute peta tidak tersedia untuk aktivitas ini.</p>
      </div>
    );
  }

  const center = positions[Math.floor(positions.length / 2)];

  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-100 ${className}`}>
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={false}
        className="h-52 w-full z-0"
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        />
        <Polyline positions={positions} pathOptions={{ color: "#fc4c02", weight: 4, opacity: 0.9 }} />
        <FitBounds positions={positions} />
      </MapContainer>
    </div>
  );
}
