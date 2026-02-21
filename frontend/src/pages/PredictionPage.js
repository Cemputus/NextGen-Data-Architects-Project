/**
 * Prediction Page - Multi-model predictions with scenario analysis
 * Matches styling pattern used across all other pages
 */
import React, { useState, useEffect } from 'react';
import { 
  Brain,
  Sparkles,
  TrendingUp,
  Users,
  Lightbulb,
  GraduationCap,
  DollarSign,
  UserCheck,
  Info,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Target,
  Activity,
  Rocket,
  Cpu,
  LineChart,
  Loader2,
} from 'lucide-react';
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

const PredictionPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [predictions, setPredictions] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [studentIdentifier, setStudentIdentifier] = useState('');
  const [modelType, setModelType] = useState('ensemble');

  useEffect(() => {
    loadScenarios();
    // Pre-fill student identifier for students
    if (user?.role === 'student' && user?.access_number) {
      setStudentIdentifier(user.access_number);
    }
  }, []);

  const loadScenarios = async () => {
    try {
      const response = await axios.get('/api/predictions/scenarios', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setScenarios(response.data.scenarios || []);
    } catch (err) {
      console.error('Error loading scenarios:', err);
    }
  };

  const handlePredict = async () => {
    if (!studentIdentifier) {
      return;
    }

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
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      setPredictions({
        single: response.data,
        scenarios: null
      });
    } catch (err) {
      console.error('Prediction error:', err);
      alert(err.response?.data?.error || 'Failed to generate prediction');
    } finally {
      setLoading(false);
    }
  };

  const handleScenarioPredict = async (scenario) => {
    if (!studentIdentifier) {
      alert('Please enter a student identifier first');
      return;
    }
    
    setLoading(true);
    setSelectedScenario(scenario);
    try {
      const response = await axios.post('/api/predictions/scenario', {
        student_id: studentIdentifier,
        scenario: scenario.parameters || scenario.params || {}
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      setPredictions({
        single: null,
        scenarios: response.data
      });
    } catch (err) {
      console.error('Scenario prediction error:', err);
      alert(err.response?.data?.error || 'Failed to generate scenario prediction');
    } finally {
      setLoading(false);
    }
  };

  const getGradeColor = (grade) => {
    if (grade >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (grade >= 70) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (grade >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (grade >= 50) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getGradeBadgeColor = (grade) => {
    if (grade >= 80) return 'bg-green-100 text-green-700 border-green-300';
    if (grade >= 70) return 'bg-blue-100 text-blue-700 border-blue-300';
    if (grade >= 60) return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    if (grade >= 50) return 'bg-orange-100 text-orange-700 border-orange-300';
    return 'bg-red-100 text-red-700 border-red-300';
  };

  const getRiskColor = (riskLevel) => {
    if (riskLevel === 'high') return 'border-red-500 bg-red-50';
    if (riskLevel === 'medium-high') return 'border-orange-500 bg-orange-50';
    if (riskLevel === 'low') return 'border-green-500 bg-green-50';
    return 'border-yellow-500 bg-yellow-50';
  };

  const canUseScenarios = ['analyst', 'sysadmin', 'senate'].includes(user?.role);

  if (loading && !predictions) {
    return (
      <PageContent>
        <PageHeader title="Performance Prediction" description="Predict student performance using multiple ML models" />
        <LoadingState message="Analyzing student data..." />
      </PageContent>
    );
  }

  return (
    <PageContent>
      <PageHeader title="Performance Prediction" description="Predict student performance using multiple ML models" />

      {/* Prediction Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            Prediction Configuration
          </CardTitle>
          <CardDescription>Configure your prediction parameters below</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-blue-500" />
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
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Cpu className="h-4 w-4 text-purple-500" />
                Prediction Model
              </label>
              <Select 
                value={modelType} 
                onChange={(e) => setModelType(e.target.value)}
              >
                <option value="ensemble">🎯 Standard Performance (Ensemble)</option>
                <option value="tuition_attendance">💰 Tuition + Attendance → Performance</option>
                <option value="random_forest">🌲 Random Forest</option>
                <option value="gradient_boosting">📈 Gradient Boosting</option>
                <option value="neural_network">🧠 Neural Network</option>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select the ML model for prediction
              </p>
            </div>

            <div className="flex items-end">
              <Button
                onClick={handlePredict}
                disabled={loading || !studentIdentifier}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Prediction
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {predictions?.single && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Prediction Results
                </CardTitle>
                <CardDescription>AI-generated performance prediction</CardDescription>
              </div>
              <Badge className="bg-green-100 text-green-700 border-green-300 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Analysis Complete
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Predicted Grade - Hero Card */}
              <Card className={`${getGradeColor(predictions.single.predicted_grade)} border-2 col-span-1 md:col-span-2 lg:col-span-2`}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <GraduationCap className="h-5 w-5" />
                    <h3 className="text-sm font-semibold">Predicted Grade</h3>
                  </div>
                  <div className="text-5xl font-bold mb-2">
                    {predictions.single.predicted_grade}
                  </div>
                  <Badge className={getGradeBadgeColor(predictions.single.predicted_grade)}>
                    {predictions.single.predicted_letter_grade}
                  </Badge>
                </CardContent>
              </Card>

              {/* Model Used */}
              <Card className="border-2">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Cpu className="h-5 w-5 text-gray-600" />
                    <h3 className="text-sm font-semibold text-gray-700">Model Used</h3>
                  </div>
                  <div className="text-xl font-bold text-gray-800 capitalize">
                    {predictions.single.model_type?.replace('_', ' ') || 'Standard'}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Machine Learning Algorithm</p>
                </CardContent>
              </Card>

              {/* Payment Completion (if available) */}
              {predictions.single.payment_completion_rate !== undefined && (
                <Card className="border-2 border-orange-200 bg-orange-50">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <DollarSign className="h-5 w-5 text-orange-600" />
                      <h3 className="text-sm font-semibold text-gray-700">Payment Completion</h3>
                    </div>
                    <div className="text-2xl font-bold text-orange-700 mb-2">
                      {predictions.single.payment_completion_rate.toFixed(1)}%
                    </div>
                    <div className="w-full bg-orange-200 rounded-full h-2">
                      <div 
                        className="bg-orange-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${predictions.single.payment_completion_rate}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Attendance Rate (if available) */}
              {predictions.single.attendance_rate !== undefined && (
                <Card className="border-2 border-teal-200 bg-teal-50">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Activity className="h-5 w-5 text-teal-600" />
                      <h3 className="text-sm font-semibold text-gray-700">Attendance Rate</h3>
                    </div>
                    <div className="text-2xl font-bold text-teal-700 mb-2">
                      {predictions.single.attendance_rate.toFixed(1)}%
                    </div>
                    <div className="w-full bg-teal-200 rounded-full h-2">
                      <div 
                        className="bg-teal-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${predictions.single.attendance_rate}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Student ID */}
              <Card className="border-2 border-purple-200 bg-purple-50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <UserCheck className="h-5 w-5 text-purple-600" />
                    <h3 className="text-sm font-semibold text-gray-700">Student ID</h3>
                  </div>
                  <div className="text-lg font-bold text-purple-700">
                    {predictions.single.student_id}
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scenario Analysis */}
      {canUseScenarios && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-purple-600" />
              Scenario Analysis
            </CardTitle>
            <CardDescription>Analyze different scenarios and their impact on performance</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="scenarios" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="scenarios" className="flex items-center gap-2">
                  <LineChart className="h-4 w-4" />
                  Scenario Analysis
                </TabsTrigger>
                <TabsTrigger value="predefined" className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  Predefined Scenarios
                </TabsTrigger>
              </TabsList>

              <TabsContent value="scenarios" className="space-y-4">
                {predictions?.scenarios ? (
                  <div className="space-y-6">
                    <Card className="border-2 border-purple-200 bg-purple-50">
                      <CardHeader>
                        <CardTitle className="text-lg">{predictions.scenarios.scenario.name}</CardTitle>
                        <CardDescription>{predictions.scenarios.scenario.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          {Object.entries(predictions.scenarios.predictions).map(([model, pred]) => (
                            <Card key={model} className={`${getGradeColor(pred.predicted_grade)} border-2`}>
                              <CardContent className="p-4">
                                <h4 className="text-xs font-semibold mb-2 capitalize">
                                  {model.replace(/_/g, ' ')}
                                </h4>
                                <div className="text-2xl font-bold mb-2">
                                  {pred.predicted_grade}
                                </div>
                                <Badge className={getGradeBadgeColor(pred.predicted_grade)}>
                                  {pred.predicted_letter_grade}
                                </Badge>
                              </CardContent>
                            </Card>
                          ))}
                        </div>

                        {predictions.scenarios.analysis && (
                          <Card className={`mt-4 border-2 ${getRiskColor(predictions.scenarios.analysis.risk_level)}`}>
                            <CardHeader>
                              <CardTitle className="text-lg flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5" />
                                Risk Level: <Badge>{predictions.scenarios.analysis.risk_level}</Badge>
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm mb-2">Recommendations:</h4>
                                {predictions.scenarios.analysis.recommendations.map((rec, idx) => (
                                  <div key={idx} className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                    <p className="text-sm flex-1">{rec}</p>
                                  </div>
                                ))}
                              </div>
                              {predictions.scenarios.analysis.key_factors && predictions.scenarios.analysis.key_factors.length > 0 && (
                                <div className="mt-4 pt-4 border-t">
                                  <p className="text-xs text-muted-foreground">
                                    <strong>Key Factors:</strong> {predictions.scenarios.analysis.key_factors.join(', ')}
                                  </p>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Lightbulb className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-semibold mb-2">No Scenario Analysis Yet</p>
                    <p className="text-sm">Select a predefined scenario below to generate predictions</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="predefined" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {scenarios.map((scenario) => (
                    <Card 
                      key={scenario.id} 
                      className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-purple-300"
                      onClick={() => handleScenarioPredict(scenario)}
                    >
                      <CardHeader>
                        <div className="flex items-center justify-between mb-2">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <Lightbulb className="h-5 w-5 text-purple-600" />
                          </div>
                          <Badge className="bg-purple-100 text-purple-700 border-purple-300">
                            Scenario
                          </Badge>
                        </div>
                        <CardTitle className="text-lg">{scenario.name}</CardTitle>
                        <CardDescription>{scenario.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button 
                          size="sm" 
                          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          Analyze Scenario
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {!canUseScenarios && (
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">Access Restricted</h3>
                <p className="text-sm text-blue-700">
                  Scenario analysis is only available for Analysts, System Administrators, and Senate members.
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
