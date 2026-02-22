/**
 * Custom hook for managing dropdown state
 * Consolidates multiple dropdown visibility and "new input" states
 */
import { useState, useCallback } from 'react';

/**
 * Hook for managing dropdown state across the form
 * @returns {Object} Dropdown state and control functions
 */
export function useDropdowns() {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [newInputs, setNewInputs] = useState({
    showProjectInput: false,
    showGroupInput: false,
    showTagInput: false,
    projectValue: '',
    groupValue: '',
    tagValue: '',
  });

  const openDropdown = useCallback((name) => setActiveDropdown(name), []);

  const closeDropdown = useCallback(() => setActiveDropdown(null), []);

  const toggleDropdown = useCallback((name) => {
    setActiveDropdown(prev => prev === name ? null : name);
  }, []);

  const isOpen = useCallback((name) => activeDropdown === name, [activeDropdown]);

  const showNewInput = useCallback((type) => {
    setNewInputs(prev => ({ ...prev, [`show${type}Input`]: true }));
  }, []);

  const hideNewInput = useCallback((type) => {
    setNewInputs(prev => ({
      ...prev,
      [`show${type}Input`]: false,
      [`${type.toLowerCase()}Value`]: ''
    }));
  }, []);

  const setNewInputValue = useCallback((type, value) => {
    setNewInputs(prev => ({ ...prev, [`${type.toLowerCase()}Value`]: value }));
  }, []);

  const resetAllDropdowns = useCallback(() => {
    setActiveDropdown(null);
    setNewInputs({
      showProjectInput: false,
      showGroupInput: false,
      showTagInput: false,
      projectValue: '',
      groupValue: '',
      tagValue: '',
    });
  }, []);

  return {
    activeDropdown,
    openDropdown,
    closeDropdown,
    toggleDropdown,
    isOpen,
    newInputs,
    showNewInput,
    hideNewInput,
    setNewInputValue,
    resetAllDropdowns,
  };
}
