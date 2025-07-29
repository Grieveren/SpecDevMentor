import React, { useState, useEffect } from 'react';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  LightBulbIcon, 
  ClockIcon,
  StarIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import { cn } from '../../utils/cn';

export interface Exercise {
  id: string;
  type: 'multiple_choice' | 'code_review' | 'specification_writing' | 'hands_on';
  title: string;
  description: string;
  instructions: string;
  expectedOutput?: string;
  hints: string[];
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  points: number;
  timeLimit?: number; // in minutes
  metadata?: Record<string, any>;
}

export interface ExerciseResult {
  exerciseId: string;
  score: number;
  maxScore: number;
  completedAt: Date;
  timeSpent: number; // in minutes
  attempts: number;
  feedback?: string;
}

interface ExerciseInterfaceProps {
  exercise: Exercise;
  onSubmit: (_response: unknown) => Promise<ExerciseResult>;
  onComplete: (_result: ExerciseResult) => void;
  previousResult?: ExerciseResult;
}

export const ExerciseInterface: React.FC<ExerciseInterfaceProps> = ({
  exercise,
  onSubmit,
  onComplete,
  previousResult,
}) => {
  const [response, setResponse] = useState<any>('');
  const [currentHint, setCurrentHint] = useState(0);
  const [showHints, setShowHints] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ExerciseResult | null>(previousResult || null);
  const [timeSpent, setTimeSpent] = useState(0);
  const [attempts, setAttempts] = useState(previousResult?.attempts || 0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeSpent(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async () => {
    if (!response || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const exerciseResult = await onSubmit({
        exerciseId: exercise.id,
        response,
        timeSpent: Math.floor(timeSpent / 60),
        attempts: attempts + 1,
      });

      setResult(exerciseResult);
      setAttempts(prev => prev + 1);
      onComplete(exerciseResult);
    } catch (error) {
      console.error('Error submitting exercise:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setResponse('');
    setResult(null);
    setCurrentHint(0);
    setShowHints(false);
  };

  const nextHint = () => {
    if (currentHint < exercise.hints.length - 1) {
      setCurrentHint(prev => prev + 1);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'BEGINNER': return 'text-green-600 bg-green-100';
      case 'INTERMEDIATE': return 'text-yellow-600 bg-yellow-100';
      case 'ADVANCED': return 'text-orange-600 bg-orange-100';
      case 'EXPERT': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const renderExerciseContent = () => {
    switch (exercise.type) {
      case 'multiple_choice':
        const options = exercise.metadata?.options || [];
        return (
          <div className="space-y-3">
            {options.map((option: unknown, _index: number) => (
              <label key={index} className="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name="answer"
                  value={option.value}
                  checked={response === option.value}
                  onChange={(e) => setResponse(e.target.value)}
                  className="mr-3 text-blue-600"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        );

      case 'code_review':
        return (
          <div className="space-y-4">
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
              <pre className="text-sm">
                <code dangerouslySetInnerHTML={{ __html: exercise.metadata?.code || '' }} />
              </pre>
            </div>
            <textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Provide your code review feedback here..."
              className="w-full h-32 p-3 border rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        );

      case 'specification_writing':
        return (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Scenario:</h4>
              <p className="text-blue-800">{exercise.metadata?.scenario}</p>
            </div>
            <textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Write your specification here using EARS format (WHEN/IF/THEN)..."
              className="w-full h-48 p-3 border rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            />
          </div>
        );

      case 'hands_on':
        return (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-medium text-green-900 mb-2">Task:</h4>
              <p className="text-green-800">{exercise.metadata?.task}</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Solution:
                </label>
                <textarea
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder="Describe your approach and solution..."
                  className="w-full h-32 p-3 border rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              {exercise.expectedOutput && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expected Output:
                  </label>
                  <div className="bg-gray-100 p-3 rounded-md h-32 overflow-y-auto">
                    <pre className="text-sm text-gray-800">{exercise.expectedOutput}</pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return (
          <textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Enter your response..."
            className="w-full h-32 p-3 border rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        );
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div className="px-6 py-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{exercise.title}</h2>
            <div className="flex items-center mt-2 space-x-4">
              <span className={cn('px-2 py-1 rounded-full text-xs font-medium', getDifficultyColor(exercise.difficulty))}>
                {exercise.difficulty}
              </span>
              <div className="flex items-center text-sm text-gray-500">
                <StarIcon className="w-4 h-4 mr-1" />
                <span>{exercise.points} points</span>
              </div>
              {exercise.timeLimit && (
                <div className="flex items-center text-sm text-gray-500">
                  <ClockIcon className="w-4 h-4 mr-1" />
                  <span>{exercise.timeLimit} min limit</span>
                </div>
              )}
            </div>
          </div>

          <div className="text-right">
            <div className="text-sm text-gray-500">
              Time: {formatTime(timeSpent)}
            </div>
            {attempts > 0 && (
              <div className="text-sm text-gray-500">
                Attempts: {attempts}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="px-6 py-4 border-b bg-gray-50">
        <p className="text-gray-700">{exercise.description}</p>
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <h4 className="font-medium text-blue-900 mb-1">Instructions:</h4>
          <p className="text-blue-800 text-sm">{exercise.instructions}</p>
        </div>
      </div>

      {/* Exercise Content */}
      <div className="px-6 py-6">
        {renderExerciseContent()}
      </div>

      {/* Hints Section */}
      {exercise.hints.length > 0 && (
        <div className="px-6 py-4 border-t bg-yellow-50">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setShowHints(!showHints)}
              className="flex items-center text-yellow-800 hover:text-yellow-900"
            >
              <LightBulbIcon className="w-5 h-5 mr-2" />
              <span className="font-medium">
                {showHints ? 'Hide Hints' : 'Show Hints'} ({exercise.hints.length})
              </span>
            </button>
            {showHints && currentHint < exercise.hints.length - 1 && (
              <button
                onClick={nextHint}
                className="flex items-center text-yellow-600 hover:text-yellow-700 text-sm"
              >
                Next Hint
                <ArrowRightIcon className="w-4 h-4 ml-1" />
              </button>
            )}
          </div>
          
          {showHints && (
            <div className="bg-yellow-100 border border-yellow-200 rounded-md p-3">
              <p className="text-yellow-800 text-sm">
                <strong>Hint {currentHint + 1}:</strong> {exercise.hints[currentHint]}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Result Display */}
      {result && (
        <div className="px-6 py-4 border-t">
          <div className={cn(
            'p-4 rounded-lg',
            result.score >= result.maxScore * 0.8 
              ? 'bg-green-50 border border-green-200' 
              : result.score >= result.maxScore * 0.6
              ? 'bg-yellow-50 border border-yellow-200'
              : 'bg-red-50 border border-red-200'
          )}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                {result.score >= result.maxScore * 0.8 ? (
                  <CheckCircleIcon className="w-6 h-6 text-green-600 mr-2" />
                ) : (
                  <XCircleIcon className="w-6 h-6 text-red-600 mr-2" />
                )}
                <span className="font-medium">
                  Score: {result.score}/{result.maxScore} ({Math.round((result.score / result.maxScore) * 100)}%)
                </span>
              </div>
              <div className="text-sm text-gray-600">
                Completed in {result.timeSpent} minutes
              </div>
            </div>
            {result.feedback && (
              <p className="text-sm text-gray-700 mt-2">{result.feedback}</p>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-6 py-4 border-t bg-gray-50">
        <div className="flex justify-between">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Reset
          </button>
          <div className="space-x-3">
            {result && result.score < result.maxScore * 0.8 && (
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
              >
                Try Again
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={!response || isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};