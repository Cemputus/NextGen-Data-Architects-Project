import React, { useState, useMemo } from 'react';

/**
 * Enterprise DataTable: sticky header, sorting, pagination, optional search and export.
 * Use FilterChips above for visible active filters; use onExport with exportUtils for CSV/Excel.
 */
export const DataTable = ({
    columns,
    data,
    pagination = true,
    itemsPerPage = 10,
    onRowClick,
    searchable = false,
    searchPlaceholder = 'Search...',
    onExport,
    toolbar,
    className = ''
}) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const sortedData = useMemo(() => {
        let sortableItems = [...(data || [])];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aVal = a[sortConfig.key];
                const bVal = b[sortConfig.key];
                if (aVal == null && bVal == null) return 0;
                if (aVal == null) return sortConfig.direction === 'asc' ? 1 : -1;
                if (bVal == null) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [data, sortConfig]);

    const searchKeys = useMemo(
        () => (searchable === true ? (columns || []).map((c) => c.key).filter(Boolean) : Array.isArray(searchable) ? searchable : []),
        [searchable, columns]
    );

    const filteredData = useMemo(() => {
        if (!searchQuery.trim() || searchKeys.length === 0) return sortedData;
        const q = searchQuery.trim().toLowerCase();
        return sortedData.filter((row) =>
            searchKeys.some((key) => {
                const val = row[key];
                return val != null && String(val).toLowerCase().includes(q);
            })
        );
    }, [sortedData, searchQuery, searchKeys]);

    React.useEffect(() => setCurrentPage(1), [searchQuery]);

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
        setCurrentPage(1);
    };

    const totalItems = filteredData.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
    const offset = (currentPage - 1) * itemsPerPage;
    const paginatedData = pagination ? filteredData.slice(offset, offset + itemsPerPage) : filteredData;

    const handlePrev = () => setCurrentPage((prev) => Math.max(prev - 1, 1));
    const handleNext = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));

    const showToolbar = toolbar || searchable || onExport;

    if (!data || data.length === 0) {
        return (
            <div className={`w-full py-8 text-center text-muted-foreground bg-muted/20 rounded-md border border-dashed border-border ${className}`}>
                No records to display
            </div>
        );
    }

    return (
        <div className={`w-full rounded-md border border-border bg-card shadow-sm overflow-hidden ${className}`}>
            {showToolbar && (
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-border bg-muted/20">
                    {toolbar}
                    {searchable && searchKeys.length > 0 && (
                        <input
                            type="search"
                            placeholder={searchPlaceholder}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-9 px-3 rounded-md border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring max-w-[220px]"
                            aria-label="Search table"
                        />
                    )}
                    {onExport && (
                        <button
                            type="button"
                            onClick={() => onExport(filteredData)}
                            className="ml-auto h-9 px-3 rounded-md border border-border bg-background text-sm font-medium text-foreground hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            Export
                        </button>
                    )}
                </div>
            )}
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-xs tracking-wider sticky top-0 z-10">
                        <tr>
                            {columns.map((col) => (
                                <th
                                    key={col.key || col.header}
                                    scope="col"
                                    className={`px-4 py-3 font-semibold ${col.sortable !== false ? 'cursor-pointer hover:text-foreground' : ''} ${col.className || ''}`}
                                    onClick={() => col.sortable !== false && requestSort(col.key)}
                                >
                                    <div className="flex items-center gap-1">
                                        {col.header}
                                        {col.sortable !== false && sortConfig?.key === col.key && (
                                            <span className="text-accent">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 text-foreground">
                        {paginatedData.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground text-sm">
                                    No matching records
                                </td>
                            </tr>
                        ) : (
                            paginatedData.map((row, i) => (
                                <tr
                                    key={row.id || i}
                                    onClick={() => onRowClick && onRowClick(row)}
                                    className={`${onRowClick ? 'cursor-pointer hover:bg-muted/50' : 'hover:bg-muted/20'} transition-colors`}
                                >
                                    {columns.map((col) => (
                                        <td key={col.key || col.header} className={`px-4 py-3 ${col.className || ''}`}>
                                            {col.render ? col.render(row[col.key], row) : row[col.key]}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {pagination && totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 bg-muted/20 border-t border-border">
                    <div className="text-xs text-muted-foreground">
                        Showing <span className="font-medium text-foreground">{offset + 1}</span> to <span className="font-medium text-foreground">{Math.min(offset + itemsPerPage, totalItems)}</span> of <span className="font-medium text-foreground">{totalItems}</span> results
                    </div>
                    <div className="flex px-1 items-center gap-1">
                        <button
                            onClick={handlePrev}
                            disabled={currentPage === 1}
                            className="px-2 py-1 bg-background border border-border rounded text-sm hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>
                        <span className="px-3 text-sm">{currentPage} / {totalPages}</span>
                        <button
                            onClick={handleNext}
                            disabled={currentPage === totalPages}
                            className="px-2 py-1 bg-background border border-border rounded text-sm hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DataTable;
