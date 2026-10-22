import { z } from 'zod';

// Core Enums
export const CategoryEnum = z.enum([
  'ACADEMIC',
  'HOSTEL_MESS',
  'FINANCIAL_FEES',
  'HARASSMENT_DISCIPLINARY',
  'INFRASTRUCTURE',
  'ADMINISTRATION'
]);

export const PriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export const StatusEnum = z.enum([
  'FILED',
  'ASSIGNED',
  'IN_REVIEW',
  'RESOLVED',
  'ESCALATED'
]);

export const RoleEnum = z.enum([
  'PETITIONER',
  'OFFICER_TIER_1',
  'COMMITTEE_TIER_2',
  'OMBUDSMAN_TIER_3',
  'AUDITOR',
  'ADMIN'
]);

export const AuthorityTierEnum = z.enum(['TIER_1', 'TIER_2', 'TIER_3']);

// Attachment Schema (Pre-signed direct S3 upload metadata + SHA-256)
export const AttachmentMetaSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  fileSize: z.number().max(10 * 1024 * 1024, 'Max file size is 10MB'),
  mimeType: z.string(),
  storageKey: z.string(),
  sha256Hash: z.string().length(64, 'Must be a 64-character SHA-256 hex string')
});

// Intake Form Payload (Client -> Fastify POST /api/tickets)
export const CreateTicketSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(120, 'Title cannot exceed 120 characters'),
  description: z.string().min(20, 'Please provide detailed complaint description (min 20 characters)'),
  category: CategoryEnum,
  priority: PriorityEnum,
  isAnonymous: z.boolean().default(false),
  attachments: z.array(AttachmentMetaSchema).default([])
});

// State Transition Payload (Officer -> Fastify PATCH /api/tickets/:id/transition)
export const TransitionTicketSchema = z.object({
  toStatus: StatusEnum,
  resolutionNote: z.string().min(10, 'Resolution note is required when resolving ticket').optional(),
  reason: z.string().optional()
});

// Dispute Payload (72h Dispute window)
export const DisputeTicketSchema = z.object({
  disputeReason: z.string().min(15, 'Please provide detailed reason for disputing the resolution'),
  receiptSecret: z.string().optional() // required for anonymous petitions
});

// Internal Comment Payload
export const AddCommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(2000),
  isInternal: z.boolean().default(false)
});

// TypeScript Inferred Types
export type Category = z.infer<typeof CategoryEnum>;
export type Priority = z.infer<typeof PriorityEnum>;
export type Status = z.infer<typeof StatusEnum>;
export type Role = z.infer<typeof RoleEnum>;
export type AuthorityTier = z.infer<typeof AuthorityTierEnum>;
export type AttachmentMeta = z.infer<typeof AttachmentMetaSchema>;
export type CreateTicketInput = z.infer<typeof CreateTicketSchema>;
export type TransitionTicketInput = z.infer<typeof TransitionTicketSchema>;
export type DisputeTicketInput = z.infer<typeof DisputeTicketSchema>;
export type AddCommentInput = z.infer<typeof AddCommentSchema>;
