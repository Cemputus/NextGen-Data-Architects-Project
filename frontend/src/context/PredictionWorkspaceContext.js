/**
 * In-memory prediction workspace: survives route changes within the SPA, no localStorage.
 * Cleared on logout so deployed multi-user browsers do not leak drafts or results.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from './AuthContext';

const PredictionWorkspaceContext = createContext(undefined);

export function PredictionWorkspaceProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [predictions, setPredictions] = useState(null);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [studentIdentifier, setStudentIdentifier] = useState('');
  const [modelType, setModelType] = useState('ensemble');

  useEffect(() => {
    if (!isAuthenticated) {
      setPredictions(null);
      setSelectedScenario(null);
      setStudentIdentifier('');
      setModelType('ensemble');
    }
  }, [isAuthenticated]);

  const clearWorkspace = useCallback(() => {
    setPredictions(null);
    setSelectedScenario(null);
    setStudentIdentifier('');
    setModelType('ensemble');
  }, []);

  const value = useMemo(
    () => ({
      predictions,
      setPredictions,
      selectedScenario,
      setSelectedScenario,
      studentIdentifier,
      setStudentIdentifier,
      modelType,
      setModelType,
      clearWorkspace,
    }),
    [
      predictions,
      selectedScenario,
      studentIdentifier,
      modelType,
      clearWorkspace,
    ]
  );

  return (
    <PredictionWorkspaceContext.Provider value={value}>
      {children}
    </PredictionWorkspaceContext.Provider>
  );
}

export function usePredictionWorkspace() {
  const ctx = useContext(PredictionWorkspaceContext);
  if (ctx === undefined) {
    throw new Error('usePredictionWorkspace must be used within PredictionWorkspaceProvider');
  }
  return ctx;
}
