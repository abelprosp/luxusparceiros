'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const labelVariants = cva(
  'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
);

const FIELD_SELECTOR = 'input:not([type="hidden"]), textarea, select, button[role="combobox"], [role="checkbox"], [role="switch"]';

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, id, htmlFor, ...props }, forwardedRef) => {
  const generatedId = React.useId();
  const labelId = id ?? `label-${generatedId}`;
  const innerRef = React.useRef<HTMLLabelElement | null>(null);

  const setRef = React.useCallback(
    (node: HTMLLabelElement | null) => {
      innerRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );

  React.useEffect(() => {
    const label = innerRef.current;
    if (htmlFor || !label?.parentElement) return;
    const field = Array.from(label.parentElement.querySelectorAll<HTMLElement>(FIELD_SELECTOR)).find(
      (candidate) => label.compareDocumentPosition(candidate) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
    if (!field) return;
    if (field.hasAttribute('aria-label') || field.hasAttribute('aria-labelledby')) return;
    if (field.id && document.querySelector(`label[for="${CSS.escape(field.id)}"]`)) return;
    field.setAttribute('aria-labelledby', labelId);
  });

  return (
    <LabelPrimitive.Root
      ref={setRef}
      id={labelId}
      htmlFor={htmlFor}
      className={cn(labelVariants(), className)}
      {...props}
    />
  );
});
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
