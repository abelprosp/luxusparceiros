'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface NotificationAlertPayload {
  id: string;
  title: string;
  message: string;
  path: string;
}

interface NotificationAlertModalProps {
  alert: NotificationAlertPayload | null;
  onClose: () => void;
  onOpenSale: (path: string) => void;
}

export function NotificationAlertModal({
  alert,
  onClose,
  onOpenSale,
}: NotificationAlertModalProps) {
  return (
    <Dialog open={!!alert} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{alert?.title ?? 'Aviso'}</DialogTitle>
          <DialogDescription className="whitespace-pre-wrap pt-1">
            {alert?.message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button
            onClick={() => {
              if (alert?.path) onOpenSale(alert.path);
            }}
          >
            Abrir venda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
