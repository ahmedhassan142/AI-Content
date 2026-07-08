import mongoose from 'mongoose';

/**
 * A WordPress site connection owned by a user.
 *
 * The application password is stored as-is (the raw value the user pastes
 * from WordPress). When making API calls we base64-encode
 * `${wpUsername}:${wpApplicationPassword}` and send it as a Basic Auth header.
 */
export interface IWordPressSite extends mongoose.Document {
  userId: string;
  siteName: string;
  siteUrl: string;
  wpUsername: string;
  wpApplicationPassword: string;
  defaultStatus: 'draft' | 'publish';
  defaultCategoryId?: number;
  isConnected: boolean;
  lastPublishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const WORDPRESS_STATUSES = ['draft', 'publish'] as const;
export type WordPressStatus = (typeof WORDPRESS_STATUSES)[number];

const wordpressSiteSchema = new mongoose.Schema<IWordPressSite>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    siteName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    siteUrl: {
      type: String,
      required: true,
      trim: true,
    },
    wpUsername: {
      type: String,
      required: true,
      trim: true,
    },
    wpApplicationPassword: {
      type: String,
      required: true,
      // Stored as-is — base64 encoded only when sent over the wire.
    },
    defaultStatus: {
      type: String,
      enum: WORDPRESS_STATUSES,
      default: 'draft',
    },
    defaultCategoryId: {
      type: Number,
      default: null,
    },
    isConnected: {
      type: Boolean,
      default: true,
    },
    lastPublishedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Faster lookup of all sites for a given user.
wordpressSiteSchema.index({ userId: 1, isConnected: 1 });

export default (mongoose.models.WordPressSite as mongoose.Model<IWordPressSite>) ||
  mongoose.model<IWordPressSite>('WordPressSite', wordpressSiteSchema);
