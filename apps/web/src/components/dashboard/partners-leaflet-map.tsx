'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { PartnerMapLocation } from '@luxus/types';
import { formatPartnerAddress, getPartnerLatLng } from '@/lib/brazil-geo';
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
      map.fitBounds(positions, {
        padding: [32, 32],
        maxZoom: positions.length === 1 ? 13 : 8,
      });
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

type Coordinates = { lat: number; lng: number };

async function geocodePartner(partner: PartnerMapLocation): Promise<Coordinates | null> {
  const query = [
    partner.address,
    partner.city,
    partner.state,
    partner.zipCode,
    'Brasil',
  ]
    .filter(Boolean)
    .join(', ');
  if (!partner.city || !partner.state || !query) return null;

  const cacheKey = `partner-geocode:${partner.id}:${query}`;
  const cached = window.localStorage.getItem(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached) as Coordinates;
    } catch {
      window.localStorage.removeItem(cacheKey);
    }
  }

  const params = new URLSearchParams({
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'br',
    q: query,
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return null;

  const result = (await response.json()) as { lat?: string; lon?: string }[];
  const lat = Number(result[0]?.lat);
  const lng = Number(result[0]?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const coordinates = { lat, lng };
  window.localStorage.setItem(cacheKey, JSON.stringify(coordinates));
  return coordinates;
}

export function PartnersLeafletMap({ partners, hoveredId, onHover }: PartnersLeafletMapProps) {
  const [resolvedCoordinates, setResolvedCoordinates] = useState<Record<string, Coordinates>>({});

  useEffect(() => {
    let cancelled = false;
    const unresolved = partners.filter(
      (partner) =>
        (typeof partner.latitude !== 'number' || typeof partner.longitude !== 'number') &&
        partner.address &&
        partner.city &&
        partner.state,
    );

    const resolveCoordinates = async () => {
      for (let index = 0; index < unresolved.length; index += 1) {
        const partner = unresolved[index];
        try {
          const coordinates = await geocodePartner(partner);
          if (!cancelled && coordinates) {
            setResolvedCoordinates((current) => ({
              ...current,
              [partner.id]: coordinates,
            }));
          }
        } catch {
          // Mantém o fallback estadual quando a geocodificação não estiver disponível.
        }
        if (index < unresolved.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1100));
        }
      }
    };

    void resolveCoordinates();
    return () => {
      cancelled = true;
    };
  }, [partners]);

  const markers = useMemo(() => {
    const stateCounts: Record<string, number> = {};
    return partners
      .map((partner) => {
        const resolved = resolvedCoordinates[partner.id];
        if (resolved) {
          return {
            partner,
            position: [resolved.lat, resolved.lng] as [number, number],
          };
        }
        if (
          typeof partner.latitude === 'number' &&
          typeof partner.longitude === 'number'
        ) {
          return {
            partner,
            position: [partner.latitude, partner.longitude] as [number, number],
          };
        }
        if (!partner.state) return null;
        const state = partner.state!.trim().toUpperCase();
        const index = stateCounts[state] ?? 0;
        stateCounts[state] = index + 1;
        const coords = getPartnerLatLng(state, index);
        if (!coords) return null;
        return { partner, position: [coords.lat, coords.lng] as [number, number] };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [partners, resolvedCoordinates]);

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
                {formatPartnerAddress(
                  partner.address,
                  partner.city,
                  partner.state,
                  partner.zipCode,
                ) || 'Localização não informada'}
              </p>
              <p>{partner.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
