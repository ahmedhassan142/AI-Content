import mongoose from 'mongoose';

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'info';

export interface SeoCheck {
  checkId: string;
  name: string;
  status: CheckStatus;
  score: number;
  message: string;
  details?: Record<string, unknown>;
  recommendation?: string;
}

export interface ActionPlanItem {
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  checkId: string;
}

export interface ISeoAudit extends mongoose.Document {
  userId: string;
  isGuest: boolean;
  url: string;
  normalizedUrl: string;
  finalUrl?: string;
  httpStatus?: number;
  responseTimeMs?: number;
  overallScore: number;
  totalChecks: number;
  passedChecks: number;
  warnedChecks: number;
  failedChecks: number;
  checks: SeoCheck[];
  actionPlan: ActionPlanItem[];
  createdAt: Date;
  updatedAt: Date;
}

const SeoCheckSchema = new mongoose.Schema(
  {
    checkId: { type: String, required: true },
    name: { type: String, required: true },
    status: {
      type: String,
      enum: ['pass', 'warn', 'fail', 'info'],
      required: true,
    },
    score: { type: Number, required: true, default: 0 },
    message: { type: String, required: true },
    details: { type: mongoose.Schema.Types.Mixed },
    recommendation: { type: String },
  },
  { _id: false }
);

const ActionPlanItemSchema = new mongoose.Schema(
  {
    priority: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    checkId: { type: String, required: true },
  },
  { _id: false }
);

const seoAuditSchema = new mongoose.Schema<ISeoAudit>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    isGuest: {
      type: Boolean,
      default: false,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    normalizedUrl: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    finalUrl: { type: String },
    httpStatus: { type: Number },
    responseTimeMs: { type: Number },
    overallScore: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    totalChecks: { type: Number, default: 0 },
    passedChecks: { type: Number, default: 0 },
    warnedChecks: { type: Number, default: 0 },
    failedChecks: { type: Number, default: 0 },
    checks: [SeoCheckSchema],
    actionPlan: [ActionPlanItemSchema],
  },
  {
    timestamps: true,
  }
);

// Compound indexes for fast queries
seoAuditSchema.index({ userId: 1, createdAt: -1 });
seoAuditSchema.index({ normalizedUrl: 1, createdAt: -1 });
seoAuditSchema.index({ userId: 1, overallScore: -1 });

export default (mongoose.models.SeoAudit as mongoose.Model<ISeoAudit>) ||
  mongoose.model<ISeoAudit>('SeoAudit', seoAuditSchema);
