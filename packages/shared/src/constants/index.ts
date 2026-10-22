import { Status, Role } from '../schemas/ticket';

// Deterministic State Machine Allowed Transitions
export const ALLOWED_TRANSITIONS: Record<Status, Status[]> = {
  FILED: ['ASSIGNED'],
  ASSIGNED: ['IN_REVIEW', 'ESCALATED'],
  IN_REVIEW: ['RESOLVED', 'ESCALATED'],
  RESOLVED: ['ESCALATED'], // Via 72h dispute window
  ESCALATED: ['ASSIGNED']   // Re-assigned to next tier authority
};

// SLA Policy Defaults (in minutes / hours)
export const DEFAULT_SLA_POLICY = {
  LOW: { responseHours: 48, resolveHours: 120 },
  MEDIUM: { responseHours: 24, resolveHours: 72 },
  HIGH: { responseHours: 12, resolveHours: 36 },
  CRITICAL: { responseHours: 4, resolveHours: 12 }
} as const;

// 72-Hour Dispute Window (in milliseconds)
export const DISPUTE_WINDOW_MS = 72 * 60 * 60 * 1000;
