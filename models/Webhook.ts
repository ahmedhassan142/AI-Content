import mongoose from 'mongoose';

/**
 * List of all webhook events that can be fired by the platform.
 */
export const WEBHOOK_EVENTS = [
  'content.generated',
  'content.saved',
  'content.favorited',
  'seo.audited',
  'seo.fixed',
  'plagiarism.fixed',
  'content.humanized',
  'blog.published',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/**
 * Human-readable labels and descriptions for each webhook event.
 */
export const WEBHOOK_EVENT_LABELS: Record<
  WebhookEvent,
  { label: string; description: string }
> = {
  'content.generated': {
    label: 'Content Generated',
    description: 'Fires whenever the AI generates a new piece of content.',
  },
  'content.saved': {
    label: 'Content Saved',
    description: 'Fires when a user saves content to their library.',
  },
  'content.favorited': {
    label: 'Content Favorited',
    description: 'Fires when a user marks content as a favorite.',
  },
  'seo.audited': {
    label: 'SEO Audited',
    description: 'Fires when an SEO audit completes for a piece of content.',
  },
  'seo.fixed': {
    label: 'SEO Fixed',
    description: 'Fires when SEO issues are automatically fixed.',
  },
  'plagiarism.fixed': {
    label: 'Plagiarism Fixed',
    description: 'Fires when plagiarism issues are rewritten/fixed.',
  },
  'content.humanized': {
    label: 'Content Humanized',
    description: 'Fires when content is converted from AI-sounding to human-like text.',
  },
  'blog.published': {
    label: 'Blog Published',
    description:
      'Fires when a user explicitly publishes a piece of content to an external blog (e.g. the Tech Solutions portfolio site) via webhook.',
  },
};

export type WebhookLastStatus = 'success' | 'failed' | 'pending';

export interface IWebhook extends mongoose.Document {
  userId: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
  lastFiredAt: Date | null;
  lastStatus: WebhookLastStatus | null;
  lastResponseCode: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const webhookSchema = new mongoose.Schema<IWebhook>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    secret: {
      type: String,
      required: true,
    },
    events: {
      type: [String],
      default: [],
      validate: {
        validator: (events: string[]) =>
          Array.isArray(events) &&
          events.every((e) => WEBHOOK_EVENTS.includes(e as WebhookEvent)),
        message: 'One or more events are not valid webhook events.',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastFiredAt: {
      type: Date,
      default: null,
    },
    lastStatus: {
      type: String,
      enum: ['success', 'failed', 'pending'],
      default: null,
    },
    lastResponseCode: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Faster lookup of a user's active webhooks for a specific event.
webhookSchema.index({ userId: 1, isActive: 1, events: 1 });

export default (mongoose.models.Webhook as mongoose.Model<IWebhook>) ||
  mongoose.model<IWebhook>('Webhook', webhookSchema);
