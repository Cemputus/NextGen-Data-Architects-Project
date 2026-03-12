import React, { useState, useEffect } from 'react';

/**
 * Enterprise horizontal filter bar
 */
export const FilterBar = ({
    filters,
    onFilterChange,
    showFaculty = true,
    showDepartment = true,
    showProgram = true,
    showSemester = true,
    showDateRange = false,
    facultyOptions = [],
    departmentOptions = [],
    programOptions = [],
    semesterOptions = [],
    userRole = 'analyst'
}) => {
    const [localFilters, setLocalFilters] = useState(filters || {});

    useEffect(() => {
        setLocalFilters(filters || {});
    }, [filters]);

    const handleChange = (key, value) => {
        const newFilters = { ...localFilters, [key]: value };
        // Cascading resets
        if (key === 'faculty_id') {
            newFilters.department_id = 'all';
            newFilters.program_id = 'all';
        } else if (key === 'department_id') {
            newFilters.program_id = 'all';
        }

        setLocalFilters(newFilters);
        if (onFilterChange) onFilterChange(newFilters);
    };

    const handleClear = () => {
        const cleared = {};
        if (onFilterChange) onFilterChange(cleared);
    };

    return (
        <div className="bg-card border border-border rounded-lg p-4 shadow-sm flex flex-wrap gap-4 items-end mb-6">

            {showFaculty && (
                <div className="flex flex-col gap-1.5 min-w-[200px]">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Faculty</label>
                    <select
                        className="h-9 px-3 py-1 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                        value={localFilters.faculty_id || 'all'}
                        onChange={(e) => handleChange('faculty_id', e.target.value)}
                        disabled={userRole === 'dean' || userRole === 'hod' || userRole === 'staff'}
                    >
                        <option value="all">All Faculties</option>
                        {facultyOptions.map(f => (
                            <option key={f.id || f.faculty_id} value={f.id || f.faculty_id}>{f.name || f.faculty_name}</option>
                        ))}
                    </select>
                </div>
            )}

            {showDepartment && (
                <div className="flex flex-col gap-1.5 min-w-[200px]">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Department</label>
                    <select
                        className="h-9 px-3 py-1 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                        value={localFilters.department_id || 'all'}
                        onChange={(e) => handleChange('department_id', e.target.value)}
                        disabled={userRole === 'hod' || userRole === 'staff'}
                    >
                        <option value="all">All Departments</option>
                        {departmentOptions
                            .filter(d => !localFilters.faculty_id || localFilters.faculty_id === 'all' || String(d.faculty_id) === String(localFilters.faculty_id))
                            .map(d => (
                                <option key={d.id || d.department_id} value={d.id || d.department_id}>{d.name || d.department_name}</option>
                            ))}
                    </select>
                </div>
            )}

            {showProgram && (
                <div className="flex flex-col gap-1.5 min-w-[200px]">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Program</label>
                    <select
                        className="h-9 px-3 py-1 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                        value={localFilters.program_id || 'all'}
                        onChange={(e) => handleChange('program_id', e.target.value)}
                    >
                        <option value="all">All Programs</option>
                        {programOptions
                            .filter(p => !localFilters.department_id || localFilters.department_id === 'all' || String(p.department_id) === String(localFilters.department_id))
                            .map(p => (
                                <option key={p.id || p.program_id} value={p.id || p.program_id}>{p.name || p.program_name}</option>
                            ))}
                    </select>
                </div>
            )}

            {showSemester && (
                <div className="flex flex-col gap-1.5 min-w-[150px]">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Semester</label>
                    <select
                        className="h-9 px-3 py-1 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                        value={localFilters.semester_id || 'all'}
                        onChange={(e) => handleChange('semester_id', e.target.value)}
                    >
                        <option value="all">All Semesters</option>
                        {semesterOptions.map(s => (
                            <option key={s.id || s.semester_id} value={s.id || s.semester_id}>{s.name || s.semester_name}</option>
                        ))}
                    </select>
                </div>
            )}

            {showDateRange && (
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date Range</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            className="h-9 px-3 py-1 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm text-foreground"
                            value={localFilters.start_date || ''}
                            onChange={(e) => handleChange('start_date', e.target.value)}
                        />
                        <span className="text-muted-foreground text-sm">-</span>
                        <input
                            type="date"
                            className="h-9 px-3 py-1 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm text-foreground"
                            value={localFilters.end_date || ''}
                            onChange={(e) => handleChange('end_date', e.target.value)}
                        />
                    </div>
                </div>
            )}

            <div className="flex-1"></div>

            <button
                onClick={handleClear}
                className="h-9 px-4 py-1 text-sm font-medium text-foreground bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
            >
                Clear Filters
            </button>
        </div>
    );
};

export default FilterBar;
