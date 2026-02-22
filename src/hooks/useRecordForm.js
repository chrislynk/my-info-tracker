/**
 * Custom hook for managing form state in RecordForm
 * Consolidates multiple useState hooks into a single useReducer
 */
import { useReducer, useCallback } from 'react';

const initialFormState = {
  title: '',
  start: '',
  end: '',
  notes: '',
  noteHtml: '',
  template: '',
  status: '',
  project: '',
  group: '',
  selectedTags: [],
  imageFile: null,
  imagePreview: null,
};

function formReducer(state, action) {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'SET_MULTIPLE':
      return { ...state, ...action.payload };
    case 'RESET':
      return { ...initialFormState, ...action.payload };
    default:
      return state;
  }
}

/**
 * Hook for managing form state with useReducer
 * @returns {Object} Form state and setter functions
 */
export function useRecordForm() {
  const [formState, dispatch] = useReducer(formReducer, initialFormState);

  const setField = useCallback((field, value) => {
    dispatch({ type: 'SET_FIELD', field, value });
  }, []);

  const setMultipleFields = useCallback((fields) => {
    dispatch({ type: 'SET_MULTIPLE', payload: fields });
  }, []);

  const resetForm = useCallback((overrides = {}) => {
    dispatch({ type: 'RESET', payload: overrides });
  }, []);

  return {
    formState,
    setField,
    setMultipleFields,
    resetForm,
  };
}
