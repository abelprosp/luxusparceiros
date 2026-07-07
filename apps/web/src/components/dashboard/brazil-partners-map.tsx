'use client';

import { useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import type { PartnerMapLocation } from '@luxus/types';
import {
  BRAZIL_VIEWBOX,
  formatPartnerLocation,
  getBrazilOutlinePath,
  getPartnerCoords,
} from '@/lib/brazil-geo';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface BrazilPartnersMapProps {
  partners: PartnerMapLocation[];
}

export function BrazilPartnersMap({ partners }: BrazilPartnersMapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const outlinePath = useMemo(() => getBrazilOutlinePath(), []);

  const markers = useMemo(() => {
    const stateCounts: Record<string, number> = {};
    return partners
      .filter((p) => p.state)
      .map((partner) => {
        const state = partner.state!.trim().toUpperCase();
        const index = stateCounts[state] ?? 0;
        stateCounts[state] = index + 1;
        const coords = getPartnerCoords(state, index);
        if (!coords) return null;
        return { partner, coords };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [partners]);

  const partnersWithoutLocation = partners.filter((p) => !p.state);

  if (partners.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhum parceiro encontrado
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="relative rounded-2xl bg-[#f8f7f4] p-4 dark:bg-muted/30 lg:col-span-3">
        <svg
          viewBox={`0 0 ${BRAZIL_VIEWBOX.width} ${BRAZIL_VIEWBOX.height}`}
          className="mx-auto h-auto w-full max-w-md"
          role="img"
          aria-label="Mapa do Brasil com parceiros"
        >
          <path
            d={outlinePath}
            className="fill-muted/60 stroke-border"
            strokeWidth={2}
          />
          {markers.map(({ partner, coords }) => {
            const isActive = partner.status === 'ACTIVE';
            const isHovered = hoveredId === partner.id;
            return (
              <g
                key={partner.id}
                onMouseEnter={() => setHoveredId(partner.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="cursor-pointer"
              >
                <circle
                  cx={coords.x}
                  cy={coords.y}
                  r={isHovered ? 9 : 7}
                  className={cn(
                    'transition-all',
                    isActive
                      ? 'fill-primary stroke-primary-foreground'
                      : 'fill-muted-foreground stroke-background',
                  )}
                  strokeWidth={2}
                />
                {isHovered && (
                  <text
                    x={coords.x}
                    y={coords.y - 12}
                    textAnchor="middle"
                    className="fill-foreground text-[11px] font-medium"
                  >
                    {partner.name.length > 18 ? `${partner.name.slice(0, 16)}…` : partner.name}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Passe o mouse sobre os pontos para ver o parceiro
        </p>
      </div>

      <div className="max-h-72 space-y-2 overflow-y-auto lg:col-span-2">
        {partners.map((partner) => {
          const location = formatPartnerLocation(partner.city, partner.state);
          const isHovered = hoveredId === partner.id;
          return (
            <div
              key={partner.id}
              onMouseEnter={() => setHoveredId(partner.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={cn(
                'flex items-start gap-3 rounded-2xl border px-3 py-2 transition-colors',
                isHovered ? 'border-primary/40 bg-primary/5' : 'border-transparent bg-[#f8f7f4] dark:bg-muted/30',
              )}
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{partner.name}</p>
                  <Badge variant={partner.status === 'ACTIVE' ? 'success' : 'secondary'} className="shrink-0 text-[10px]">
                    {partner.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{location}</p>
              </div>
            </div>
          );
        })}
        {partnersWithoutLocation.length > 0 && (
          <p className="pt-1 text-xs text-muted-foreground">
            {partnersWithoutLocation.length} parceiro(s) sem UF cadastrada não aparecem no mapa.
          </p>
        )}
      </div>
    </div>
  );
}
