'use client';

import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, MoveHorizontal, MoveVertical, ZoomIn } from 'lucide-react';
import { uploadAvatar } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toaster';

interface AvatarEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}

function drawCrop(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  zoom: number,
  horizontal: number,
  vertical: number,
) {
  const context = canvas.getContext('2d');
  if (!context) return;

  const size = canvas.width;
  const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight) * zoom;
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const maxHorizontal = Math.max(0, (width - size) / 2);
  const maxVertical = Math.max(0, (height - size) / 2);
  const x = (size - width) / 2 + (horizontal / 100) * maxHorizontal;
  const y = (size - height) / 2 + (vertical / 100) * maxVertical;

  context.clearRect(0, 0, size, size);
  context.drawImage(image, x, y, width, height);
}

export function AvatarEditorDialog({ open, onOpenChange, onSaved }: AvatarEditorDialogProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement>();
  const [sourceUrl, setSourceUrl] = useState<string>();
  const [zoom, setZoom] = useState(1);
  const [horizontal, setHorizontal] = useState(0);
  const [vertical, setVertical] = useState(0);
  const [saving, setSaving] = useState(false);

  const reset = useCallback(() => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    setSourceUrl(undefined);
    setImage(undefined);
    setZoom(1);
    setHorizontal(0);
    setVertical(0);
    if (inputRef.current) inputRef.current.value = '';
  }, [sourceUrl]);

  useEffect(() => {
    if (image && canvasRef.current) {
      drawCrop(canvasRef.current, image, zoom, horizontal, vertical);
    }
  }, [image, zoom, horizontal, vertical]);

  useEffect(() => () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  }, [sourceUrl]);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast({ title: 'Formato não aceito', description: 'Use JPG, PNG ou WebP.', variant: 'destructive' });
      event.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Imagem muito grande', description: 'O limite é 5 MB.', variant: 'destructive' });
      event.target.value = '';
      return;
    }

    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    const nextUrl = URL.createObjectURL(file);
    const nextImage = new Image();
    nextImage.onload = () => {
      setImage(nextImage);
      setZoom(1);
      setHorizontal(0);
      setVertical(0);
    };
    nextImage.onerror = () => {
      URL.revokeObjectURL(nextUrl);
      toast({ title: 'Não foi possível abrir a imagem', variant: 'destructive' });
    };
    nextImage.src = nextUrl;
    setSourceUrl(nextUrl);
  };

  const handleSave = async () => {
    if (!image) return;
    setSaving(true);
    try {
      const output = document.createElement('canvas');
      output.width = 512;
      output.height = 512;
      drawCrop(output, image, zoom, horizontal, vertical);
      const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, 'image/jpeg', 0.9));
      if (!blob) throw new Error('Não foi possível preparar a imagem');

      await uploadAvatar(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
      await onSaved();
      toast({ title: 'Foto de perfil atualizada', variant: 'success' });
      reset();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Erro ao salvar a foto',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !saving) reset();
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar foto de perfil</DialogTitle>
          <DialogDescription>
            Escolha uma imagem e ajuste enquadramento e aproximação antes de salvar.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFile}
        />

        {!image ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-muted/30 text-muted-foreground transition hover:border-primary hover:text-primary"
          >
            <ImagePlus className="h-9 w-9" />
            <span className="font-medium">Selecionar imagem</span>
            <span className="text-xs">JPG, PNG ou WebP · máximo de 5 MB</span>
          </button>
        ) : (
          <div className="space-y-5">
            <div className="mx-auto h-64 w-64 overflow-hidden rounded-full border-4 border-background bg-muted shadow-lg ring-1 ring-border">
              <canvas ref={canvasRef} width={512} height={512} className="h-full w-full" />
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2"><ZoomIn className="h-4 w-4" /> Aproximação</Label>
                <input className="w-full accent-primary" type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2"><MoveHorizontal className="h-4 w-4" /> Posição horizontal</Label>
                <input className="w-full accent-primary" type="range" min="-100" max="100" value={horizontal} onChange={(event) => setHorizontal(Number(event.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2"><MoveVertical className="h-4 w-4" /> Posição vertical</Label>
                <input className="w-full accent-primary" type="range" min="-100" max="100" value={vertical} onChange={(event) => setVertical(Number(event.target.value))} />
              </div>
            </div>

            <Button type="button" variant="outline" className="w-full" onClick={() => inputRef.current?.click()}>
              Escolher outra imagem
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={!image || saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
            {saving ? 'Salvando...' : 'Salvar foto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
