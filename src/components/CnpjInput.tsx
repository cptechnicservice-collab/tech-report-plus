import * as React from "react";

import { Input } from "@/components/ui/input";
import { caretAfterDigits, cnpjDigits, maskCNPJ } from "@/lib/cnpj-mask";

type CnpjInputProps = Omit<React.ComponentProps<"input">, "onChange" | "value"> & {
  value: string;
  onChange: (value: string) => void;
};

/** Controlled CNPJ field that inserts the two dots, the slash and the dash while typing. */
export const CnpjInput = React.forwardRef<HTMLInputElement, CnpjInputProps>(
  ({ value, onChange, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    return (
      <Input
        {...props}
        ref={(node) => {
          inputRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        value={value}
        inputMode="numeric"
        autoComplete="off"
        onChange={(event) => {
          const el = event.currentTarget;
          const caret = el.selectionStart ?? el.value.length;
          const digitsBefore = cnpjDigits(el.value.slice(0, caret)).length;
          const masked = maskCNPJ(el.value, value);
          onChange(masked);
          const position = caretAfterDigits(masked, digitsBefore);
          // The masked text is committed by React after this handler returns.
          queueMicrotask(() => {
            const node = inputRef.current;
            if (node && document.activeElement === node) {
              node.setSelectionRange(position, position);
            }
          });
        }}
      />
    );
  },
);

CnpjInput.displayName = "CnpjInput";
