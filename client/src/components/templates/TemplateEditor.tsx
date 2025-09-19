import React, { useState, useEffect } from 'react';
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import {
  Template,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TemplateVariable,
} from '../../services/template.service';
import { cn } from '../../utils/cn';

interface TemplateEditorProps {
  template?: Template;
  onSave: (data: CreateTemplateRequest | UpdateTemplateRequest) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const CATEGORIES: Array<{ value: CreateTemplateRequest['category']; label: string }> = [
  { value: 'REQUIREMENTS', label: 'Requirements' },
  { value: 'DESIGN', label: 'Design' },
  { value: 'TASKS', label: 'Tasks' },
  { value: 'GENERAL', label: 'General' },
  { value: 'DOMAIN_SPECIFIC', label: 'Domain Specific' },
];

const PHASES: Array<{ value: NonNullable<CreateTemplateRequest['phase']>; label: string }> = [
  { value: 'REQUIREMENTS', label: 'Requirements' },
  { value: 'DESIGN', label: 'Design' },
  { value: 'TASKS', label: 'Tasks' },
  { value: 'IMPLEMENTATION', label: 'Implementation' },
];

const VARIABLE_TYPES: Array<{ value: TemplateVariable['type']; label: string }> = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'select', label: 'Select' },
];

const INITIAL_FORM: CreateTemplateRequest = {
  name: '',
  description: '',
  phase: undefined,
  category: 'GENERAL',
  content: '',
  variables: [],
  tags: [],
  isPublic: false,
};

const cloneVariables = (variables: TemplateVariable[] = []): TemplateVariable[] =>
  variables.map(variable => ({
    ...variable,
    options: variable.options ? [...variable.options] : undefined,
  }));

export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  template,
  onSave,
  onCancel,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState<CreateTemplateRequest>({ ...INITIAL_FORM });
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
        variables: cloneVariables(template.variables),
        tags: [...template.tags],
        isPublic: template.isPublic,
      });
    } else {
      setFormData({ ...INITIAL_FORM });
    }
  }, [template]);

  function handleInputChange<K extends keyof CreateTemplateRequest>(
    field: K,
    value: CreateTemplateRequest[K]
  ) {
    setFormData(prev => ({ ...prev, [field]: value }));

    const fieldKey = String(field);
    if (errors[fieldKey]) {
      setErrors(prev => {
        const { [fieldKey]: _removed, ...rest } = prev;
        return rest;
      });
    }
  }

  const handleAddTag = () => {
    const nextTag = tagInput.trim();
    if (!nextTag) return;

    const currentTags = formData.tags ?? [];
    if (currentTags.includes(nextTag)) {
      setTagInput('');
      return;
    }

    handleInputChange('tags', [...currentTags, nextTag]);
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = formData.tags ?? [];
    handleInputChange('tags', currentTags.filter(tag => tag !== tagToRemove));
  };

  const handleAddVariable = () => {
    const variables = formData.variables ?? [];
    const newVariable: TemplateVariable = {
      name: '',
      description: '',
      type: 'text',
      required: false,
      options: [],
    };

    handleInputChange('variables', [...variables, newVariable]);
  };

  const handleUpdateVariable = <K extends keyof TemplateVariable>(
    variableIndex: number,
    field: K,
    value: TemplateVariable[K]
  ) => {
    const variables = cloneVariables(formData.variables ?? []);
    const variable = variables[variableIndex];
    if (!variable) return;

    variables[variableIndex] = { ...variable, [field]: value };
    handleInputChange('variables', variables);
  };

  const handleRemoveVariable = (variableIndex: number) => {
    const variables = cloneVariables(formData.variables ?? []);
    variables.splice(variableIndex, 1);
    handleInputChange('variables', variables);
  };

  const handleAddVariableOption = (variableIndex: number) => {
    const variables = cloneVariables(formData.variables ?? []);
    const variable = variables[variableIndex];
    if (!variable) return;

    const options = [...(variable.options ?? [])];
    options.push('');
    variables[variableIndex] = { ...variable, options };
    handleInputChange('variables', variables);
  };

  const handleUpdateVariableOption = (
    variableIndex: number,
    optionIndex: number,
    value: string
  ) => {
    const variables = cloneVariables(formData.variables ?? []);
    const variable = variables[variableIndex];
    if (!variable) return;

    const options = [...(variable.options ?? [])];
    options[optionIndex] = value;
    variables[variableIndex] = { ...variable, options };
    handleInputChange('variables', variables);
  };

  const handleRemoveVariableOption = (variableIndex: number, optionIndex: number) => {
    const variables = cloneVariables(formData.variables ?? []);
    const variable = variables[variableIndex];
    if (!variable) return;

    const options = [...(variable.options ?? [])];
    options.splice(optionIndex, 1);
    variables[variableIndex] = { ...variable, options };
    handleInputChange('variables', variables);
  };

  const validateForm = (): boolean => {
    const validationErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      validationErrors.name = 'Name is required';
    }

    if (!formData.description.trim()) {
      validationErrors.description = 'Description is required';
    }

    if (!formData.content.trim()) {
      validationErrors.content = 'Content is required';
    }

    (formData.variables ?? []).forEach((variable, index) => {
      if (!variable.name.trim()) {
        validationErrors[`variable_${index}_name`] = 'Variable name is required';
      }
      if (!variable.description.trim()) {
        validationErrors[`variable_${index}_description`] = 'Variable description is required';
      }
      if (variable.type === 'select' && (!(variable.options?.length))) {
        validationErrors[`variable_${index}_options`] = 'Select variables must include options';
      }
    });

    setErrors(validationErrors);
    return Object.keys(validationErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await onSave(formData);
    } catch (error) {
      console.error('Failed to save template:', error);
    }
  };

  const variables = formData.variables ?? [];
  const tags = formData.tags ?? [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {template ? 'Edit Template' : 'Create Template'}
          </h2>
          <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Basic Information */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <label htmlFor="template-name" className="block text-sm font-medium text-gray-700">
                  Template Name
                </label>
                <input
                  id="template-name"
                  type="text"
                  value={formData.name}
                  onChange={event => handleInputChange('name', event.target.value)}
                  className={cn(
                    'mt-1 block w-full border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500',
                    errors.name ? 'border-red-300' : 'border-gray-300'
                  )}
                  placeholder="E.g. Requirement Definition Template"
                  maxLength={120}
                  required
                />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
              </div>

              <div>
                <label htmlFor="template-category" className="block text-sm font-medium text-gray-700">
                  Category
                </label>
                <select
                  id="template-category"
                  value={formData.category}
                  onChange={event => handleInputChange('category', event.target.value as CreateTemplateRequest['category'])}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  {CATEGORIES.map(category => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="template-phase" className="block text-sm font-medium text-gray-700">
                  Phase
                </label>
                <select
                  id="template-phase"
                  value={formData.phase ?? ''}
                  onChange={event =>
                    handleInputChange(
                      'phase',
                      event.target.value
                        ? (event.target.value as NonNullable<CreateTemplateRequest['phase']>)
                        : undefined
                    )
                  }
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select phase (optional)</option>
                  {PHASES.map(phase => (
                    <option key={phase.value} value={phase.value}>
                      {phase.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Visibility</label>
                <div className="mt-2 flex items-center space-x-4">
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      name="template-visibility"
                      value="private"
                      checked={!formData.isPublic}
                      onChange={() => handleInputChange('isPublic', false)}
                      className="text-blue-600"
                    />
                    <span className="ml-2 text-sm text-gray-700">Private</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      name="template-visibility"
                      value="public"
                      checked={!!formData.isPublic}
                      onChange={() => handleInputChange('isPublic', true)}
                      className="text-blue-600"
                    />
                    <span className="ml-2 text-sm text-gray-700">Public</span>
                  </label>
                </div>
              </div>
            </section>

            {/* Description */}
            <section>
              <label htmlFor="template-description" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                id="template-description"
                rows={3}
                value={formData.description}
                onChange={event => handleInputChange('description', event.target.value)}
                className={cn(
                  'mt-1 block w-full border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500',
                  errors.description ? 'border-red-300' : 'border-gray-300'
                )}
                placeholder="Describe when and how to use this template"
              />
              <div className="mt-1 flex justify-between text-xs text-gray-500">
                <span>{formData.description?.length ?? 0}/500 characters</span>
                {errors.description && <span className="text-red-600">{errors.description}</span>}
              </div>
            </section>

            {/* Content */}
            <section>
              <label htmlFor="template-content" className="block text-sm font-medium text-gray-700">
                Template Content
              </label>
              <textarea
                id="template-content"
                rows={10}
                value={formData.content}
                onChange={event => handleInputChange('content', event.target.value)}
                className={cn(
                  'mt-1 block w-full border rounded-md shadow-sm font-mono text-sm focus:ring-blue-500 focus:border-blue-500',
                  errors.content ? 'border-red-300' : 'border-gray-300'
                )}
                placeholder="Write your template, using {{variables}} for dynamic content"
              />
              {errors.content && <p className="mt-1 text-xs text-red-600">{errors.content}</p>}
            </section>

            {/* Tags */}
            <section>
              <label className="block text-sm font-medium text-gray-700">Tags</label>
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={event => setTagInput(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleAddTag();
                    }
                  }}
                  className="flex-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Add a tag and press Enter"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                >
                  Add
                </button>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map(tag => (
                  <span key={tag} className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 text-blue-700 hover:text-blue-900"
                    >
                      <XMarkIcon className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {tags.length === 0 && (
                  <span className="text-xs text-gray-500">No tags yet</span>
                )}
              </div>
            </section>

            {/* Variables */}
            <section>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Template Variables</label>
                <button
                  type="button"
                  onClick={handleAddVariable}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                >
                  <PlusIcon className="h-4 w-4 mr-1" /> Add Variable
                </button>
              </div>

              <div className="mt-3 space-y-4">
                {variables.map((variable, index) => (
                  <div key={`variable-${index}`} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                        <div>
                          <label className="block text-xs font-medium text-gray-700">Name</label>
                          <input
                            type="text"
                            value={variable.name}
                            onChange={event => handleUpdateVariable(index, 'name', event.target.value)}
                            className={cn(
                              'mt-1 block w-full border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500',
                              errors[`variable_${index}_name`] ? 'border-red-300' : 'border-gray-300'
                            )}
                          />
                          {errors[`variable_${index}_name`] && (
                            <p className="mt-1 text-xs text-red-600">{errors[`variable_${index}_name`]}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700">Type</label>
                          <select
                            value={variable.type}
                            onChange={event =>
                              handleUpdateVariable(index, 'type', event.target.value as TemplateVariable['type'])
                            }
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          >
                            {VARIABLE_TYPES.map(type => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium text-gray-700">Description</label>
                          <textarea
                            rows={2}
                            value={variable.description}
                            onChange={event => handleUpdateVariable(index, 'description', event.target.value)}
                            className={cn(
                              'mt-1 block w-full border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500',
                              errors[`variable_${index}_description`] ? 'border-red-300' : 'border-gray-300'
                            )}
                          />
                          {errors[`variable_${index}_description`] && (
                            <p className="mt-1 text-xs text-red-600">{errors[`variable_${index}_description`]}</p>
                          )}
                        </div>

                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={variable.required}
                            onChange={event => handleUpdateVariable(index, 'required', event.target.checked)}
                            className="text-blue-600"
                          />
                          <span className="text-sm text-gray-700">Required</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveVariable(index)}
                        className="ml-4 text-gray-400 hover:text-red-600"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>

                    {variable.type === 'select' && (
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-700">Options</span>
                          <button
                            type="button"
                            onClick={() => handleAddVariableOption(index)}
                            className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800"
                          >
                            <PlusIcon className="h-4 w-4 mr-1" /> Add Option
                          </button>
                        </div>

                        {(variable.options ?? []).map((option, optionIndex) => (
                          <div key={`option-${optionIndex}`} className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={option}
                              onChange={event =>
                                handleUpdateVariableOption(index, optionIndex, event.target.value)
                              }
                              className="flex-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveVariableOption(index, optionIndex)}
                              className="text-gray-400 hover:text-red-600"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        ))}

                        {errors[`variable_${index}_options`] && (
                          <p className="text-xs text-red-600">{errors[`variable_${index}_options`]}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {variables.length === 0 && (
                  <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center text-sm text-gray-500">
                    No variables added yet. Use the "Add Variable" button to define dynamic placeholders.
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
