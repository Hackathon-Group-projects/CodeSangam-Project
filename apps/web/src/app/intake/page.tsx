'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateTicketSchema, CreateTicketInput, CategoryEnum, PriorityEnum, AttachmentMeta } from '@vishanti/shared';
import { useAuth } from '../../components/auth-provider';
import { computeFileSHA256 } from '../../lib/crypto';
import { uploadAttachmentDirectly } from '../../lib/s3-upload';
import { apiFetch } from '../../lib/api-client';
import { ReceiptModal } from '../../components/receipt-modal';
import {
  Shield,
  ShieldAlert,
  Upload,
  FileCheck,
  Trash2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Lock,
  Clock,
  Send,
} from 'lucide-react';

function GrievanceIntakeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, user } = useAuth();

  const [isAnonymous, setIsAnonymous] = useState(false);
  const [attachments, setAttachments] = useState<
    Array<{ file: File; meta: AttachmentMeta; isUploading: boolean }>
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal State for Anonymous Success
  const [modalOpen, setModalOpen] = useState(false);
  const [createdTicketInfo, setCreatedTicketInfo] = useState<{
    id: string;
    secret: string;
    title: string;
  } | null>(null);

  useEffect(() => {
    if (searchParams.get('mode') === 'anonymous') {
      setIsAnonymous(true);
    }
  }, [searchParams]);

  // useForm: React Hook Form initialize karte hain
  // TS CONCEPT (<CreateTicketInput>): Form ka data wahi hoga jo CreateTicketSchema me define hai
  // zodResolver: User ke har keystroke par Zod schema se validation check karta hai
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateTicketInput>({
    resolver: zodResolver(CreateTicketSchema),
    defaultValues: {
      title: '',
      description: '',
      category: 'ACADEMIC',
      priority: 'MEDIUM',
      isAnonymous: false,
      attachments: [],
    },
  });

  const selectedCategory = watch('category');
  const selectedPriority = watch('priority');

  // handleFileChange: User jab file attach karega:
  // 1. File size check hoti hai (max 10MB)
  // 2. Web Crypto API se turant SHA-256 hash banta hai aur UI me display hota hai
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds the 10MB limit.');
      return;
    }

    // Client-side SHA-256 hash generation
    const hash = await computeFileSHA256(file);
    const newAttachment = {
      file,
      meta: {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        storageKey: `pending_${Date.now()}_${file.name}`,
        sha256Hash: hash,
      },
      isUploading: false,
    };

    setAttachments((prev) => [...prev, newAttachment]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // onSubmit: Jab user "Submit Petition" button click karega:
  const onSubmit = async (data: CreateTicketInput) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Step 1: Har attachment ko presigned URL ke zariye direct MinIO / S3 me upload karte hain
      const uploadedMetas: AttachmentMeta[] = [];
      for (const item of attachments) {
        const meta = await uploadAttachmentDirectly(item.file);
        uploadedMetas.push(meta);
      }

      // Step 2: Anonymous receipt secret server banata hai, isliye browser apna alag secret nahi bhejta.
      const payload = {
        ...data,
        isAnonymous,
        attachments: uploadedMetas,
      };

      // Step 3: Fastify backend ke /api/tickets endpoint par POST request bhejte hain (with auto Idempotency-Key)
      const res = await apiFetch<any>('/api/tickets', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success && res.data) { // Server se ticket ki asal receipt aayi ho to use screen par dikhate hain.
        const createdTicket = res.data.ticket || res.data; // API ka ticket andar ho ya seedha ho, dono roop sambhalte hain.
        if (isAnonymous) {
          const serverSecret = res.data.receiptSecret; // Sirf server ka banaya hua secret user ki asli receipt hota hai.
          if (!createdTicket.id || !serverSecret) throw new Error('The server did not return the anonymous receipt. Please retry.'); // Asli receipt na ho to jhootha code dikhane ke bajay saaf error dikhate hain.
          setCreatedTicketInfo({
            id: createdTicket.id,
            secret: serverSecret,
            title: data.title,
          });
          setModalOpen(true);
        } else {
          router.push('/dashboard');
        }
      } else { // Server ne ticket na banaya ho to nakli receipt dene ke bajay wajah dikhate hain.
        setErrorMessage(res.error || 'The petition could not be saved. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit petition. Please check connections.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-6 pb-16">
      {/* Page Header */}
      <div className="space-y-2 border-b border-slate-800 pb-5">
        <div className="inline-flex items-center space-x-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-0.5 text-xs font-semibold text-indigo-400">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Genesis Block Intake • Seq #0</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          Lodge Collegiate Petition
        </h1>
        <p className="text-sm text-slate-400">
          Your complaint will be immutably recorded into the SHA-256 cryptographic audit ledger.
        </p>
      </div>

      {errorMessage && (
        <div className="flex items-center space-x-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Anonymous Mode Switcher Banner */}
      <div
        className={`rounded-2xl border p-5 transition ${
          isAnonymous
            ? 'border-amber-500/40 bg-amber-950/20 shadow-lg shadow-amber-950/30'
            : 'border-slate-800 bg-slate-900/60'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                isAnonymous
                  ? 'border-amber-500/40 bg-amber-500/20 text-amber-400'
                  : 'border-slate-700 bg-slate-800 text-slate-400'
              }`}
            >
              {isAnonymous ? <ShieldAlert className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {isAnonymous ? 'Structural Anonymous Mode Active' : 'Identified Petition Mode'}
              </h3>
              <p className="text-xs text-slate-400">
                {isAnonymous
                  ? 'Zero PII or IP logged. Tracking via one-time 32-byte receipt key.'
                  : `Filing as ${user?.name || user?.email || 'Logged-In Petitioner'}`}
              </p>
            </div>
          </div>

          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => {
                setIsAnonymous(e.target.checked);
                setValue('isAnonymous', e.target.checked);
              }}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-slate-800 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-slate-400 after:transition-all after:content-[''] peer-checked:bg-amber-600 peer-checked:after:translate-x-full peer-checked:after:bg-white peer-focus:outline-none"></div>
          </label>
        </div>

        {isAnonymous && (
          <div className="mt-3.5 border-t border-amber-500/20 pt-3 text-[11px] text-amber-300/80 leading-relaxed">
            🛡️ <strong>Cryptographic Guarantee:</strong> Upon submission, you will receive an exclusive high-entropy receipt secret. Do not close this tab until you copy it.
          </div>
        )}
      </div>

      {/* Main Intake Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        
        {/* Category & Priority Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Grievance Category
            </label>
            <select
              {...register('category')}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-2.5 text-sm text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ACADEMIC">Academic & Grading Irregularities</option>
              <option value="HOSTEL_MESS">Hostel, Living & Mess Conditions</option>
              <option value="FINANCIAL_FEES">Financial Aid & Fee Disputes</option>
              <option value="HARASSMENT_DISCIPLINARY">Harassment & Disciplinary Concerns</option>
              <option value="INFRASTRUCTURE">Campus Infrastructure & Facilities</option>
              <option value="ADMINISTRATION">Administrative & Registrar Delays</option>
            </select>
            {errors.category && <p className="text-xs text-rose-400">{errors.category.message}</p>}
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Urgency / Priority Tier
            </label>
            <select
              {...register('priority')}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-2.5 text-sm text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="LOW">Low (Standard Inquiry • 48h SLA)</option>
              <option value="MEDIUM">Medium (General Complaint • 24h SLA)</option>
              <option value="HIGH">High (Urgent Redressal • 12h SLA)</option>
              <option value="CRITICAL">Critical (Immediate Escalation • 4h SLA)</option>
            </select>
            {errors.priority && <p className="text-xs text-rose-400">{errors.priority.message}</p>}
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Petition Title / Summary
          </label>
          <input
            type="text"
            {...register('title')}
            placeholder="e.g. Unsanitary food conditions in Girls Hostel 3 Mess"
            className={`w-full rounded-xl border bg-slate-900/90 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:ring-2 focus:ring-indigo-500 ${
              errors.title ? 'border-rose-500' : 'border-slate-800 focus:border-indigo-500'
            }`}
          />
          {errors.title && <p className="text-xs text-rose-400">{errors.title.message}</p>}
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Detailed Statement of Facts
          </label>
          <textarea
            rows={5}
            {...register('description')}
            placeholder="Provide specific details, dates, affected students, and attempts made to contact authorities..."
            className={`w-full rounded-xl border bg-slate-900/90 p-4 text-sm text-white placeholder-slate-500 outline-none transition focus:ring-2 focus:ring-indigo-500 ${
              errors.description ? 'border-rose-500' : 'border-slate-800 focus:border-indigo-500'
            }`}
          ></textarea>
          {errors.description && <p className="text-xs text-rose-400">{errors.description.message}</p>}
        </div>

        {/* Direct S3 Attachment Picker + Browser SHA-256 Checksum */}
        <div className="space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center justify-between">
            <span>Evidence & Documentation Attachments</span>
            <span className="text-[10px] text-slate-500">Max 10MB per file • Direct S3 Upload</span>
          </label>

          {/* Upload Drop Area */}
          <div className="relative rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900/40 p-6 text-center transition hover:border-slate-700">
            <input
              type="file"
              onChange={handleFileChange}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
            />
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400">
                <Upload className="h-5 w-5" />
              </div>
              <p className="text-xs font-medium text-slate-300">
                Click to browse or drop evidentiary files here
              </p>
              <p className="text-[11px] text-slate-500">
                Files are hashed with Web Crypto SHA-256 before upload
              </p>
            </div>
          </div>

          {/* Attached Files List */}
          {attachments.length > 0 && (
            <div className="space-y-2 pt-2">
              {attachments.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-xs"
                >
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <FileCheck className="h-5 w-5 flex-shrink-0 text-emerald-400" />
                    <div className="overflow-hidden">
                      <p className="font-semibold text-white truncate">{item.meta.fileName}</p>
                      <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono">
                        <span>{(item.meta.fileSize / 1024).toFixed(1)} KB</span>
                        <span>•</span>
                        <span className="text-emerald-400">
                          SHA-256: {item.meta.sha256Hash.slice(0, 16)}...
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit Action */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center space-x-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white shadow-xl shadow-indigo-600/30 transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Hashing & Committing to Ledger...</span>
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span>
                  {isAnonymous
                    ? 'Submit Anonymous Petition (Generate Receipt Secret)'
                    : 'Commit Petition to Blockchain/Ledger'}
                </span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* One-Time Anonymous Receipt Code Modal */}
      {createdTicketInfo && (
        <ReceiptModal
          isOpen={modalOpen}
          ticketId={createdTicketInfo.id}
          receiptSecret={createdTicketInfo.secret}
          title={createdTicketInfo.title}
        />
      )}
    </div>
  );
}

export default function GrievanceIntakePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center text-sm text-slate-400">
          Loading Intake Portal...
        </div>
      }
    >
      <GrievanceIntakeContent />
    </Suspense>
  );
}
