/**
 * CleanupModelOverrideInput - Advanced model selection for AI cleanup
 *
 * Allows operators to specify a custom OpenRouter model ID
 * for AI-assisted cleanup passes.
 */

import { useState, useCallback } from "react";
import { AlertCircle, Info } from "lucide-react";

interface CleanupModelOverrideInputProps {
  /** Current model override value */
  value: string;
  /** Callback when model changes */
  onChange: (model: string) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
}

/** Maximum length for model ID */
const MAX_MODEL_LENGTH = 100;

/** Valid characters for OpenRouter model IDs */
const VALID_MODEL_PATTERN = /^[a-zA-Z0-9/_\.:-]*$/;

/**
 * Validates a model ID string
 * Returns null if valid, error message if invalid
 */
function validateModelId(model: string): string | null {
  if (model.length > MAX_MODEL_LENGTH) {
    return `Model ID must be ${MAX_MODEL_LENGTH} characters or less`;
  }

  if (!VALID_MODEL_PATTERN.test(model)) {
    return "Model ID contains invalid characters. Use only: a-z, A-Z, 0-9, /, _, ., :, -";
  }

  return null;
}

/**
 * Model override input component
 *
 * Shows text input for OpenRouter model ID with validation
 * and helpful examples.
 */
export function CleanupModelOverrideInput({
  value,
  onChange,
  disabled = false,
}: CleanupModelOverrideInputProps) {
  const [error, setError] = useState<string | null>(null);
  const [isTouched, setIsTouched] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      const validationError = validateModelId(newValue);

      setError(validationError);
      onChange(newValue);
    },
    [onChange],
  );

  const handleBlur = useCallback(() => {
    setIsTouched(true);
    if (value) {
      setError(validateModelId(value));
    }
  }, [value]);

  const showError = isTouched && error;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label
          htmlFor="model-override"
          className="text-sm font-medium text-slate-200"
        >
          AI Model Override
        </label>
        <span className="text-xs text-slate-500">(Advanced)</span>
      </div>

      <div className="relative">
        <input
          id="model-override"
          type="text"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder="e.g., openrouter/anthropic/claude-3.5-sonnet"
          className={`
            w-full px-3 py-2 text-sm
            bg-slate-900/50 border rounded-lg
            text-slate-200 placeholder-slate-500
            focus:outline-none focus:ring-2 focus:ring-blue-500/50
            transition-all duration-200
            ${showError ? "border-red-500/50 focus:border-red-500" : "border-slate-700/50 focus:border-blue-500/50"}
            ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          `}
        />
        {showError && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <AlertCircle className="w-4 h-4 text-red-500" />
          </div>
        )}
      </div>

      {showError ? (
        <p className="text-xs text-red-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      ) : (
        <p className="text-xs text-slate-500 flex items-start gap-1">
          <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>
            OpenRouter model ID. Leave empty to use default. Examples: openrouter/free, openrouter/anthropic/claude-3.5-sonnet, deepseek/deepseek-v3.2
          </span>
        </p>
      )}
    </div>
  );
}

/**
 * Hook for managing model override state with validation
 */
export function useModelOverride() {
  const [modelOverride, setModelOverride] = useState("");
  const [isValid, setIsValid] = useState(true);

  const handleChange = useCallback((value: string) => {
    setModelOverride(value);
    setIsValid(validateModelId(value) === null);
  }, []);

  return {
    modelOverride,
    setModelOverride: handleChange,
    isValid,
    hasOverride: modelOverride.trim().length > 0,
  };
}

export { validateModelId };
