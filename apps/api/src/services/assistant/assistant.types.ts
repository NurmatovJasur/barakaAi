import type { AssistantReplyDto } from '@smp/shared';

export interface AssistantContext {
  userId: string;
  optimizationRunId?: string;
}

/**
 * Procurement assistant contract. Every implementation must answer only from backend data
 * (offers, optimizer runs, metrics) and say so explicitly when data is insufficient.
 */
export interface ProcurementAssistantService {
  reply(message: string, ctx: AssistantContext): Promise<AssistantReplyDto>;
}
