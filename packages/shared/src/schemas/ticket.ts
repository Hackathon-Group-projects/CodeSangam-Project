import { z } from 'zod';

// Core Enums: z.enum ka matlab JS me ek aisi list jisme sirf yehi fixed values allow hongi
// CategoryEnum: Complaint kis type ki hai (Hostel, Academic, Fees, etc.)
export const CategoryEnum = z.enum([
  'ACADEMIC',
  'HOSTEL_MESS',
  'FINANCIAL_FEES',
  'HARASSMENT_DISCIPLINARY',
  'INFRASTRUCTURE',
  'ADMINISTRATION'
]);

// PriorityEnum: Complaint kitni urgent hai (SLA deadline isi se tay hoti hai)
export const PriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

// StatusEnum: Ticket ka current stage (Deterministic State Machine ke states)
export const StatusEnum = z.enum([
  'FILED',
  'ASSIGNED',
  'IN_REVIEW',
  'RESOLVED',
  'ESCALATED'
]);

// RoleEnum: User ka role kya hai (Student hai ya Redressal Officer)
export const RoleEnum = z.enum([
  'PETITIONER',
  'OFFICER_TIER_1',
  'COMMITTEE_TIER_2',
  'OMBUDSMAN_TIER_3',
  'AUDITOR',
  'ADMIN'
]);

// AuthorityTierEnum: Escalation ka level (Tier 1 = Officer, Tier 2 = Committee, Tier 3 = Ombudsman)
export const AuthorityTierEnum = z.enum(['TIER_1', 'TIER_2', 'TIER_3']);

// AttachmentMetaSchema: Uploaded file ki details aur uska browser-computed SHA-256 hash
export const AttachmentMetaSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  fileSize: z.number().max(10 * 1024 * 1024, 'Max file size is 10MB'), // Max 10MB file limit
  mimeType: z.string(),                                               // File ka format (e.g. image/png, application/pdf)
  storageKey: z.string(),                                             // MinIO / S3 me file ka unique path
  sha256Hash: z.string().length(64, 'Must be a 64-character SHA-256 hex string') // Tamper-proofing ke liye 64-char hash
});

// CreateTicketSchema: Jab user complaint file karega, toh input data ka validation rule
export const CreateTicketSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(120, 'Title cannot exceed 120 characters'),
  description: z.string().min(20, 'Please provide detailed complaint description (min 20 characters)'),
  category: CategoryEnum,
  priority: PriorityEnum,
  isAnonymous: z.boolean().default(false), // Anonymous toggle: true/false
  attachments: z.array(AttachmentMetaSchema).default([]) // Attached files ki array
});

// TransitionTicketSchema: Jab officer status change karega (e.g. IN_REVIEW -> RESOLVED)
export const TransitionTicketSchema = z.object({
  toStatus: StatusEnum,
  resolutionNote: z.string().min(10, 'Resolution note is required when resolving ticket').optional(),
  reason: z.string().optional()
});

// DisputeTicketSchema: Agar petitioner 72 ghante ke andar resolution se khush nahi hai aur dispute karta hai
export const DisputeTicketSchema = z.object({
  disputeReason: z.string().min(15, 'Please provide detailed reason for disputing the resolution'),
  receiptSecret: z.string().optional() // Anonymous complaints ke liye receipt secret zaroori hota hai
});

// AddCommentSchema: Discussion ya investigation ke waqt audit entry me comment add karne ke liye
export const AddCommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(2000),
  isInternal: z.boolean().default(false)
});

// TS CONCEPT (z.infer): TypeScript me type dobara likhne ki zaroorat nahi padti,
// z.infer automatically upar wale Zod validation schema se ek plain JS object ka type nikal leta hai.
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
