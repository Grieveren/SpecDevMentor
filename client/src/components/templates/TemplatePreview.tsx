// @ts-nocheck
import React, { useState } from 'react';
import { XMarkIcon, StarIcon, EyeIcon, UserIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { Template, TemplateVariable } from '../../services/template.service';
import { cn } from '../../utils/cn';

interface TemplatePreviewProps {
  template: Template;
  onClose: () => void;
  onApply?: (template: Template, variables: Record<string, string>) => void;
  onRate?: (rating: number, feedback?: string) => void;
}

export const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  template,
  onClose,
  onApply,
  onRate,
}) => {
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [showVariables, setShowVariables] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [showRating, setShowRating] = useState(false);

  const handleVariableChange = (name: string, _value: string) => {
    setVariables(prev => ({ ...prev, [name]: value }));
  };

  const handleApply = () => {
    if (onApply) {
      // Validate required variables
      const missingRequired = template.variables.filter(
        v => v.required && !variables[v.name]
      );

      if (missingRequired.length > 0) {
        alert(`Please fill in required variables: ${missingRequired.map(v => v.name).join(', ')}`);
        return;
      }

      onApply(template, variables);
    }
  };

  const handleRate = () => {
    if (onRate && rating > 0) {
      onRate(rating, feedback || undefined);
      setShowRating(false);
      setRating(0);
      setFeedback('');
    }
  };

  const renderStars = (currentRating: number, interactive = false) => {
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => {
          const Icon = star <= currentRating ? StarIconSolid : StarIcon;
          return (
            <Icon
              key={star}
              className={cn(
                'h-5 w-5',
                interactive ? 'cursor-pointer hover:text-yellow-400' : '',
                star <= currentRating ? 'text-yellow-400' : 'text-gray-300'
              )}
              onClick={interactive ? () => setRating(star) : undefined}
            />
          );
        })}
      </div>
    );
  };

  const renderVariableInput = (variable: TemplateVariable) => {
    const value = variables[variable.name] || variable.defaultValue || '';

    switch (variable.type) {
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleVariableChange(variable.name, e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required={variable.required}
          >
            <option value="">Select an option</option>
            {variable.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case 'boolean':
        return (
          <select
            value={value}
            onChange={(e) => handleVariableChange(variable.name, e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required={variable.required}
          >
            <option value="">Select...</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleVariableChange(variable.name, e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required={variable.required}
          />
        );

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleVariableChange(variable.name, e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required={variable.required}
          />
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h2 className="text-xl font-semibold text-gray-900">{template.name}</h2>
              {template.isOfficial && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Official
                </span>
              )}
            </div>
            <p className="text-gray-600">{template.description}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Template Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Details</h3>
                  <div className="space-y-2">
                    {template.phase && (
                      <div className="flex items-center text-sm">
                        <span className="text-gray-500 w-20">Phase:</span>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {template.phase}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center text-sm">
                      <span className="text-gray-500 w-20">Category:</span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {template.category}
                      </span>
                    </div>
                    <div className="flex items-center text-sm">
                      <UserIcon className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-gray-500 w-16">Author:</span>
                      <span>{template.author.name}</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <EyeIcon className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-gray-500 w-16">Used:</span>
                      <span>{template.usageCount} times</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-gray-500 w-16">Created:</span>
                      <span>{new Date(template.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {template.tags.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {template.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-50 text-gray-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Rating</h3>
                  <div className="flex items-center space-x-2">
                    {renderStars(template.rating)}
                    <span className="text-sm text-gray-600">
                      ({template._count.usages} reviews)
                    </span>
                  </div>
                </div>

                {onRate && (
                  <div>
                    <button
                      onClick={() => setShowRating(!showRating)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Rate this template
                    </button>
                    {showRating && (
                      <div className="mt-2 p-3 bg-gray-50 rounded-md">
                        <div className="mb-2">
                          {renderStars(rating, true)}
                        </div>
                        <textarea
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value)}
                          placeholder="Optional feedback..."
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none"
                          rows={2}
                        />
                        <div className="flex justify-end space-x-2 mt-2">
                          <button
                            onClick={() => setShowRating(false)}
                            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleRate}
                            disabled={rating === 0}
                            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Submit
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Template Content Preview */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Template Content</h3>
              <div className="bg-gray-50 rounded-md p-4 max-h-64 overflow-y-auto">
                <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                  {template.content}
                </pre>
              </div>
            </div>

            {/* Variables */}
            {template.variables.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-700">Variables</h3>
                  {onApply && (
                    <button
                      onClick={() => setShowVariables(!showVariables)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {showVariables ? 'Hide' : 'Configure'} Variables
                    </button>
                  )}
                </div>

                {showVariables ? (
                  <div className="space-y-4 p-4 bg-gray-50 rounded-md">
                    {template.variables.map((variable) => (
                      <div key={variable.name}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {variable.name}
                          {variable.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <p className="text-xs text-gray-500 mb-2">{variable.description}</p>
                        {renderVariableInput(variable)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {template.variables.map((variable) => (
                      <div key={variable.name} className="flex items-center text-sm">
                        <span className="text-gray-500 w-24">{variable.name}:</span>
                        <span className="text-gray-700">{variable.description}</span>
                        {variable.required && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {onApply && (
          <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Apply Template
            </button>
          </div>
        )}
      </div>
    </div>
  );
};