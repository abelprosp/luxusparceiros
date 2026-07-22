'use client';

import { useEffect, useState } from 'react';
import { getInitials } from '@luxus/utils';
import { fetchAuthenticatedFile } from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  name?: string;
  avatar?: string;
  className?: string;
  fallbackClassName?: string;
}

export function UserAvatar({ name, avatar, className, fallbackClassName }: UserAvatarProps) {
  const [imageUrl, setImageUrl] = useState<string>();

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;

    const load = async () => {
      if (!avatar) {
        setImageUrl(undefined);
        return;
      }
      if (avatar.startsWith('blob:') || avatar.startsWith('data:')) {
        setImageUrl(avatar);
        return;
      }

      const blob = await fetchAuthenticatedFile(avatar);
      if (!active || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setImageUrl(objectUrl);
    };

    void load();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [avatar]);

  return (
    <Avatar className={className}>
      {imageUrl && <AvatarImage src={imageUrl} alt={`Foto de ${name ?? 'perfil'}`} />}
      <AvatarFallback className={cn('font-semibold', fallbackClassName)}>
        {name ? getInitials(name) : 'P'}
      </AvatarFallback>
    </Avatar>
  );
}
