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
  Users,
  Sparkles
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { cn } from '../lib/utils';
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

  // Load filter options with cascading support
  const loadFilterOptions = async (facultyId = null, departmentId = null) => {
    setLoading(true);
    const params = {};
    if (facultyId) params.faculty_id = facultyId;
    if (departmentId) params.department_id = departmentId;
    
    try {
      const res = await axios.get('/api/analytics/filter-options', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params
      });
      setFilterOptions(res.data);
      
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

  useEffect(() => {
    // Initial load
    loadFilterOptions();
  }, []);

  // Reload options when faculty or department changes
  useEffect(() => {
    const facultyId = filters.faculty_id ? parseInt(filters.faculty_id) : null;
    const departmentId = filters.department_id ? parseInt(filters.department_id) : null;
    if (facultyId || departmentId) {
      loadFilterOptions(facultyId, departmentId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.faculty_id, filters.department_id]);

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
    <Card className="w-full shadow-lg border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            <CardTitle className="text-xl">Advanced Filters</CardTitle>
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
        <CardDescription>
          Use cascading filters to narrow down your analytics. Filters sync automatically.
        </CardDescription>
      </CardHeader>

      {isOpen && (
        <CardContent className="space-y-4">
          {/* Search Bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Access Number (A#####), Reg No, or Name"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} className="gap-2">
              <Search className="h-4 w-4" />
              Search
            </Button>
          </div>

          {/* Filter Controls - Cascading */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Faculty Filter */}
            <div className="space-y-2">
              <Label htmlFor="faculty" className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Faculty
              </Label>
              <Select
                id="faculty"
                value={filters.faculty_id || ''}
                onChange={(e) => handleFilterChange('faculty_id', e.target.value || null)}
                className="w-full"
              >
                <option value="">All Faculties</option>
                {filterOptions.faculties?.map(f => (
                  <option key={f.faculty_id} value={f.faculty_id}>
                    {f.faculty_name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Department Filter - Cascades from Faculty */}
            <div className="space-y-2">
              <Label htmlFor="department" className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-primary" />
                Department
              </Label>
              <Select
                id="department"
                value={filters.department_id || ''}
                onChange={(e) => handleFilterChange('department_id', e.target.value || null)}
                className="w-full"
                disabled={!filters.faculty_id && filterOptions.departments?.length > 0}
              >
                <option value="">{filters.faculty_id ? 'All Departments' : 'Select Faculty First'}</option>
                {filterOptions.departments?.map(d => (
                  <option key={d.department_id} value={d.department_id}>
                    {d.department_name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Program Filter - Cascades from Department */}
            <div className="space-y-2">
              <Label htmlFor="program" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                Program
              </Label>
              <Select
                id="program"
                value={filters.program_id || ''}
                onChange={(e) => handleFilterChange('program_id', e.target.value || null)}
                className="w-full"
                disabled={!filters.department_id && filterOptions.programs?.length > 0}
              >
                <option value="">{filters.department_id ? 'All Programs' : 'Select Department First'}</option>
                {filterOptions.programs?.map(p => (
                  <option key={p.program_id} value={p.program_id}>
                    {p.program_name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Semester Filter */}
            <div className="space-y-2">
              <Label htmlFor="semester" className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Semester
              </Label>
              <Select
                id="semester"
                value={filters.semester_id || ''}
                onChange={(e) => handleFilterChange('semester_id', e.target.value || null)}
                className="w-full"
              >
                <option value="">All Semesters</option>
                {filterOptions.semesters?.map(s => (
                  <option key={s.semester_id} value={s.semester_id}>
                    {s.semester_name}
                  </option>
                ))}
              </Select>
            </div>

            {/* High School Filter */}
            <div className="space-y-2">
              <Label htmlFor="high_school" className="flex items-center gap-2">
                <School className="h-4 w-4 text-primary" />
                High School
              </Label>
              <Select
                id="high_school"
                value={filters.high_school || ''}
                onChange={(e) => handleFilterChange('high_school', e.target.value || null)}
                className="w-full"
              >
                <option value="">All High Schools</option>
                {filterOptions.high_schools?.map(hs => (
                  <option key={hs.high_school} value={hs.high_school}>
                    {hs.high_school} {hs.high_school_district ? `(${hs.high_school_district})` : ''}
                  </option>
                ))}
              </Select>
            </div>

            {/* Intake Year Filter */}
            <div className="space-y-2">
              <Label htmlFor="intake_year" className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Intake Year
              </Label>
              <Select
                id="intake_year"
                value={filters.intake_year || ''}
                onChange={(e) => handleFilterChange('intake_year', e.target.value || null)}
                className="w-full"
              >
                <option value="">All Years</option>
                {filterOptions.intake_years?.map(year => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4" />
              <span>Filters automatically sync when parent selections change</span>
            </div>
            <Button
              variant="outline"
              onClick={clearFilters}
              className="gap-2"
              disabled={activeFiltersCount === 0}
            >
              <X className="h-4 w-4" />
              Clear All
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default GlobalFilterPanelShadcn;


