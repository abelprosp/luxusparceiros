'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { PartnerMapLocation } from '@luxus/types';
import { formatPartnerLocation, getPartnerLatLng } from '@/lib/brazil-geo';
import 'leaflet/dist/leaflet.css';

const markerIcon = L.divIcon({
  className: 'partner-map-marker',
  html: '<div style="width:14px;height:14px;border-radius:9999px;background:#0057FF;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const inactiveMarkerIcon = L.divIcon({
  className: 'partner-map-marker',
  html: '<div style="width:14px;height:14px;border-radius:9999px;background:#64748b;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function FitBrazilBounds({ positions, boundsKey }: { positions: [number, number][]; boundsKey: string }) {
  const map = useMap();

  useEffect(() => {
    if (positions.length > 0) {
      map.fitBounds(positions, { padding: [32, 32], maxZoom: 6 });
      return;
    }
    map.setView([-14.235, -51.9253], 4);
  }, [map, boundsKey, positions]);

  return null;
}

interface PartnersLeafletMapProps {
  partners: PartnerMapLocation[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
}

export function PartnersLeafletMap({ partners, hoveredId, onHover }: PartnersLeafletMapProps) {
  const markers = useMemo(() => {
    const stateCounts: Record<string, number> = {};
    return partners
      .filter((p) => p.state)
      .map((partner) => {
        const state = partner.state!.trim().toUpperCase();
        const index = stateCounts[state] ?? 0;
        stateCounts[state] = index + 1;
        const coords = getPartnerLatLng(state, index);
        if (!coords) return null;
        return { partner, position: [coords.lat, coords.lng] as [number, number] };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [partners]);

  const positions = markers.map((m) => m.position);
  const boundsKey = positions.map((p) => p.join(',')).join('|');

  return (
    <MapContainer
      center={[-14.235, -51.9253]}
      zoom={4}
      scrollWheelZoom={false}
      className="z-0 h-[320px] w-full rounded-2xl"
      style={{ background: '#e8e6e1' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBrazilBounds positions={positions} boundsKey={boundsKey} />
      {markers.map(({ partner, position }) => (
        <Marker
          key={partner.id}
          position={position}
          icon={partner.status === 'ACTIVE' ? markerIcon : inactiveMarkerIcon}
          eventHandlers={{
            mouseover: () => onHover(partner.id),
            mouseout: () => onHover(null),
            click: () => onHover(partner.id),
          }}
          opacity={hoveredId && hoveredId !== partner.id ? 0.55 : 1}
        >
          <Popup>
            <div className="space-y-1 text-sm">
              <p className="font-semibold">{partner.name}</p>
              <p className="text-muted-foreground">
                {formatPartnerLocation(partner.city, partner.state)}
              </p>
              <p>{partner.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
