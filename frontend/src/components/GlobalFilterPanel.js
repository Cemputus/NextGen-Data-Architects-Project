/**
 * Global Filter Panel - Smooth, Professional UI with Synced Filters
 * Filters sync: selecting faculty filters departments, selecting department filters programs
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Search, X, Filter } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select } from './ui/select';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import axios from 'axios';
import { loadFilters, saveFilters, loadSearchTerm, saveSearchTerm } from '../utils/statePersistence';
import { sanitizeDashboardFilters } from '../utils/filterUtils';
import { logAuditEvent } from '../utils/audit';
import { useAuth } from '../context/AuthContext';

const GlobalFilterPanel = ({
  onFilterChange,
  savedFilters = {},
  pageName = 'global',
  hideHighSchool = false,
  hideAcademic = false,
  hideFaculty = false,
  hideDepartment = false,
  /** If set, faculty is fixed (e.g. dean); all cascaded options stay within this faculty. */
  lockedFacultyId = undefined,
  /** If set, department is fixed (e.g. HOD); cascaded options stay within this department. */
  lockedDepartmentId = undefined,
  /** When the faculty has only one department, hide the department control and start at Program. */
  skipDepartmentFilter = false,
  /** Optional: overrides the default role-based filter subtitle (e.g. dean hierarchy hints). */
  filterHint = '',
}) => {
  const { user } = useAuth();
  const role = (user?.role || '').toString().toLowerCase();
  const isDean = role === 'dean';
  const isHod = role === 'hod';

  // For academic leaders we assume:
  // - Dean is already scoped to a faculty, so filters should start at Department.
  // - HOD is already scoped to a department, so filters should start at Program.
  const effectiveHideFaculty = hideFaculty || isDean || isHod;
  const effectiveHideDepartment = hideDepartment || isHod || skipDepartmentFilter;

  // Load persisted filters and search term for this page (per-user)
  // Normalize `savedFilters` to an object because some callers previously passed `[]`.
  const normalizedSavedFilters =
    savedFilters && typeof savedFilters === 'object' && !Array.isArray(savedFilters) ? savedFilters : {};
  const savedFiltersState = loadFilters(pageName, normalizedSavedFilters);
  const savedSearch = loadSearchTerm(pageName, '');

  const [filters, setFilters] = useState(() => {
    const raw =
      savedFiltersState && typeof savedFiltersState === 'object' && !Array.isArray(savedFiltersState)
        ? savedFiltersState
        : {};
    return sanitizeDashboardFilters(raw);
  });
  const [filterOptions, setFilterOptions] = useState({
    faculties: [],
    departments: [],
    programs: [],
    courses: [],
    semesters: [],
    high_schools: [],
    intake_years: [],
    year_of_studies: [],
  });
  const [searchTerm, setSearchTerm] = useState(savedSearch);
  const [loading, setLoading] = useState(false);
  const optionsRequestSeqRef = useRef(0);

  const emptyOptions = {
    faculties: [],
    departments: [],
    programs: [],
    courses: [],
    semesters: [],
    high_schools: [],
    intake_years: [],
    year_of_studies: [],
  };

  const formatIntakeYearLabel = (rawYear) => {
    const y = Number(rawYear);
    if (!Number.isFinite(y)) return String(rawYear ?? '');
    // Requested UI window: 2021/2 to 2026
    // 2021 -> 2021/2, 2022 -> 2022/3, ... 2025 -> 2025/6
    if (y >= 2021 && y <= 2025) {
      const next = y + 1;
      return `${y}/${String(next).slice(-1)}`;
    }
    if (y === 2026) return '2026';
    return String(y);
  };

  // Load filter options with current filter values for cascading (faculties -> departments -> programs -> courses)
  const loadFilterOptions = async (currentFilters = {}) => {
    const requestSeq = ++optionsRequestSeqRef.current;
    setLoading(true);
    try {
      const effectiveForRequest = { ...currentFilters };
      if (lockedFacultyId != null && lockedFacultyId !== '') {
        effectiveForRequest.faculty_id = String(lockedFacultyId);
      }
      if (lockedDepartmentId != null && lockedDepartmentId !== '') {
        effectiveForRequest.department_id = String(lockedDepartmentId);
      }
      const params = {};
      if (effectiveForRequest.faculty_id) params.faculty_id = effectiveForRequest.faculty_id;
      if (effectiveForRequest.department_id) params.department_id = effectiveForRequest.department_id;
      if (effectiveForRequest.program_id) params.program_id = effectiveForRequest.program_id;
      if (effectiveForRequest.semester_id) params.semester_id = effectiveForRequest.semester_id;

      const res = await axios.get('/api/analytics/filter-options', {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
        params,
      });
      if (requestSeq !== optionsRequestSeqRef.current) return;
      const data = res?.data || {};
      const nextOptions = {
        faculties: Array.isArray(data.faculties) ? data.faculties : emptyOptions.faculties,
        departments: Array.isArray(data.departments) ? data.departments : emptyOptions.departments,
        programs: Array.isArray(data.programs) ? data.programs : emptyOptions.programs,
        courses: Array.isArray(data.courses) ? data.courses : emptyOptions.courses,
        semesters: Array.isArray(data.semesters) ? data.semesters : emptyOptions.semesters,
        high_schools: Array.isArray(data.high_schools) ? data.high_schools : emptyOptions.high_schools,
        intake_years: Array.isArray(data.intake_years) ? data.intake_years : emptyOptions.intake_years,
        year_of_studies: Array.isArray(data.year_of_studies) ? data.year_of_studies : emptyOptions.year_of_studies,
      };
      setFilterOptions(nextOptions);

      // Guard against stale persisted filters after hard refresh:
      // if a selected value is not available in current cascaded options,
      // clear it (and its children) so filters remain logically consistent.
      const cleanedFilters = { ...(currentFilters || {}) };
      let changed = false;
      const lockFid =
        lockedFacultyId != null && lockedFacultyId !== '' ? String(lockedFacultyId) : null;
      const lockDid =
        lockedDepartmentId != null && lockedDepartmentId !== '' ? String(lockedDepartmentId) : null;

      const hasId = (list, idKey, selectedValue) =>
        Array.isArray(list) &&
        list.some((item) => String(item?.[idKey]) === String(selectedValue));

      if (
        cleanedFilters.faculty_id &&
        nextOptions.faculties.length > 0 &&
        !hasId(nextOptions.faculties, 'faculty_id', cleanedFilters.faculty_id) &&
        !(lockFid && String(cleanedFilters.faculty_id) === lockFid)
      ) {
        delete cleanedFilters.faculty_id;
        delete cleanedFilters.department_id;
        delete cleanedFilters.program_id;
        delete cleanedFilters.course_code;
        changed = true;
      }

      if (
        cleanedFilters.department_id &&
        nextOptions.departments.length > 0 &&
        !hasId(nextOptions.departments, 'department_id', cleanedFilters.department_id) &&
        !(lockDid && String(cleanedFilters.department_id) === lockDid)
      ) {
        delete cleanedFilters.department_id;
        delete cleanedFilters.program_id;
        delete cleanedFilters.course_code;
        changed = true;
      }

      if (
        cleanedFilters.program_id &&
        nextOptions.programs.length > 0 &&
        !hasId(nextOptions.programs, 'program_id', cleanedFilters.program_id)
      ) {
        delete cleanedFilters.program_id;
        delete cleanedFilters.course_code;
        changed = true;
      }

      if (
        cleanedFilters.course_code &&
        nextOptions.courses.length > 0 &&
        !hasId(nextOptions.courses, 'course_code', cleanedFilters.course_code)
      ) {
        delete cleanedFilters.course_code;
        changed = true;
      }

      if (
        cleanedFilters.year_of_study &&
        Array.isArray(nextOptions.year_of_studies) &&
        nextOptions.year_of_studies.length > 0 &&
        !nextOptions.year_of_studies.some((y) => String(y) === String(cleanedFilters.year_of_study))
      ) {
        delete cleanedFilters.year_of_study;
        changed = true;
      }

      if (changed) {
        const sanitized = sanitizeDashboardFilters(cleanedFilters);
        setFilters(sanitized);
        onFilterChange(sanitized);
        saveFilters(pageName, sanitized);
      }
    } catch (err) {
      if (requestSeq !== optionsRequestSeqRef.current) return;
      console.error('Error loading filter options:', err);
      setFilterOptions((prev) => ({
        ...emptyOptions,
        ...prev,
        faculties: Array.isArray(prev?.faculties) ? prev.faculties : [],
        departments: Array.isArray(prev?.departments) ? prev.departments : [],
        programs: Array.isArray(prev?.programs) ? prev.programs : [],
        courses: Array.isArray(prev?.courses) ? prev.courses : [],
        semesters: Array.isArray(prev?.semesters) ? prev.semesters : [],
        high_schools: Array.isArray(prev?.high_schools) ? prev.high_schools : [],
        intake_years: Array.isArray(prev?.intake_years) ? prev.intake_years : [],
        year_of_studies: Array.isArray(prev?.year_of_studies) ? prev.year_of_studies : [],
      }));
    } finally {
      if (requestSeq === optionsRequestSeqRef.current) {
        setLoading(false);
      }
    }
  };

  // Keep faculty locked for dean (or other roles) and notify parent
  useEffect(() => {
    if (lockedFacultyId == null || lockedFacultyId === '') return;
    const fid = String(lockedFacultyId);
    setFilters((prev) => {
      if (String(prev.faculty_id) === fid) return prev;
      const next = sanitizeDashboardFilters({ ...prev, faculty_id: fid });
      onFilterChange(next);
      saveFilters(pageName, next);
      return next;
    });
  }, [lockedFacultyId, pageName]);

  // Keep department locked for HOD (or other roles) and notify parent
  useEffect(() => {
    if (lockedDepartmentId == null || lockedDepartmentId === '') return;
    const did = String(lockedDepartmentId);
    setFilters((prev) => {
      if (String(prev.department_id) === did) return prev;
      const next = sanitizeDashboardFilters({ ...prev, department_id: did });
      onFilterChange(next);
      saveFilters(pageName, next);
      return next;
    });
  }, [lockedDepartmentId, pageName]);

  // Reload filter options when parent filters change (debounced to avoid request storms).
  useEffect(() => {
    const t = setTimeout(() => {
      loadFilterOptions(filters);
    }, 180);
    return () => clearTimeout(t);
  }, [
    filters.faculty_id,
    filters.department_id,
    filters.program_id,
    filters.semester_id,
    filters.year_of_study,
    lockedFacultyId,
    lockedDepartmentId,
  ]);
  
  // Notify parent on mount so charts refetch with the same scope as the panel (including empty = full role/institution view).
  useEffect(() => {
    onFilterChange(sanitizeDashboardFilters(filters));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount with initial persisted filters
  }, []);

  const handleFilterChange = (key, value) => {
    if (key === 'faculty_id' && lockedFacultyId != null && lockedFacultyId !== '') {
      return;
    }
    if (key === 'department_id' && lockedDepartmentId != null && lockedDepartmentId !== '') {
      return;
    }
    const newFilters = { ...filters };
    
    // Clear child filters when parent changes
    if (key === 'faculty_id') {
      // Clear department and program when faculty changes
      delete newFilters.department_id;
      delete newFilters.program_id;
      delete newFilters.course_code; // Also clear course when faculty changes
      delete newFilters.year_of_study;
    } else if (key === 'department_id') {
      // Clear program and course when department changes
      delete newFilters.program_id;
      delete newFilters.course_code;
      delete newFilters.year_of_study;
    } else if (key === 'program_id') {
      // Clear course when program changes (optional - you may want to keep this)
      // delete newFilters.course_code;
      delete newFilters.year_of_study;
    }
    
    if (value === '' || value === null) {
      delete newFilters[key];
    } else if (typeof value === 'string' && value.trim().toLowerCase() === 'all') {
      delete newFilters[key];
    } else {
      newFilters[key] = value;
    }

    const sanitized = sanitizeDashboardFilters(newFilters);
    setFilters(sanitized);
    onFilterChange(sanitized);
    logAuditEvent('filter_applied', 'filters', pageName);
    saveFilters(pageName, sanitized);
  };

  const handleSearch = () => {
    // Save search term
    saveSearchTerm(pageName, searchTerm);
    
    if (searchTerm.trim()) {
      const trimmed = searchTerm.trim();
      // Check for Access Number format (e.g., A12345, B67890)
      if (/^[AB]\d{5}$/i.test(trimmed)) {
        handleFilterChange('access_number', trimmed.toUpperCase());
      } 
      // Check for Reg Number format (e.g., 22B123/456, 23M456/789)
      else if (/\d{2}[BMD]\d{2,3}\/\d{2,3}/i.test(trimmed)) {
        handleFilterChange('reg_number', trimmed.toUpperCase());
      } 
      // Otherwise treat as name search
      else {
        handleFilterChange('student_name', trimmed);
      }
      // Clear search term after applying
      setSearchTerm('');
    }
  };

  const clearFilters = () => {
    const base = {};
    if (lockedFacultyId != null && lockedFacultyId !== '') {
      base.faculty_id = String(lockedFacultyId);
    }
    if (lockedDepartmentId != null && lockedDepartmentId !== '') {
      base.department_id = String(lockedDepartmentId);
    }
    const sanitized = sanitizeDashboardFilters(base);
    setFilters(sanitized);
    setSearchTerm('');
    saveSearchTerm(pageName, '');
    onFilterChange(sanitized);
    logAuditEvent('filter_cleared', 'filters', pageName);
    saveFilters(pageName, sanitized);
    loadFilterOptions(sanitized);
  };

  const sanitizedForCount = sanitizeDashboardFilters(filters);
  const activeFiltersCount = Object.keys(sanitizedForCount).filter((k) => {
    const v = sanitizedForCount[k];
    return v !== null && v !== undefined && String(v).trim() !== '';
  }).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="mb-6 border border-border shadow-xl bg-card/95 backdrop-blur-sm hover:shadow-2xl transition-all duration-300">
        <CardContent className="p-6">
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-lg">
                  <Filter className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Filters</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {filterHint
                      ? filterHint
                      : isDean &&
                          'Scoped to your faculty. Start from Department, then Program, Course, Semester, High School.'}
                    {!filterHint && isHod && 'Scoped to your department. Start from Program, then Course, Semester, High School.'}
                    {!filterHint && !isDean && !isHod &&
                      'Search by Access Number, Reg No, or Name. Filter by Faculty → Department → Program → Course → Semester → High School.'}
                  </p>
                </div>
              </div>
              {activeFiltersCount > 0 && (
                <Badge className="bg-primary/10 text-primary border border-primary/20 px-3 py-1">
                  {activeFiltersCount} active
                </Badge>
              )}
            </div>

            {/* Search Bar */}
            <div className="flex gap-3">
              <div className="relative flex-1 group">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  placeholder="Search by Access Number, Reg No, or Name"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-12 h-12 text-base border-2 border-input focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-lg shadow-sm hover:shadow-md transition-all"
                />
              </div>
              <Button 
                onClick={handleSearch} 
                size="default" 
                className="h-12 px-6 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all"
              >
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>

            {/* Filter Grid - Synced Filters */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
              {!effectiveHideFaculty && (
              <Select
                value={filters.faculty_id || ''}
                onChange={(e) => handleFilterChange('faculty_id', e.target.value || null)}
                disabled={loading}
                className="h-11 border-2 border-input rounded-lg shadow-sm hover:shadow-md transition-all focus:border-primary"
              >
                <option value="">All Faculties</option>
                {filterOptions.faculties?.map((f, idx) => (
                  <option key={`faculty-${f.faculty_id}-${idx}`} value={f.faculty_id}>
                    {f.faculty_name}
                  </option>
                ))}
              </Select>
              )}

              {!effectiveHideDepartment && (
              <Select
                value={filters.department_id || ''}
                onChange={(e) => handleFilterChange('department_id', e.target.value || null)}
                disabled={loading || (!effectiveHideFaculty && !filters.faculty_id)}
                className={`h-11 border-2 border-input rounded-lg shadow-sm hover:shadow-md transition-all focus:border-primary ${
                  !effectiveHideFaculty && !filters.faculty_id ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <option value="">
                  {filters.faculty_id || hideFaculty ? 'All Departments' : 'Select Faculty First'}
                </option>
                {filterOptions.departments?.map((d, idx) => (
                  <option key={`dept-${d.department_id || idx}`} value={d.department_id}>
                    {d.department_name}
                  </option>
                ))}
              </Select>
              )}

              {!hideAcademic && (
              <Select
                value={filters.program_id || ''}
                onChange={(e) => handleFilterChange('program_id', e.target.value || null)}
                disabled={loading || (!effectiveHideFaculty && !filters.faculty_id)}
                className={`h-11 border-2 border-input rounded-lg shadow-sm hover:shadow-md transition-all focus:border-primary ${
                  !effectiveHideFaculty && !filters.faculty_id ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <option value="">
                  {effectiveHideDepartment ? 'All Programs' : (filters.faculty_id || effectiveHideFaculty ? 'All Programs' : 'Select Faculty First')}
                </option>
                {filterOptions.programs?.map((p, idx) => (
                  <option key={`prog-${p.program_id || idx}`} value={p.program_id}>
                    {p.program_name}
                  </option>
                ))}
              </Select>
              )}

              {!hideAcademic && (
              <Select
                value={filters.semester_id || ''}
                onChange={(e) => handleFilterChange('semester_id', e.target.value || null)}
                disabled={loading}
                className="h-11 border-2 border-input rounded-lg shadow-sm hover:shadow-md transition-all focus:border-primary"
              >
                <option value="">All Semesters</option>
                {filterOptions.semesters?.map((s, idx) => (
                  <option key={`sem-${s.semester_id || idx}`} value={s.semester_id}>
                    {s.semester_name}
                  </option>
                ))}
              </Select>
              )}

              {!hideAcademic && (
              <Select
                value={filters.year_of_study || ''}
                onChange={(e) => handleFilterChange('year_of_study', e.target.value || null)}
                disabled={loading}
                aria-label="Year of study filter"
                title="Student year of study (Year 1–4) within the selected scope"
                className="h-11 border-2 border-input rounded-lg shadow-sm hover:shadow-md transition-all focus:border-primary"
              >
                <option value="">All Year(s) of Study</option>
                {filterOptions.year_of_studies?.map((y, idx) => (
                  <option key={`yos-${y}-${idx}`} value={y}>
                    {`Year ${y}`}
                  </option>
                ))}
              </Select>
              )}

              {!hideHighSchool && (
                <Select
                  value={filters.high_school || ''}
                  onChange={(e) => handleFilterChange('high_school', e.target.value || null)}
                  disabled={loading}
                  className="h-11 border-2 border-input rounded-lg shadow-sm hover:shadow-md transition-all focus:border-primary"
                >
                  <option value="">All High Schools</option>
                  {filterOptions.high_schools?.map((hs, idx) => (
                    <option key={`hs-${idx}-${hs.high_school || idx}`} value={hs.high_school}>
                      {hs.high_school}
                    </option>
                  ))}
                </Select>
              )}

              {!hideAcademic && (
              <Select
                value={filters.intake_year || ''}
                onChange={(e) => handleFilterChange('intake_year', e.target.value || null)}
                disabled={loading}
                title="Intake year (admission year): 2021/2 through 2026"
                aria-label="Intake year filter"
                className="h-11 border-2 border-input rounded-lg shadow-sm hover:shadow-md transition-all focus:border-primary"
              >
                <option value="">All intake years</option>
                {filterOptions.intake_years?.map((year, idx) => (
                  <option key={`year-${year || idx}`} value={year}>
                    {formatIntakeYearLabel(year)}
                  </option>
                ))}
              </Select>
              )}
            </div>

            {/* Active Filters & Clear */}
            {activeFiltersCount > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-center justify-between pt-4 border-t border-border"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-muted-foreground">Active filters:</span>
                  {Object.entries(filters).map(([key, value], idx) => {
                    if (!value) return null;
                    let displayValue = value;
                    if (key === 'faculty_id') {
                      displayValue =
                        filterOptions.faculties?.find((f) => String(f.faculty_id) === String(value))?.faculty_name || value;
                    } else if (key === 'department_id') {
                      displayValue =
                        filterOptions.departments?.find((d) => String(d.department_id) === String(value))?.department_name || value;
                    } else if (key === 'program_id') {
                      displayValue =
                        filterOptions.programs?.find((p) => String(p.program_id) === String(value))?.program_name || value;
                    } else if (key === 'course_code') {
                      displayValue =
                        filterOptions.courses?.find((c) => String(c.course_code) === String(value))?.course_name || value;
                    } else if (key === 'semester_id') {
                      displayValue =
                        filterOptions.semesters?.find((s) => String(s.semester_id) === String(value))?.semester_name || value;
                    } else if (key === 'intake_year') {
                      displayValue = formatIntakeYearLabel(value);
                    } else if (key === 'year_of_study') {
                      displayValue = `Year ${value}`;
                    }
                    return (
                      <Badge
                        key={`filter-${key}-${value}-${idx}`}
                        variant="secondary"
                        className="gap-1 pr-1 bg-primary/10 text-primary border border-primary/20 font-medium"
                      >
                        {key.replace('_', ' ')}: {displayValue}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 p-0 ml-1 hover:bg-primary/20 rounded-full"
                          onClick={() => handleFilterChange(key, null)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/50 font-medium"
                >
                  <X className="h-4 w-4" />
                  Clear All
                </Button>
              </motion.div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default GlobalFilterPanel;
