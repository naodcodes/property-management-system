import * as React from 'react';
import { cn } from '@/lib/utils';

function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

function SelectTrigger({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <Select className={className} {...props} />;
}

function SelectValue({ placeholder }: { placeholder?: string }) {
  return <span>{placeholder}</span>;
}

function SelectContent({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function SelectItem({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  return <option value={value}>{children}</option>;
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
