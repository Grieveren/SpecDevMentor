// @ts-nocheck
import React from 'react';
import { 
  CheckCircleIcon, 
  ClockIcon, 
  StarIcon, 
  TrophyIcon,
  AcademicCapIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import { cn } from '../../utils/cn';

export interface UserProgress {
  id: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  completedLessons: string[];
  exerciseResults: ExerciseResult[];
  skillAssessments: SkillAssessment[];
  lastAccessed?: Date;
  completedAt?: Date;
  module: {
    id: string;
    title: string;
    difficulty: string;
    estimatedDuration: number;
    phase?: string;
  };
}

export interface ExerciseResult {
  exerciseId: string;
  score: number;
  maxScore: number;
  completedAt: Date;
  timeSpent: number;
  attempts: number;
  feedback?: string;
}

export interface SkillAssessment {
  skillId: string;
  skillName: string;
  level: string;
  score: number;
  maxScore: number;
  assessedAt: Date;
  competencies: CompetencyResult[];
}

export interface CompetencyResult {
  competencyId: string;
  name: string;
  score: number;
  maxScore: number;
  feedback: string;
}

interface ProgressTrackerProps {
  progress: UserProgress[];
  currentModuleId?: string;
  showDetailed?: boolean;
}

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  progress,
  currentModuleId,
  showDetailed = false,
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'text-green-600 bg-green-100';
      case 'IN_PROGRESS': return 'text-blue-600 bg-blue-100';
      case 'SKIPPED': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-400 bg-gray-50';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'BEGINNER': return 'text-green-600';
      case 'INTERMEDIATE': return 'text-yellow-600';
      case 'ADVANCED': return 'text-orange-600';
      case 'EXPERT': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const calculateOverallStats = () => {
    const completed = progress.filter(p => p.status === 'COMPLETED').length;
    const inProgress = progress.filter(p => p.status === 'IN_PROGRESS').length;
    const totalPoints = progress.reduce((sum, p) => 
      sum + p.exerciseResults.reduce((exerciseSum, result) => exerciseSum + result.score, 0), 0
    );
    const totalTime = progress.reduce((sum, p) => 
      sum + p.exerciseResults.reduce((exerciseSum, result) => exerciseSum + result.timeSpent, 0), 0
    );

    return { completed, inProgress, totalPoints, totalTime };
  };

  const stats = calculateOverallStats();

  if (!showDetailed) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Learning Progress</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <CheckCircleIcon className="w-6 h-6 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.completed}</div>
            <div className="text-sm text-gray-600">Completed</div>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <ClockIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.inProgress}</div>
            <div className="text-sm text-gray-600">In Progress</div>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <StarIcon className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalPoints}</div>
            <div className="text-sm text-gray-600">Points</div>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <AcademicCapIcon className="w-6 h-6 text-purple-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{Math.round(stats.totalTime / 60)}h</div>
            <div className="text-sm text-gray-600">Study Time</div>
          </div>
        </div>

        <div className="space-y-3">
          {progress.slice(0, 5).map((item) => (
            <div
              key={item.id}
              className={cn(
                'flex items-center justify-between p-3 rounded-lg border',
                item.module.id === currentModuleId ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'
              )}
            >
              <div className="flex items-center">
                <div className={cn('w-3 h-3 rounded-full mr-3', getStatusColor(item.status).split(' ')[1])} />
                <div>
                  <div className="font-medium text-gray-900">{item.module.title}</div>
                  <div className="text-sm text-gray-600">
                    <span className={getDifficultyColor(item.module.difficulty)}>
                      {item.module.difficulty}
                    </span>
                    {item.module.phase && (
                      <span className="ml-2">• {item.module.phase}</span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className={cn('px-2 py-1 rounded-full text-xs font-medium', getStatusColor(item.status))}>
                  {item.status.replace('_', ' ')}
                </div>
                {item.completedAt && (
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(item.completedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Progress</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <TrophyIcon className="w-8 h-8 text-green-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">{stats.completed}</div>
            <div className="text-sm text-gray-600">Modules Completed</div>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <ChartBarIcon className="w-8 h-8 text-blue-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">{stats.inProgress}</div>
            <div className="text-sm text-gray-600">In Progress</div>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <StarIcon className="w-8 h-8 text-yellow-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">{stats.totalPoints}</div>
            <div className="text-sm text-gray-600">Total Points</div>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <ClockIcon className="w-8 h-8 text-purple-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">{Math.round(stats.totalTime / 60)}h</div>
            <div className="text-sm text-gray-600">Study Time</div>
          </div>
        </div>
      </div>

      {/* Detailed Progress */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Module Progress</h3>
        </div>
        
        <div className="divide-y">
          {progress.map((item) => (
            <div key={item.id} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-lg font-medium text-gray-900">{item.module.title}</h4>
                  <div className="flex items-center mt-1 text-sm text-gray-600">
                    <span className={getDifficultyColor(item.module.difficulty)}>
                      {item.module.difficulty}
                    </span>
                    <span className="mx-2">•</span>
                    <span>{item.module.estimatedDuration} min</span>
                    {item.module.phase && (
                      <>
                        <span className="mx-2">•</span>
                        <span>{item.module.phase}</span>
                      </>
                    )}
                  </div>
                </div>
                
                <div className={cn('px-3 py-1 rounded-full text-sm font-medium', getStatusColor(item.status))}>
                  {item.status.replace('_', ' ')}
                </div>
              </div>

              {/* Lessons Progress */}
              {item.completedLessons.length > 0 && (
                <div className="mb-4">
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    Lessons Completed: {item.completedLessons.length}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.completedLessons.slice(0, 5).map((lessonId, index) => (
                      <span key={lessonId} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                        Lesson {index + 1}
                      </span>
                    ))}
                    {item.completedLessons.length > 5 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                        +{item.completedLessons.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Exercise Results */}
              {item.exerciseResults.length > 0 && (
                <div className="mb-4">
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    Exercise Performance
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {item.exerciseResults.map((result, index) => (
                      <div key={result.exerciseId} className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">Exercise {index + 1}</span>
                          <span className="text-sm text-gray-600">
                            {result.score}/{result.maxScore}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={cn(
                              'h-2 rounded-full',
                              result.score / result.maxScore >= 0.8 ? 'bg-green-500' :
                              result.score / result.maxScore >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                            )}
                            style={{ width: `${(result.score / result.maxScore) * 100}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {result.attempts} attempt{result.attempts !== 1 ? 's' : ''} • {result.timeSpent}min
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Skill Assessments */}
              {item.skillAssessments.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    Skill Assessments
                  </div>
                  <div className="space-y-2">
                    {item.skillAssessments.map((assessment) => (
                      <div key={assessment.skillId} className="bg-blue-50 p-3 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-blue-900">{assessment.skillName}</span>
                          <span className="text-sm text-blue-700">
                            {Math.round((assessment.score / assessment.maxScore) * 100)}%
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          {assessment.competencies.map((competency) => (
                            <div key={competency.competencyId} className="text-xs">
                              <div className="flex justify-between">
                                <span className="text-gray-600">{competency.name}</span>
                                <span>{competency.score}/{competency.maxScore}</span>
                              </div>
                              <div className="w-full bg-blue-200 rounded-full h-1 mt-1">
                                <div
                                  className="bg-blue-600 h-1 rounded-full"
                                  style={{ width: `${(competency.score / competency.maxScore) * 100}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div className="mt-4 flex justify-between text-xs text-gray-500">
                {item.lastAccessed && (
                  <span>Last accessed: {new Date(item.lastAccessed).toLocaleDateString()}</span>
                )}
                {item.completedAt && (
                  <span>Completed: {new Date(item.completedAt).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};