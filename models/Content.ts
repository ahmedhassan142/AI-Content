import mongoose from 'mongoose';

export interface IContent extends mongoose.Document {
  userId: string; // Can be user ID or guest session ID
  isGuest: boolean; // Flag to identify guest content
  title: string;
  content: string;
  originalContent?: string;
  type: 'generated' | 'rewritten' | 'saved';
  tone?: string;
  length?: string;
  language?: string;
  seoKeywords?: string[];
  plagiarismScore?: number;
  isFavorite: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const contentSchema = new mongoose.Schema<IContent>(
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
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    originalContent: {
      type: String,
    },
    type: {
      type: String,
      enum: ['generated', 'rewritten', 'saved'],
      default: 'generated',
    },
    tone: String,
    length: String,
    language: String,
    seoKeywords: [String],
    plagiarismScore: Number,
    isFavorite: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for faster queries
contentSchema.index({ userId: 1, createdAt: -1 });
contentSchema.index({ userId: 1, isFavorite: 1 });

export default mongoose.models.Content || mongoose.model<IContent>('Content', contentSchema);