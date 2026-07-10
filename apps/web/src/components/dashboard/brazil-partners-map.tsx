'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import type { PartnerMapLocation } from '@luxus/types';
import { formatPartnerAddress } from '@/lib/brazil-geo';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const PartnersLeafletMap = dynamic(
  () => import('./partners-leaflet-map').then((mod) => mod.PartnersLeafletMap),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[320px] w-full rounded-2xl" />,
  },
);

interface BrazilPartnersMapProps {
  partners: PartnerMapLocation[];
}

export function BrazilPartnersMap({ partners }: BrazilPartnersMapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const partnersWithoutLocation = useMemo(
    () => partners.filter((p) => !p.state),
    [partners],
  );

  if (partners.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhum parceiro encontrado
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="overflow-hidden rounded-2xl border border-border bg-muted/40 p-2 lg:col-span-3">
        <PartnersLeafletMap
          partners={partners}
          hoveredId={hoveredId}
          onHover={setHoveredId}
        />
        <p className="px-2 py-2 text-center text-xs text-muted-foreground">
          Mapa OpenStreetMap — clique ou passe o mouse nos marcadores
        </p>
      </div>

      <div className="max-h-80 space-y-2 overflow-y-auto lg:col-span-2">
        {partners.map((partner) => {
          const location =
            formatPartnerAddress(
              partner.address,
              partner.city,
              partner.state,
              partner.zipCode,
            ) || 'Localização não informada';
          const isHovered = hoveredId === partner.id;
          return (
            <div
              key={partner.id}
              onMouseEnter={() => setHoveredId(partner.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={cn(
                'flex items-start gap-3 rounded-2xl border px-3 py-2 transition-colors',
                isHovered
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-transparent bg-muted',
              )}
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{partner.name}</p>
                  <Badge
                    variant={partner.status === 'ACTIVE' ? 'success' : 'secondary'}
                    className="shrink-0 text-[10px]"
                  >
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
