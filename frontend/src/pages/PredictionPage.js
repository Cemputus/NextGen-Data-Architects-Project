/**
 * Prediction Page - role-aware prediction workspace
 */
import React, { useState, useEffect } from 'react';
import { Brain, UserCheck, Info, AlertTriangle, Activity, Cpu, LineChart, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { PageHeader, PageContent } from '../components/ui/page-header';
import { LoadingState } from '../components/ui/state-messages';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { usePredictionWorkspace } from '../context/PredictionWorkspaceContext';

const PredictionPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const {
    predictions,
    setPredictions,
    selectedScenario,
    setSelectedScenario,
    studentIdentifier,
    setStudentIdentifier,
    modelType,
    setModelType,
  } = usePredictionWorkspace();
  const [scenarios, setScenarios] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadScenarios();
    // Pre-fill student identifier for students only when no persisted draft
    if (user?.role === 'student' && user?.access_number) {
      setStudentIdentifier((current) => (current && String(current).trim() ? current : user.access_number));
      // For students, default to tuition+attendance model
      setModelType('tuition_attendance');
    }
  }, []);

  const loadScenarios = async () => {
    try {
      const response = await axios.get('/api/predictions/scenarios', {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` }
      });
      setScenarios(response.data.scenarios || []);
    } catch (err) {
      console.error('Error loading scenarios:', err);
    }
  };

  const handlePredict = async () => {
    if (!studentIdentifier) {
      setErrorMessage('Please enter a student identifier first.');
      return;
    }

    setErrorMessage('');
    setLoading(true);
    try {
      let endpoint = '/api/predictions/predict';
      let payload = {
        student_id: studentIdentifier,
        model_type: modelType
      };

      if (modelType === 'tuition_attendance') {
        endpoint = '/api/predictions/tuition-attendance-performance';
        payload = { student_id: studentIdentifier };
      }

      const response = await axios.post(endpoint, payload, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` }
      });

      setPredictions({
        single: response.data,
        scenarios: null
      });
    } catch (err) {
      console.error('Prediction error:', err);
      let msg = 'Failed to generate prediction. Please try again.';
      const raw = err.response?.data?.error || err.message || '';
      if (raw.includes('Permission denied: Can only predict own performance')) {
        msg = 'You can only generate predictions for your own record. Log in as the correct student and try again.';
      } else if (raw.includes('Network Error')) {
        msg = 'The prediction service is temporarily unavailable. Please try again shortly.';
      } else if (raw) {
        msg = raw;
      }
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleScenarioPredict = async (scenario) => {
    if (!studentIdentifier) {
      setErrorMessage('Please enter a student identifier first.');
      return;
    }
    
    setLoading(true);
    setSelectedScenario(scenario);
    try {
      const response = await axios.post('/api/predictions/scenario', {
        student_id: studentIdentifier,
        scenario: scenario.parameters || scenario.params || {}
      }, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('ucu_session_token')}` }
      });

      setPredictions({
        single: null,
        scenarios: response.data
      });
    } catch (err) {
      console.error('Scenario prediction error:', err);
      let msg = 'Failed to generate scenario prediction. Please try again.';
      const raw = err.response?.data?.error || err.message || '';
      if (raw.includes('Network Error')) {
        msg = 'The prediction service is temporarily unavailable. Please try again shortly.';
      } else if (raw) {
        msg = raw;
      }
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const getGradeTone = (grade) => {
    if (grade >= 80) return 'border-green-200 bg-green-50 text-green-700';
    if (grade >= 70) return 'border-blue-200 bg-blue-50 text-blue-700';
    if (grade >= 60) return 'border-amber-200 bg-amber-50 text-amber-700';
    if (grade >= 50) return 'border-orange-200 bg-orange-50 text-orange-700';
    return 'border-rose-200 bg-rose-50 text-rose-700';
  };

  const getGradeBadgeTone = (grade) => {
    if (grade >= 80) return 'bg-green-100 text-green-700 border-green-300';
    if (grade >= 70) return 'bg-blue-100 text-blue-700 border-blue-300';
    if (grade >= 60) return 'bg-amber-100 text-amber-700 border-amber-300';
    if (grade >= 50) return 'bg-orange-100 text-orange-700 border-orange-300';
    return 'bg-rose-100 text-rose-700 border-rose-300';
  };

  const getRiskColor = (riskLevel) => {
    if (riskLevel === 'high') return 'border-red-500 bg-red-50';
    if (riskLevel === 'medium-high') return 'border-orange-500 bg-orange-50';
    if (riskLevel === 'low') return 'border-green-500 bg-green-50';
    return 'border-yellow-500 bg-yellow-50';
  };

  const renderStudentMeta = (row, title = 'Student record') => {
    if (!row) return null;
    const name = row.student_name || row.student?.student_name;
    const access = row.access_number ?? row.student?.access_number;
    const reg = row.reg_number ?? row.student?.reg_number;
    const faculty = row.faculty_name ?? row.student?.faculty_name;
    const dept = row.department_name ?? row.student?.department_name;
    const program = row.program_name ?? row.student?.program_name;
    const sid = row.student_id;
    if (!name && !access && !reg && !faculty && !dept && !program && !sid) return null;
    return (
      <div className="rounded-md border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {name && (
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{name}</dd>
            </div>
          )}
          {access && (
            <div>
              <dt className="text-muted-foreground">Access number</dt>
              <dd className="font-medium">{access}</dd>
            </div>
          )}
          {reg && (
            <div>
              <dt className="text-muted-foreground">Registration number</dt>
              <dd className="font-medium">{reg}</dd>
            </div>
          )}
          {faculty && (
            <div>
              <dt className="text-muted-foreground">Faculty</dt>
              <dd className="font-medium">{faculty}</dd>
            </div>
          )}
          {dept && (
            <div>
              <dt className="text-muted-foreground">Department</dt>
              <dd className="font-medium">{dept}</dd>
            </div>
          )}
          {program && (
            <div>
              <dt className="text-muted-foreground">Program</dt>
              <dd className="font-medium">{program}</dd>
            </div>
          )}
          {sid && (
            <div>
              <dt className="text-muted-foreground">Student ID</dt>
              <dd className="font-medium font-mono text-xs">{sid}</dd>
            </div>
          )}
        </dl>
      </div>
    );
  };

  const canUseScenarios = ['analyst', 'sysadmin', 'senate'].includes(user?.role);
  const isStudent = user?.role === 'student';

  // Restrict prediction models for students to high-level, student-friendly options only
  const modelOptions = isStudent
    ? [
        { value: 'tuition_attendance', label: 'Tuition & Attendance → Performance' },
      ]
    : [
        { value: 'ensemble', label: 'Standard Performance (Ensemble)' },
        { value: 'tuition_attendance', label: 'Tuition & Attendance → Performance' },
        { value: 'random_forest', label: 'Random Forest' },
        { value: 'gradient_boosting', label: 'Gradient Boosting' },
        { value: 'neural_network', label: 'Neural Network' },
      ];

  // Ensure current modelType is always one of the allowed options
  useEffect(() => {
    const allowedValues = modelOptions.map((m) => m.value);
    if (!allowedValues.includes(modelType)) {
      setModelType(allowedValues[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  if (loading && !predictions) {
    return (
      <PageContent>
        <PageHeader
          title="Performance Prediction"
          description="Scenario‑aware predictions for the current semester, combining tuition, attendance, and performance history."
        />
        <LoadingState message="Analyzing student data..." />
      </PageContent>
    );
  }

  return (
    <PageContent>
      <PageHeader
        title="Performance Prediction"
        description="Role-aware prediction workspace for academic performance forecasting and scenario impact analysis."
      />

      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Prediction Configuration
          </CardTitle>
          <CardDescription>Provide student identity and model type to generate a forecast.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {errorMessage && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-muted-foreground" />
                {user?.role === 'student' ? 'Your Access Number' : 'Student Identifier'}
              </label>
              <Input
                value={studentIdentifier}
                onChange={(e) => setStudentIdentifier(e.target.value)}
                placeholder={user?.role === 'student' ? 'A#####' : 'A26143, A25176, A75239, or Student ID'}
                disabled={user?.role === 'student'}
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />
                {user?.role === 'student' 
                  ? 'You can only predict your own performance'
                  : 'Sample IDs: A26143, A25176, A75239, A53078, A34331 (or use Student ID like J21B05/001)'}
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="prediction-model-select" className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Cpu className="h-4 w-4 text-muted-foreground" />
                Prediction Model
              </label>
              <Select 
                id="prediction-model-select"
                value={modelType} 
                onChange={(e) => setModelType(e.target.value)}
              >
                {modelOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                {isStudent
                  ? 'Choose how you want your own performance to be predicted.'
                  : 'Select the ML model for prediction.'}
              </p>
            </div>

            <div className="flex items-end">
              <Button
                onClick={handlePredict}
                disabled={loading || !studentIdentifier}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  'Generate Prediction'
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {predictions?.single && (
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle>Prediction Result</CardTitle>
            <CardDescription>Model output for the selected student and model configuration.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
              <div className={`rounded-md border px-4 py-4 md:col-span-2 ${getGradeTone(predictions.single.predicted_grade)}`}>
                <p className="text-xs font-semibold uppercase tracking-wide">Predicted score (%)</p>
                <p className="mt-2 text-4xl font-semibold">{predictions.single.predicted_grade}</p>
                <Badge className={`mt-2 ${getGradeBadgeTone(predictions.single.predicted_grade)}`}>
                  {predictions.single.predicted_letter_grade}
                </Badge>
              </div>
              <div className="rounded-md border px-4 py-4 bg-muted/30">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">GPA (scale max {predictions.single.gpa_scale_max ?? 5})</p>
                <p className="mt-2 text-3xl font-semibold">
                  {predictions.single.gpa != null ? Number(predictions.single.gpa).toFixed(2) : '—'}
                </p>
              </div>
              <div className="rounded-md border px-4 py-4 bg-muted/30">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Model</p>
                <p className="mt-2 text-lg font-semibold capitalize">{predictions.single.model_type?.replace('_', ' ') || 'Standard'}</p>
              </div>
            </div>

            <div className="mt-4">{renderStudentMeta(predictions.single)}</div>

            {(predictions.single.payment_completion_rate !== undefined || predictions.single.attendance_rate !== undefined) && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {predictions.single.payment_completion_rate !== undefined && (
                  <div className="rounded-md border p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment Completion</p>
                    <p className="mt-2 text-2xl font-semibold">{predictions.single.payment_completion_rate.toFixed(1)}%</p>
                  </div>
                )}
                {predictions.single.attendance_rate !== undefined && (
                  <div className="rounded-md border p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attendance Rate</p>
                    <p className="mt-2 text-2xl font-semibold">{predictions.single.attendance_rate.toFixed(1)}%</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {canUseScenarios && (
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle>Scenario Analysis</CardTitle>
            <CardDescription>Run predefined what-if scenarios and compare model outputs.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="scenarios" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="scenarios" className="flex items-center gap-2">
                  <LineChart className="h-4 w-4" />
                  Scenario Output
                </TabsTrigger>
                <TabsTrigger value="predefined" className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Templates
                </TabsTrigger>
              </TabsList>

              <TabsContent value="scenarios" className="space-y-4">
                {predictions?.scenarios ? (
                  <div className="space-y-4">
                    {renderStudentMeta(predictions.scenarios, 'Student')}

                    <div className="rounded-md border p-4 bg-muted/30">
                      <h3 className="text-base font-semibold">{predictions.scenarios.scenario.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{predictions.scenarios.scenario.description}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      {Object.entries(predictions.scenarios.predictions).map(([model, pred]) => (
                        <div key={model} className={`rounded-md border p-4 ${getGradeTone(pred.predicted_grade)}`}>
                          <p className="text-xs font-semibold uppercase tracking-wide">{model.replace(/_/g, ' ')}</p>
                          <p className="mt-2 text-2xl font-semibold">{pred.predicted_grade}%</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            GPA {pred.gpa != null ? Number(pred.gpa).toFixed(2) : '—'} / {pred.gpa_scale_max ?? 5}
                          </p>
                          <Badge className={`mt-2 ${getGradeBadgeTone(pred.predicted_grade)}`}>
                            {pred.predicted_letter_grade}
                          </Badge>
                        </div>
                      ))}
                    </div>

                    {predictions.scenarios.analysis && (
                      <div className={`rounded-md border p-4 ${getRiskColor(predictions.scenarios.analysis.risk_level)}`}>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          <p className="text-sm font-semibold">
                            Risk Level: {predictions.scenarios.analysis.risk_level}
                          </p>
                        </div>
                        <div className="mt-3 space-y-2">
                          {(predictions.scenarios.analysis.recommendations || []).map((rec, idx) => (
                            <p key={idx} className="text-sm">- {rec}</p>
                          ))}
                        </div>
                        {predictions.scenarios.analysis.key_factors && predictions.scenarios.analysis.key_factors.length > 0 && (
                          <p className="mt-3 text-xs text-muted-foreground">
                            Key Factors: {predictions.scenarios.analysis.key_factors.join(', ')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
                    No scenario output yet. Select a template to run analysis.
                  </div>
                )}
              </TabsContent>

              <TabsContent value="predefined" className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {scenarios.map((scenario) => (
                    <div key={scenario.id} className="rounded-md border p-4 bg-card">
                      <h4 className="font-semibold">{scenario.name}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{scenario.description}</p>
                      <Button
                        size="sm"
                        className="mt-3 w-full"
                        disabled={loading}
                        onClick={() => handleScenarioPredict(scenario)}
                      >
                        {loading && selectedScenario?.id === scenario.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Running...
                          </>
                        ) : (
                          'Run Scenario'
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {!canUseScenarios && (
        <Card className="border border-blue-200 bg-blue-50">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">Scenario Analysis Restricted</h3>
                <p className="text-sm text-blue-700">
                  Scenario analysis is available for Analyst, System Administrator, and Senate roles.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </PageContent>
  );
};
export default PredictionPage;
