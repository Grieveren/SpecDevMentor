// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Template, CreateTemplateRequest, UpdateTemplateRequest, TemplateVariable } from '../../services/template.service';
import { cn } from '../../utils/cn';

interface TemplateEditorProps {
  template?: Template;
  onSave: (data: CreateTemplateRequest | UpdateTemplateRequest) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const CATEGORIES = [
  { value: 'REQUIREMENTS', label: 'Requirements' },
  { value: 'DESIGN', label: 'Design' },
  { value: 'TASKS', label: 'Tasks' },
  { value: 'GENERAL', label: 'General' },
  { value: 'DOMAIN_SPECIFIC', label: 'Domain Specific' },
];

const PHASES = [
  { value: 'REQUIREMENTS', label: 'Requirements' },
  { value: 'DESIGN', label: 'Design' },
  { value: 'TASKS', label: 'Tasks' },
  { value: 'IMPLEMENTATION', label: 'Implementation' },
];

const VARIABLE_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'select', label: 'Select' },
];

export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  template,
  onSave,
  onCancel,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState<CreateTemplateRequest>({
    name: '',
    description: '',
    phase: undefined,
    category: 'GENERAL' as any,
    content: '',
    variables: [],
    tags: [],
    isPublic: false,
  });

  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        description: template.description,
        phase: template.phase,
        category: template.category,
        content: template.content,
        variables: template.variables,
        tags: template.tags,
        isPublic: template.isPublic,
      });
    }
  }, [template]);

  const handleInputChange = (field: keyof CreateTemplateRequest, _value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags?.includes(tagInput.trim())) {
      handleInputChange('tags', [...(formData.tags || []), tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    handleInputChange('tags', formData.tags?.filter(tag => tag !== tagToRemove) || []);
  };

  const handleAddVariable = () => {
    const newVariable: TemplateVariable = {
      name: '',
      description: '',
      type: 'text',
      required: false,
    };
    handleInputChange('variables', [...(formData.variables || []), newVariable]);
  };

  const handleUpdateVariable = (_index: number, field: keyof TemplateVariable, _value: unknown) => {
    const updatedVariables = [...(formData.variables || [])];
    updatedVariables[index] = { ...updatedVariables[index], [field]: value };
    handleInputChange('variables', updatedVariables);
  };

  const handleRemoveVariable = (_index: number) => {
    const updatedVariables = [...(formData.variables || [])];
    updatedVariables.splice(index, 1);
    handleInputChange('variables', updatedVariables);
  };

  const handleAddVariableOption = (variableIndex: number) => {
    const updatedVariables = [...(formData.variables || [])];
    const variable = updatedVariables[variableIndex];
    variable.options = [...(variable.options || []), ''];
    handleInputChange('variables', updatedVariables);
  };

  const handleUpdateVariableOption = (variableIndex: number, optionIndex: number, _value: string) => {
    const updatedVariables = [...(formData.variables || [])];
    const variable = updatedVariables[variableIndex];
    if (variable.options) {
      variable.options[optionIndex] = value;
      handleInputChange('variables', updatedVariables);
    }
  };

  const handleRemoveVariableOption = (variableIndex: number, optionIndex: number) => {
    const updatedVariables = [...(formData.variables || [])];
    const variable = updatedVariables[variableIndex];
    if (variable.options) {
      variable.options.splice(optionIndex, 1);
      handleInputChange('variables', updatedVariables);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.content.trim()) {
      newErrors.content = 'Content is required';
    }

    // Validate variables
    formData.variables?.forEach((variable, index) => {
      if (!variable.name.trim()) {
        newErrors[`variable_${index}_name`] = 'Variable name is required';
      }
      if (!variable.description.trim()) {
        newErrors[`variable_${index}_description`] = 'Variable description is required';
      }
      if (variable.type === 'select' && (!variable.options || variable.options.length === 0)) {
        newErrors[`variable_${index}_options`] = 'Select variables must have options';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await onSave(formData);
    } catch (error) {
      console.error('Failed to save template:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {template ? 'Edit Template' : 'Create Template'}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={cn(
                    'w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                    errors.name ? 'border-red-300' : 'border-gray-300'
                  )}
                  placeholder="Enter template name"
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phase (Optional)
                </label>
                <select
                  value={formData.phase || ''}
                  onChange={(e) => handleInputChange('phase', e.target.value || undefined)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">No specific phase</option>
                  {PHASES.map((phase) => (
                    <option key={phase.value} value={phase.value}>
                      {phase.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.isPublic}
                    onChange={(e) => handleInputChange('isPublic', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Make template public</span>
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Public templates can be used by all users
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className={cn(
                  'w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                  errors.description ? 'border-red-300' : 'border-gray-300'
                )}
                rows={3}
                placeholder="Describe what this template is for and how to use it"
              />
              {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
              <div className="flex items-center space-x-2 mb-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Add a tag"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
              {formData.tags && formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 text-gray-500 hover:text-gray-700"
                      >
                        <XMarkIcon className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Template Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template Content <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Use {`{{variableName}}`} syntax for variables that will be replaced when the template is applied.
              </p>
              <textarea
                value={formData.content}
                onChange={(e) => handleInputChange('content', e.target.value)}
                className={cn(
                  'w-full border rounded-md px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                  errors.content ? 'border-red-300' : 'border-gray-300'
                )}
                rows={12}
                placeholder="Enter your template content here..."
              />
              {errors.content && <p className="text-red-500 text-xs mt-1">{errors.content}</p>}
            </div>

            {/* Variables */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Variables</h3>
                <button
                  type="button"
                  onClick={handleAddVariable}
                  className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add Variable
                </button>
              </div>

              {formData.variables && formData.variables.length > 0 ? (
                <div className="space-y-4">
                  {formData.variables.map((variable, index) => (
                    <div key={index} className="border border-gray-200 rounded-md p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-medium text-gray-900">Variable {index + 1}</h4>
                        <button
                          type="button"
                          onClick={() => handleRemoveVariable(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={variable.name}
                            onChange={(e) => handleUpdateVariable(index, 'name', e.target.value)}
                            className={cn(
                              'w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                              errors[`variable_${index}_name`] ? 'border-red-300' : 'border-gray-300'
                            )}
                            placeholder="Variable name"
                          />
                          {errors[`variable_${index}_name`] && (
                            <p className="text-red-500 text-xs mt-1">{errors[`variable_${index}_name`]}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                          <select
                            value={variable.type}
                            onChange={(e) => handleUpdateVariable(index, 'type', e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            {VARIABLE_TYPES.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={variable.description}
                          onChange={(e) => handleUpdateVariable(index, 'description', e.target.value)}
                          className={cn(
                            'w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                            errors[`variable_${index}_description`] ? 'border-red-300' : 'border-gray-300'
                          )}
                          placeholder="Describe what this variable is for"
                        />
                        {errors[`variable_${index}_description`] && (
                          <p className="text-red-500 text-xs mt-1">{errors[`variable_${index}_description`]}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Default Value
                          </label>
                          <input
                            type="text"
                            value={variable.defaultValue || ''}
                            onChange={(e) => handleUpdateVariable(index, 'defaultValue', e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Optional default value"
                          />
                        </div>

                        <div>
                          <label className="flex items-center space-x-2 mt-6">
                            <input
                              type="checkbox"
                              checked={variable.required}
                              onChange={(e) => handleUpdateVariable(index, 'required', e.target.checked)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-700">Required</span>
                          </label>
                        </div>
                      </div>

                      {/* Options for select type */}
                      {variable.type === 'select' && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700">
                              Options <span className="text-red-500">*</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => handleAddVariableOption(index)}
                              className="text-sm text-blue-600 hover:text-blue-800"
                            >
                              Add Option
                            </button>
                          </div>
                          {variable.options && variable.options.length > 0 ? (
                            <div className="space-y-2">
                              {variable.options.map((option, optionIndex) => (
                                <div key={optionIndex} className="flex items-center space-x-2">
                                  <input
                                    type="text"
                                    value={option}
                                    onChange={(e) => handleUpdateVariableOption(index, optionIndex, e.target.value)}
                                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Option value"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveVariableOption(index, optionIndex)}
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">No options added yet</p>
                          )}
                          {errors[`variable_${index}_options`] && (
                            <p className="text-red-500 text-xs mt-1">{errors[`variable_${index}_options`]}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">
                  No variables defined. Variables allow users to customize the template when applying it.
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};