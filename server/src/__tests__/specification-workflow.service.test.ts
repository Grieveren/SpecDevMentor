/**
 * Legacy entry kept for Vitest pattern compatibility and downstream merges.
 * The primary workflow service tests live alongside the getWorkflowState-specific
 * suite to allow targeted filtering via `vitest run "getWorkflowState"`.
 */
import './specification-workflow.getWorkflowState.service.test.js';
