/**
 * Global Filter Panel - Smooth, Professional UI with Synced Filters
 * Filters sync: selecting faculty filters departments, selecting department filters programs
 */
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, X, Filter, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select } from './ui/select';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import axios from 'axios';
import { loadFilters, saveFilters, loadSearchTerm, saveSearchTerm } from '../utils/statePersistence';

const GlobalFilterPanel = ({ onFilterChange, savedFilters = [], pageName = 'global' }) => {
  // Load persisted filters and search term
  const savedFiltersState = loadFilters(pageName, savedFilters || {});
  const savedSearch = loadSearchTerm(pageName, '');
  
  const [filters, setFilters] = useState(savedFiltersState);
  const [filterOptions, setFilterOptions] = useState({
    faculties: [],
    departments: [],
    programs: [],
    courses: [],
    semesters: [],
    high_schools: [],
    intake_years: [],
  });
  const [searchTerm, setSearchTerm] = useState(savedSearch);
  const [loading, setLoading] = useState(false);

  // Load filter options with current filter values for syncing
  const loadFilterOptions = async (currentFilters = {}) => {
    setLoading(true);
    try {
      const params = {};
      if (currentFilters.faculty_id) params.faculty_id = currentFilters.faculty_id;
      if (currentFilters.department_id) params.department_id = currentFilters.department_id;
      if (currentFilters.program_id) params.program_id = currentFilters.program_id;
      
      const res = await axios.get('/api/analytics/filter-options', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params
      });
      setFilterOptions(res.data);
    } catch (err) {
      console.error('Error loading filter options:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load filter options on initial mount with saved filters
  useEffect(() => {
    loadFilterOptions(filters);
  }, []); // Only run on mount

  // Reload filter options when parent filters change
  useEffect(() => {
    loadFilterOptions(filters);
  }, [filters.faculty_id, filters.department_id, filters.program_id]);
  
  // Notify parent of initial filters on mount
  useEffect(() => {
    if (Object.keys(filters).length > 0) {
      onFilterChange(filters);
    }
  }, []); // Only on mount

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters };
    
    // Clear child filters when parent changes
    if (key === 'faculty_id') {
      // Clear department and program when faculty changes
      delete newFilters.department_id;
      delete newFilters.program_id;
      delete newFilters.course_code; // Also clear course when faculty changes
    } else if (key === 'department_id') {
      // Clear program and course when department changes
      delete newFilters.program_id;
      delete newFilters.course_code;
    } else if (key === 'program_id') {
      // Clear course when program changes (optional - you may want to keep this)
      // delete newFilters.course_code;
    }
    
    if (value === '' || value === null) {
      delete newFilters[key];
    } else {
      newFilters[key] = value;
    }
    
    setFilters(newFilters);
    onFilterChange(newFilters);
    
    // Save filters to localStorage
    saveFilters(pageName, newFilters);
    
    // Reload filter options after a short delay to allow state to update
    setTimeout(() => {
      loadFilterOptions(newFilters);
    }, 100);
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
    setFilters({});
    setSearchTerm('');
    onFilterChange({});
    loadFilterOptions({});
  };

  const activeFiltersCount = Object.keys(filters).filter(k => filters[k]).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="mb-6 border-0 shadow-xl bg-white/90 backdrop-blur-sm hover:shadow-2xl transition-all duration-300">
        <CardContent className="p-6">
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg">
                  <Filter className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Filters</h3>
                  <p className="text-sm text-muted-foreground">Synced filters - selections cascade automatically</p>
                </div>
              </div>
              {activeFiltersCount > 0 && (
                <Badge className="bg-blue-100 text-blue-700 border-blue-200 px-3 py-1">
                  {activeFiltersCount} active
                </Badge>
              )}
            </div>

            {/* Search Bar */}
            <div className="flex gap-3">
              <div className="relative flex-1 group">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                <Input
                  placeholder="Search by Access Number, Reg No, or Name"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-12 h-12 text-base border-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg shadow-sm hover:shadow-md transition-all"
                />
              </div>
              <Button 
                onClick={handleSearch} 
                size="default" 
                className="h-12 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all"
              >
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>

            {/* Filter Grid - Synced Filters */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
              <Select
                value={filters.faculty_id || ''}
                onChange={(e) => handleFilterChange('faculty_id', e.target.value || null)}
                disabled={loading}
                className="h-11 border-2 rounded-lg shadow-sm hover:shadow-md transition-all focus:border-blue-500"
              >
                <option value="">All Faculties</option>
                {filterOptions.faculties?.map((f, idx) => (
                  <option key={`faculty-${f.faculty_id}-${idx}`} value={f.faculty_id}>
                    {f.faculty_name}
                  </option>
                ))}
              </Select>

              <Select
                value={filters.department_id || ''}
                onChange={(e) => handleFilterChange('department_id', e.target.value || null)}
                disabled={loading || !filters.faculty_id}
                className={`h-11 border-2 rounded-lg shadow-sm hover:shadow-md transition-all focus:border-blue-500 ${
                  !filters.faculty_id ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <option value="">
                  {filters.faculty_id ? 'All Departments' : 'Select Faculty First'}
                </option>
                {filterOptions.departments?.map((d, idx) => (
                  <option key={`dept-${d.department_id || idx}`} value={d.department_id}>
                    {d.department_name}
                  </option>
                ))}
              </Select>

              <Select
                value={filters.program_id || ''}
                onChange={(e) => handleFilterChange('program_id', e.target.value || null)}
                disabled={loading || !filters.faculty_id}
                className={`h-11 border-2 rounded-lg shadow-sm hover:shadow-md transition-all focus:border-blue-500 ${
                  !filters.faculty_id ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <option value="">
                  {filters.faculty_id ? 'All Programs' : 'Select Faculty First'}
                </option>
                {filterOptions.programs?.map((p, idx) => (
                  <option key={`prog-${p.program_id || idx}`} value={p.program_id}>
                    {p.program_name}
                  </option>
                ))}
              </Select>

              <Select
                value={filters.course_code || ''}
                onChange={(e) => handleFilterChange('course_code', e.target.value || null)}
                disabled={loading}
                className="h-11 border-2 rounded-lg shadow-sm hover:shadow-md transition-all focus:border-blue-500"
              >
                <option value="">All Courses</option>
                {filterOptions.courses?.map((c, idx) => (
                  <option key={`course-${c.course_code || idx}`} value={c.course_code}>
                    {c.course_code} - {c.course_name?.substring(0, 40) || ''}
                  </option>
                ))}
              </Select>

              <Select
                value={filters.semester_id || ''}
                onChange={(e) => handleFilterChange('semester_id', e.target.value || null)}
                disabled={loading}
                className="h-11 border-2 rounded-lg shadow-sm hover:shadow-md transition-all focus:border-blue-500"
              >
                <option value="">All Semesters</option>
                {filterOptions.semesters?.map((s, idx) => (
                  <option key={`sem-${s.semester_id || idx}`} value={s.semester_id}>
                    {s.semester_name}
                  </option>
                ))}
              </Select>

              <Select
                value={filters.high_school || ''}
                onChange={(e) => handleFilterChange('high_school', e.target.value || null)}
                disabled={loading}
                className="h-11 border-2 rounded-lg shadow-sm hover:shadow-md transition-all focus:border-blue-500"
              >
                <option value="">All High Schools</option>
                {filterOptions.high_schools?.map((hs, idx) => (
                  <option key={`hs-${idx}-${hs.high_school || idx}`} value={hs.high_school}>
                    {hs.high_school}
                  </option>
                ))}
              </Select>

              <Select
                value={filters.intake_year || ''}
                onChange={(e) => handleFilterChange('intake_year', e.target.value || null)}
                disabled={loading}
                className="h-11 border-2 rounded-lg shadow-sm hover:shadow-md transition-all focus:border-blue-500"
              >
                <option value="">All Years</option>
                {filterOptions.intake_years?.map((year, idx) => (
                  <option key={`year-${year || idx}`} value={year}>
                    {year}
                  </option>
                ))}
              </Select>
            </div>

            {/* Active Filters & Clear */}
            {activeFiltersCount > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-center justify-between pt-4 border-t border-gray-200"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-700">Active filters:</span>
                  {Object.entries(filters).map(([key, value], idx) => {
                    if (!value) return null;
                    const displayValue = filterOptions.faculties?.find(f => f.faculty_id == value)?.faculty_name ||
                                         filterOptions.departments?.find(d => d.department_id == value)?.department_name ||
                                         filterOptions.programs?.find(p => p.program_id == value)?.program_name ||
                                         value;
                    return (
                      <Badge
                        key={`filter-${key}-${value}-${idx}`}
                        variant="secondary"
                        className="gap-1 pr-1 bg-blue-100 text-blue-700 border-blue-200 font-medium"
                      >
                        {key.replace('_', ' ')}: {displayValue}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 p-0 ml-1 hover:bg-blue-200 rounded-full"
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
                  className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-medium"
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
