/**
 * Global Filter Panel Component - shadcn/ui + TailwindCSS
 * Enhanced with cascading filters, advanced icons, and modern UI
 */
import React, { useState, useEffect } from 'react';
import {
  Filter, 
  X, 
  Search, 
  ChevronDown, 
  ChevronUp,
  Building2,
  GraduationCap,
  BookOpen,
  Calendar,
  School,
  Users
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import axios from 'axios';

const GlobalFilterPanelShadcn = ({ onFilterChange, savedFilters = [] }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [filters, setFilters] = useState({});
  const [filterOptions, setFilterOptions] = useState({
    faculties: [],
    departments: [],
    programs: [],
    courses: [],
    semesters: [],
    high_schools: [],
    intake_years: [],
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

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

  const normalizeOptions = (data = {}) => ({
    faculties: (data.faculties || []).map((f) => ({
      faculty_id: f.faculty_id ?? f.FacultyID ?? f.id,
      faculty_name: f.faculty_name ?? f.FacultyName ?? f.name,
    })).filter((f) => f.faculty_id !== undefined && f.faculty_name),
    departments: (data.departments || []).map((d) => ({
      department_id: d.department_id ?? d.DepartmentID ?? d.id,
      department_name: d.department_name ?? d.DepartmentName ?? d.name,
      faculty_id: d.faculty_id ?? d.FacultyID,
    })).filter((d) => d.department_id !== undefined && d.department_name),
    programs: (data.programs || []).map((p) => ({
      program_id: p.program_id ?? p.ProgramID ?? p.id,
      program_name: p.program_name ?? p.ProgramName ?? p.name,
      department_id: p.department_id ?? p.DepartmentID,
      faculty_id: p.faculty_id ?? p.FacultyID,
    })).filter((p) => p.program_id !== undefined && p.program_name),
    courses: (data.courses || []).map((c) => ({
      course_code: c.course_code ?? c.CourseCode ?? c.id,
      course_name: c.course_name ?? c.CourseName ?? c.name,
      program_id: c.program_id ?? c.ProgramID,
    })).filter((c) => c.course_code),
    semesters: (data.semesters || []).map((s) => ({
      semester_id: s.semester_id ?? s.SemesterID ?? s.id,
      semester_name: s.semester_name ?? s.SemesterName ?? s.name,
    })).filter((s) => s.semester_id !== undefined),
    high_schools: (data.high_schools || []).map((h) => ({
      high_school: h.high_school ?? h.school_name ?? h.HighSchool ?? h.name,
      high_school_district: h.high_school_district ?? h.HighSchoolDistrict ?? h.district,
    })).filter((h) => h.high_school),
    intake_years: (data.intake_years || []).map((y) => Number(y)).filter((y) => !Number.isNaN(y)),
  });

  // Load filter options with cascading support
  const loadFilterOptions = async (facultyId = null, departmentId = null, semesterId = null) => {
    setLoading(true);
    const params = {};
    if (facultyId) params.faculty_id = facultyId;
    if (departmentId) params.department_id = departmentId;
    if (semesterId) params.semester_id = semesterId;
    
    try {
      const res = await axios.get('/api/analytics/filter-options', {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` },
        params
      });
      setFilterOptions(normalizeOptions(res.data || {}));
      
      // If faculty changed, clear department and program filters
      if (facultyId && filters.department_id) {
        const newFilters = { ...filters };
        delete newFilters.department_id;
        delete newFilters.program_id;
        setFilters(newFilters);
        onFilterChange(newFilters);
      }
      // If department changed, clear program filter
      if (departmentId && filters.program_id) {
        const newFilters = { ...filters };
        delete newFilters.program_id;
        setFilters(newFilters);
        onFilterChange(newFilters);
      }
    } catch (err) {
      console.error('Error loading filter options:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load / refresh options (intake years list respects semester_id for 2026 rule)
  useEffect(() => {
    const facultyId = filters.faculty_id ? parseInt(filters.faculty_id, 10) : null;
    const departmentId = filters.department_id ? parseInt(filters.department_id, 10) : null;
    const semesterId = filters.semester_id ? parseInt(filters.semester_id, 10) : null;
    loadFilterOptions(facultyId, departmentId, semesterId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.faculty_id, filters.department_id, filters.semester_id]);

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters };
    
    // Cascading filter logic
    if (key === 'faculty_id') {
      // When faculty changes, clear department and program
      delete newFilters.department_id;
      delete newFilters.program_id;
      newFilters[key] = value;
    } else if (key === 'department_id') {
      // When department changes, clear program
      delete newFilters.program_id;
      newFilters[key] = value;
    } else {
      newFilters[key] = value;
    }
    
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleSearch = () => {
    if (searchTerm) {
      // Try to detect format
      if (/^[AB]\d{5}$/.test(searchTerm)) {
        handleFilterChange('access_number', searchTerm);
      } else if (/\d{2}[BMD]\d{2}\/\d{3}/.test(searchTerm)) {
        handleFilterChange('reg_number', searchTerm);
      } else {
        handleFilterChange('student_name', searchTerm);
      }
    }
  };

  const clearFilters = () => {
    setFilters({});
    setSearchTerm('');
    onFilterChange({});
    loadFilterOptions(); // Reload all options
  };

  const activeFiltersCount = Object.keys(filters).filter(k => filters[k]).length;

  return (
    <Card className="w-full shadow-sm border border-border">
      <CardHeader className="pb-1 pt-2 px-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Filters</CardTitle>
            {activeFiltersCount > 0 && (
              <Badge variant="default" className="ml-2">
                {activeFiltersCount} active
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(!isOpen)}
            className="h-8 w-8"
          >
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
        <CardDescription className="text-[11px] leading-tight">
          Use cascading filters to narrow down your analytics for this workspace.
        </CardDescription>
      </CardHeader>

      {isOpen && (
        <CardContent className="px-3 pb-2 pt-1">
          <div className="flex items-end gap-2 overflow-x-auto pb-1">
            <div className="relative min-w-[280px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Access Number (A#####), Reg No, or Name"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10 h-9 text-xs"
              />
            </div>
            <Button onClick={handleSearch} className="gap-2 h-9 text-xs">
              <Search className="h-4 w-4" />
              Search
            </Button>
            <div className="min-w-[180px] space-y-1">
              <Label htmlFor="faculty" className="flex items-center gap-1 text-[11px]">
                <Building2 className="h-4 w-4 text-primary" />
                Faculty
              </Label>
              <Select
                id="faculty"
                value={filters.faculty_id || ''}
                onChange={(e) => handleFilterChange('faculty_id', e.target.value || null)}
                className="w-full h-9 text-xs"
              >
                <option value="">All Faculties</option>
                {filterOptions.faculties?.map((f) => (
                  <option key={f.faculty_id} value={f.faculty_id}>
                    {f.faculty_name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-[180px] space-y-1">
              <Label htmlFor="department" className="flex items-center gap-1 text-[11px]">
                <GraduationCap className="h-4 w-4 text-primary" />
                Department
              </Label>
              <Select
                id="department"
                value={filters.department_id || ''}
                onChange={(e) => handleFilterChange('department_id', e.target.value || null)}
                className="w-full h-9 text-xs"
                disabled={!filterOptions.departments || filterOptions.departments.length === 0}
              >
                <option value="">
                  {filters.faculty_id ? 'All Departments' : 'Select Faculty First'}
                </option>
                {filterOptions.departments?.map((d) => (
                  <option key={d.department_id} value={d.department_id}>
                    {d.department_name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-[180px] space-y-1">
              <Label htmlFor="program" className="flex items-center gap-1 text-[11px]">
                <BookOpen className="h-4 w-4 text-primary" />
                Program
              </Label>
              <Select
                id="program"
                value={filters.program_id || ''}
                onChange={(e) => handleFilterChange('program_id', e.target.value || null)}
                className="w-full h-9 text-xs"
                disabled={!filterOptions.programs || filterOptions.programs.length === 0}
              >
                <option value="">
                  {filters.department_id ? 'All Programs' : 'Select Department First'}
                </option>
                {filterOptions.programs?.map((p) => (
                  <option key={p.program_id} value={p.program_id}>
                    {p.program_name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-[180px] space-y-1">
              <Label htmlFor="course" className="flex items-center gap-1 text-[11px]">
                <BookOpen className="h-4 w-4 text-primary" />
                Course
              </Label>
              <Select
                id="course"
                value={filters.course_code || ''}
                onChange={(e) => handleFilterChange('course_code', e.target.value || null)}
                className="w-full h-9 text-xs"
                disabled={!filterOptions.courses || filterOptions.courses.length === 0}
              >
                <option value="">
                  {filters.program_id ? 'All Courses' : 'Select Program First'}
                </option>
                {filterOptions.courses?.map((c) => (
                  <option key={c.course_code} value={c.course_code}>
                    {c.course_name || c.course_code}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-[180px] space-y-1">
              <Label htmlFor="semester" className="flex items-center gap-1 text-[11px]">
                <Calendar className="h-4 w-4 text-primary" />
                Semester
              </Label>
              <Select
                id="semester"
                value={filters.semester_id || ''}
                onChange={(e) => handleFilterChange('semester_id', e.target.value || null)}
                className="w-full h-9 text-xs"
              >
                <option value="">All Semesters</option>
                {filterOptions.semesters?.map((s) => (
                  <option key={s.semester_id} value={s.semester_id}>
                    {s.semester_name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-[200px] space-y-1">
              <Label htmlFor="high_school" className="flex items-center gap-1 text-[11px]">
                <School className="h-4 w-4 text-primary" />
                High School
              </Label>
              <Select
                id="high_school"
                value={filters.high_school || ''}
                onChange={(e) => handleFilterChange('high_school', e.target.value || null)}
                className="w-full h-9 text-xs"
              >
                <option value="">All High Schools</option>
                {filterOptions.high_schools?.map((hs) => (
                  <option key={hs.high_school} value={hs.high_school}>
                    {hs.high_school}
                    {hs.high_school_district ? ` (${hs.high_school_district})` : ''}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-[150px] space-y-1 flex items-end gap-2">
              <div className="flex-1">
                <Label htmlFor="intake_year" className="flex items-center gap-1 text-[11px]">
                  <Users className="h-4 w-4 text-primary" />
                  Intake Year
                </Label>
                <Select
                  id="intake_year"
                  value={filters.intake_year || ''}
                  onChange={(e) => handleFilterChange('intake_year', e.target.value || null)}
                  className="w-full h-9 text-xs"
                >
                  <option value="">All intake years</option>
                  {filterOptions.intake_years?.map((year) => (
                    <option key={year} value={year}>
                      {formatIntakeYearLabel(year)}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                variant="outline"
                onClick={clearFilters}
                className="gap-2 h-9 text-xs min-w-[110px]"
                disabled={activeFiltersCount === 0}
              >
                <X className="h-4 w-4" />
                Clear All
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default GlobalFilterPanelShadcn;


