// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { PlayIcon, PauseIcon, CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
import { cn } from '../../utils/cn';

export interface LessonContent {
  id: string;
  type: 'text' | 'video' | 'interactive' | 'quiz';
  title: string;
  content: string;
  duration: number; // in minutes
  order: number;
  metadata?: Record<string, any>;
}

interface LessonViewerProps {
  lesson: LessonContent;
  isCompleted: boolean;
  onComplete: () => void;
  onProgress?: (progress: number) => void;
}

export const LessonViewer: React.FC<LessonViewerProps> = ({
  lesson,
  isCompleted,
  onComplete,
  onProgress,
}) => {
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeSpent, setTimeSpent] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isPlaying && !isCompleted) {
      interval = setInterval(() => {
        setTimeSpent(prev => {
          const newTime = prev + 1;
          const newProgress = Math.min((newTime / (lesson.duration * 60)) * 100, 100);
          setProgress(newProgress);
          onProgress?.(newProgress);

          // Auto-complete when 80% of estimated time is spent
          if (newProgress >= 80 && !isCompleted) {
            onComplete();
          }

          return newTime;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, isCompleted, lesson.duration, onComplete, onProgress]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleMarkComplete = () => {
    setProgress(100);
    onComplete();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderContent = () => {
    switch (lesson.type) {
      case 'text':
        return (
          <div className="prose max-w-none">
            <div dangerouslySetInnerHTML={{ __html: lesson.content }} />
          </div>
        );

      case 'video':
        return (
          <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                {isPlaying ? (
                  <PauseIcon className="w-8 h-8 text-white" />
                ) : (
                  <PlayIcon className="w-8 h-8 text-white ml-1" />
                )}
              </div>
              <p className="text-gray-600">Video content placeholder</p>
              <p className="text-sm text-gray-500 mt-2">
                Duration: {lesson.duration} minutes
              </p>
            </div>
          </div>
        );

      case 'interactive':
        return (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mr-3">
                <span className="text-white text-sm font-bold">!</span>
              </div>
              <h3 className="text-lg font-medium text-blue-900">Interactive Exercise</h3>
            </div>
            <div className="prose max-w-none">
              <div dangerouslySetInnerHTML={{ __html: lesson.content }} />
            </div>
            <div className="mt-4 p-4 bg-white rounded border">
              <p className="text-sm text-gray-600 mb-2">Try it yourself:</p>
              <textarea
                className="w-full h-32 p-3 border rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Write your response here..."
              />
            </div>
          </div>
        );

      case 'quiz':
        return (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center mr-3">
                <span className="text-white text-sm font-bold">?</span>
              </div>
              <h3 className="text-lg font-medium text-green-900">Knowledge Check</h3>
            </div>
            <div className="prose max-w-none">
              <div dangerouslySetInnerHTML={{ __html: lesson.content }} />
            </div>
          </div>
        );

      default:
        return (
          <div className="prose max-w-none">
            <div dangerouslySetInnerHTML={{ __html: lesson.content }} />
          </div>
        );
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div className="px-6 py-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{lesson.title}</h2>
            <div className="flex items-center mt-1 text-sm text-gray-500">
              <ClockIcon className="w-4 h-4 mr-1" />
              <span>{lesson.duration} min</span>
              {isCompleted && (
                <>
                  <CheckCircleIcon className="w-4 h-4 ml-4 mr-1 text-green-600" />
                  <span className="text-green-600">Completed</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {lesson.type === 'video' && (
              <button
                onClick={handlePlayPause}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                {isPlaying ? (
                  <>
                    <PauseIcon className="w-4 h-4 mr-2" />
                    Pause
                  </>
                ) : (
                  <>
                    <PlayIcon className="w-4 h-4 mr-2" />
                    Play
                  </>
                )}
              </button>
            )}

            {!isCompleted && (
              <button
                onClick={handleMarkComplete}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                <CheckCircleIcon className="w-4 h-4 mr-2" />
                Mark Complete
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {!isCompleted && progress > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Time Tracking */}
        {timeSpent > 0 && (
          <div className="mt-2 text-sm text-gray-500">
            Time spent: {formatTime(timeSpent)} / {formatTime(lesson.duration * 60)}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {renderContent()}
      </div>

      {/* Footer Actions */}
      {lesson.type === 'interactive' && (
        <div className="px-6 py-4 border-t bg-gray-50">
          <div className="flex justify-between">
            <button className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors">
              Reset
            </button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
              Submit Response
            </button>
          </div>
        </div>
      )}
    </div>
  );
};