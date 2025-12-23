import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { getActivePersonaId, setActivePersonaId } from '../../shared/personas/activePersona';
import { DEFAULT_PERSONA_ID, EMOTIONAL_PERSONA_ID, FITNESS_PERSONA_ID } from '../../shared/personas/personaConstants';
import type { PersonaId } from '../../shared/personas/personaTypes';

interface PersonaOption {
  id: PersonaId;
  label: string;
}

const PERSONA_OPTIONS: PersonaOption[] = [
  { id: DEFAULT_PERSONA_ID, label: 'Default' },
  { id: EMOTIONAL_PERSONA_ID, label: 'Emotional Regulation' },
  { id: FITNESS_PERSONA_ID, label: 'Fitness' },
];

interface PersonaSwitcherProps {
  onPersonaChange?: () => void;
}

export const PersonaSwitcher: React.FC<PersonaSwitcherProps> = ({ onPersonaChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activePersonaId, setActivePersonaIdState] = useState<PersonaId>(getActivePersonaId());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Update state when persona changes externally (e.g., query param in dev)
  useEffect(() => {
    const checkPersona = () => {
      const current = getActivePersonaId();
      if (current !== activePersonaId) {
        setActivePersonaIdState(current);
      }
    };
    
    // Check periodically for external changes
    const interval = setInterval(checkPersona, 200);
    return () => clearInterval(interval);
  }, [activePersonaId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (personaId: PersonaId) => {
    setActivePersonaId(personaId);
    setActivePersonaIdState(personaId);
    setIsOpen(false);
    
    // Trigger re-render of parent component
    if (onPersonaChange) {
      onPersonaChange();
    }
    // Always dispatch event for components that listen to it
    window.dispatchEvent(new Event('persona-changed'));
  };

  const activeOption = PERSONA_OPTIONS.find(opt => opt.id === activePersonaId) || PERSONA_OPTIONS[0];

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors text-sm font-medium border border-white/5"
        aria-label="Switch persona"
      >
        <span className="text-xs text-neutral-400 uppercase tracking-wider">Mode:</span>
        <span>{activeOption.label}</span>
        <ChevronDown size={14} className={`text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-neutral-900 border border-white/10 rounded-xl shadow-lg overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
          <div className="py-1">
            {PERSONA_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => handleSelect(option.id)}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                  option.id === activePersonaId
                    ? 'bg-emerald-500/10 text-emerald-400 font-semibold'
                    : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

