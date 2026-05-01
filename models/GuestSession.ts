import mongoose from 'mongoose';

export interface IGuestSession extends mongoose.Document {
  sessionId: string;
  userId?: string; // If converted to user
  usageCount: number;
  maxFreeGenerations: number;
  createdAt: Date;
  expiresAt: Date;
  convertedAt?: Date;
}

const guestSessionSchema = new mongoose.Schema<IGuestSession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
    },
    userId: {
      type: String,
      ref: 'User',
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    maxFreeGenerations: {
      type: Number,
      default: 5,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    convertedAt: Date,
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.GuestSession || mongoose.model<IGuestSession>('GuestSession', guestSessionSchema);