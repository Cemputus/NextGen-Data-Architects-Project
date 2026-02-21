/**
 * Table — Design-system table with overflow-x-auto wrapper and consistent header/cell styles.
 */
import * as React from 'react';
import { cn } from '../../lib/utils';

const TableWrapper = ({ children, className, ...props }) => (
  <div className={cn('overflow-x-auto rounded-lg border border-border', className)} {...props}>
    {children}
  </div>
);

const Table = ({ className, ...props }) => (
  <table className={cn('w-full text-sm', className)} {...props} />
);

const TableHeader = ({ ...props }) => <thead {...props} />;

const TableBody = ({ ...props }) => <tbody {...props} />;

const TableRow = ({ className, ...props }) => (
  <tr className={cn('border-b border-border transition-colors hover:bg-muted/50', className)} {...props} />
);

const TableHead = ({ className, ...props }) => (
  <th
    className={cn(
      'text-left font-semibold p-3 text-foreground bg-muted/50 whitespace-nowrap',
      className
    )}
    {...props}
  />
);

const TableCell = ({ className, ...props }) => (
  <td className={cn('p-3 text-muted-foreground', className)} {...props} />
);

export { TableWrapper, Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
