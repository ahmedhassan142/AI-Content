import mongoose from 'mongoose';

export interface IWebhookDelivery extends mongoose.Document {
  webhookId: mongoose.Types.ObjectId;
  userId: string;
  event: string;
  payload: unknown;
  statusCode: number | null;
  response: string;
  success: boolean;
  durationMs: number;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const webhookDeliverySchema = new mongoose.Schema<IWebhookDelivery>(
  {
    webhookId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    event: {
      type: String,
      required: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    statusCode: {
      type: Number,
      default: null,
    },
    response: {
      type: String,
      default: '',
      set: (v: unknown) => {
        if (v == null) return '';
        const str = typeof v === 'string' ? v : JSON.stringify(v);
        return str.length > 2000 ? str.slice(0, 2000) : str;
      },
    },
    success: {
      type: Boolean,
      default: false,
    },
    durationMs: {
      type: Number,
      default: 0,
    },
    error: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-expire delivery logs 30 days after creation.
webhookDeliverySchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });
webhookDeliverySchema.index({ webhookId: 1, createdAt: -1 });

export default (mongoose.models.WebhookDelivery as mongoose.Model<IWebhookDelivery>) ||
  mongoose.model<IWebhookDelivery>('WebhookDelivery', webhookDeliverySchema);
