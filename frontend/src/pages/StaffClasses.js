/**
 * Staff Classes Page - Independent page for managing classes
 */
import React, { useState, useEffect } from 'react';
import { GraduationCap, Users, BookOpen, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import ExportButtons from '../components/ExportButtons';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

const StaffClasses = () => {
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [studentSearch, setStudentSearch] = useState('');

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/analytics/staff/classes', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setClasses(response.data.classes || []);
    } catch (err) {
      console.error('Error loading classes:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">My Classes</h1>
          <p className="text-sm text-muted-foreground">Manage your assigned courses and classes</p>
        </div>
        <ExportButtons stats={{ classes: classes.length }} filename="staff_classes" />
      </div>

      {classes.length > 0 ? (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls, idx) => (
            <Card 
              key={idx} 
              className="border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedClass(cls)}
            >
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  {cls.course_name || `Class ${idx + 1}`}
                </CardTitle>
                <CardDescription>{cls.course_code || 'N/A'}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{cls.student_count || 0} students</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Schedule: {cls.schedule || 'TBA'}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border shadow-sm">
          <CardContent className="py-8">
            <div className="text-center text-sm text-muted-foreground">
              <GraduationCap className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
              <p>No classes assigned</p>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedClass && (
        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base font-semibold">{selectedClass.course_name}</CardTitle>
            <CardDescription className="text-xs">Class details and student management</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="Search students..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="flex-1"
              />
              <Button>
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>
            <div className="text-center py-8 text-muted-foreground">
              Student list for {selectedClass.course_name}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StaffClasses;






