import React, { useEffect, useRef } from 'react';

interface EditableTextProps {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'div';
  value: string;
  editable?: boolean;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  onChange?: (next: string) => void;
  onFocusField?: () => void;
}

export const EditableText: React.FC<EditableTextProps> = ({
  as: Tag = 'span',
  value,
  editable = false,
  multiline = false,
  placeholder = 'Click to type...',
  className = '',
  onChange,
  onFocusField,
}) => {
  const ref = useRef<HTMLElement | null>(null);
  const isFocusedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !editable) return;
    if (!isFocusedRef.current && el.innerText !== value) {
      el.innerText = value;
    }
  }, [value, editable]);

  if (!editable) {
    return <Tag className={className}>{value}</Tag>;
  }

  return (
    <Tag
      ref={ref as any}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      data-placeholder={placeholder}
      className={`${className} cms-editable-text`.trim()}
      onFocus={() => {
        isFocusedRef.current = true;
        onFocusField?.();
      }}
      onBlur={(e: React.FocusEvent<HTMLElement>) => {
        isFocusedRef.current = false;
        const nextText = multiline
          ? e.currentTarget.innerText.replace(/\r\n/g, '\n').trimEnd()
          : e.currentTarget.innerText.replace(/\s*\n+\s*/g, ' ').trim();
        if (nextText !== value) {
          onChange?.(nextText);
        }
      }}
      onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
        if (!multiline && e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        onFocusField?.();
      }}
    >
      {value}
    </Tag>
  );
};
