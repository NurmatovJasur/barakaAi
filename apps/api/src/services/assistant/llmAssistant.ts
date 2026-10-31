import type { AssistantReplyDto } from '@smp/shared';
import type { AssistantContext, ProcurementAssistantService } from './assistant.types';

/**
 * P2 placeholder for an LLM-backed assistant. Not wired into the app.
 *
 * Intended design: the LLM only rephrases. Facts are produced by RuleBasedAssistant / services and
 * passed as tool results; the model must not invent prices, stock or ratings.
 */
export class LlmProcurementAssistant implements ProcurementAssistantService {
  constructor(private readonly factsSource: ProcurementAssistantService) {}

  async reply(_message: string, _ctx: AssistantContext): Promise<AssistantReplyDto> {
    throw new Error('LLM assistant is not configured');
  }
}
