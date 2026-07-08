'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Webhook,
  Plus,
  Trash2,
  Send,
  Copy,
  Check,
  Loader2,
  ChevronDown,
  ChevronRight,
  Code2,
  X,
  AlertCircle,
  Pause,
  Play,
  ShieldCheck,
  Clock,
  Activity,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

// ----- Types ---------------------------------------------------------------

interface WebhookItem {
  _id: string;
  userId: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  lastFiredAt: string | null;
  lastStatus: 'success' | 'failed' | 'pending' | null;
  lastResponseCode: number | null;
  createdAt: string;
  updatedAt: string;
  secret?: string;
}

interface Delivery {
  _id: string;
  webhookId: string;
  event: string;
  payload: unknown;
  statusCode: number | null;
  response: string;
  success: boolean;
  durationMs: number;
  error: string | null;
  createdAt: string;
}

// ----- Event catalogue -----------------------------------------------------

const EVENT_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: 'content.generated', label: 'Content Generated', description: 'AI generates new content.' },
  { value: 'content.saved', label: 'Content Saved', description: 'User saves content.' },
  { value: 'content.favorited', label: 'Content Favorited', description: 'User marks content as favorite.' },
  { value: 'seo.audited', label: 'SEO Audited', description: 'SEO audit completes.' },
  { value: 'seo.fixed', label: 'SEO Fixed', description: 'SEO issues auto-fixed.' },
  { value: 'plagiarism.fixed', label: 'Plagiarism Fixed', description: 'Plagiarism rewritten.' },
  { value: 'content.humanized', label: 'Content Humanized', description: 'AI text → human-like text.' },
];

function eventLabel(value: string): string {
  return EVENT_OPTIONS.find((e) => e.value === value)?.label ?? value;
}

// ----- Receiver code samples ----------------------------------------------

const NEXTJS_RECEIVER = `// app/api/webhooks/ai-content/route.ts
// Next.js 16 receiver — saves AI Content Writer webhook events to MongoDB.
//
// 1.  npm install mongoose
// 2.  Set MONGODB_URI in .env
// 3.  Set AI_CONTENT_WEBHOOK_SECRET in .env to the secret shown in the UI.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI!;
const WEBHOOK_SECRET = process.env.AI_CONTENT_WEBHOOK_SECRET!;

// --- Mongoose schema + model ----------------------------------------------
// Stored exactly once; reused on hot reloads.
const SavedContentSchema = new mongoose.Schema(
  {
    sourceId: { type: String, index: true },         // _id from AI Content Writer
    userId: { type: String, index: true },            // AI Content Writer user
    event: { type: String, required: true, index: true },
    title: { type: String, default: '' },
    content: { type: String, default: '' },
    type: { type: String, default: 'generated' },
    tone: { type: String },
    length: { type: String },
    language: { type: String },
    seoKeywords: { type: [String], default: [] },
    plagiarismScore: { type: Number, default: null },
    seoScore: { type: Number, default: null },
    seoIssues: { type: [String], default: [] },
    originalContent: { type: String },
    isFavorite: { type: Boolean, default: false },
    receivedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

SavedContentSchema.index({ userId: 1, event: 1, createdAt: -1 });

const SavedContent =
  mongoose.models.SavedContent ||
  mongoose.model('SavedContent', SavedContentSchema);

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(MONGODB_URI);
}

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const expected =
    'sha256=' +
    crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-aicontent-signature');
    const event = request.headers.get('x-aicontent-event') || '';

    if (!verifySignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const { userId, data } = payload;
    const eventData = data || {};

    await connectDB();

    // Save every event into one collection for easy querying.
    await SavedContent.create({
      sourceId: eventData._id || eventData.id || null,
      userId: userId || null,
      event,
      title: eventData.title || '',
      content: eventData.content || eventData.text || '',
      type: eventData.type || null,
      tone: eventData.tone || null,
      length: eventData.length || null,
      language: eventData.language || null,
      seoKeywords: eventData.seoKeywords || [],
      plagiarismScore: eventData.plagiarismScore ?? null,
      seoScore: eventData.seoScore ?? null,
      seoIssues: eventData.seoIssues || [],
      originalContent: eventData.originalContent || null,
      isFavorite: eventData.isFavorite ?? false,
    });

    console.log(\`[ai-content] Saved webhook event: \${event}\`);
    return NextResponse.json({ received: true, event });
  } catch (err) {
    console.error('[ai-content] Webhook error:', err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
`;

const EXPRESS_RECEIVER = `// server.js — Express receiver for AI Content Writer webhooks.
// Saves each event into MongoDB via Mongoose.
//
//   npm install express mongoose
//
// Run:  AI_CONTENT_WEBHOOK_SECRET=xxxx MONGODB_URI=mongodb://... node server.js

const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const WEBHOOK_SECRET = process.env.AI_CONTENT_WEBHOOK_SECRET;

// Raw body capture so we can verify the HMAC signature reliably.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req).rawBody = buf.toString('utf8');
    },
  })
);

// --- Mongoose schema + model ----------------------------------------------
const SavedContentSchema = new mongoose.Schema(
  {
    sourceId: { type: String, index: true },
    userId: { type: String, index: true },
    event: { type: String, required: true, index: true },
    title: { type: String, default: '' },
    content: { type: String, default: '' },
    type: { type: String },
    tone: { type: String },
    length: { type: String },
    language: { type: String },
    seoKeywords: { type: [String], default: [] },
    plagiarismScore: { type: Number, default: null },
    seoScore: { type: Number, default: null },
    seoIssues: { type: [String], default: [] },
    originalContent: { type: String },
    isFavorite: { type: Boolean, default: false },
    receivedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
SavedContentSchema.index({ userId: 1, event: 1, createdAt: -1 });

const SavedContent =
  mongoose.models.SavedContent ||
  mongoose.model('SavedContent', SavedContentSchema);

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(MONGODB_URI);
}

function verifySignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  const expected =
    'sha256=' +
    crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

app.post('/api/webhooks/ai-content', async (req, res) => {
  try {
    const signature = req.headers['x-aicontent-signature'] || null;
    const event = req.headers['x-aicontent-event'] || '';

    if (!verifySignature(req.rawBody, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const payload = req.body || {};
    const { userId, data } = payload;
    const eventData = data || {};

    await connectDB();

    await SavedContent.create({
      sourceId: eventData._id || eventData.id || null,
      userId: userId || null,
      event,
      title: eventData.title || '',
      content: eventData.content || eventData.text || '',
      type: eventData.type || null,
      tone: eventData.tone || null,
      length: eventData.length || null,
      language: eventData.language || null,
      seoKeywords: eventData.seoKeywords || [],
      plagiarismScore: eventData.plagiarismScore ?? null,
      seoScore: eventData.seoScore ?? null,
      seoIssues: eventData.seoIssues || [],
      originalContent: eventData.originalContent || null,
      isFavorite: eventData.isFavorite ?? false,
    });

    console.log('[ai-content] Saved webhook event:', event);
    return res.status(200).json({ received: true, event });
  } catch (err) {
    console.error('[ai-content] Webhook error:', err);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
});

connectDB()
  .then(() => app.listen(PORT, () => console.log(\`Express listening on :\${PORT}\`)))
  .catch((err) => {
    console.error('Failed to start:', err);
    process.exit(1);
  });
`;

const PHP_RECEIVER = `<?php
/**
 * webhook-ai-content.php
 * Receiver for AI Content Writer webhooks.
 *
 * Saves the event payload to a MySQL table (PDO) OR — if running inside
 * WordPress — creates a real post via wp_insert_post().
 *
 * Setup:
 *   1. Edit $WEBHOOK_SECRET to the value shown in the AI Content Writer UI.
 *   2. Create the MySQL table (SQL below).
 *   3. Point your webhook URL to https://your-site.com/webhook-ai-content.php
 */

// ---- Config --------------------------------------------------------------
$WEBHOOK_SECRET = 'PASTE_YOUR_SECRET_HERE';

// ---- MySQL table (run once) ---------------------------------------------
/*
CREATE TABLE IF NOT EXISTS ai_content_webhooks (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  source_id    VARCHAR(64),
  user_id      VARCHAR(64),
  event        VARCHAR(64)  NOT NULL,
  title        VARCHAR(255) NOT NULL DEFAULT '',
  content      LONGTEXT     NOT NULL,
  type         VARCHAR(32),
  tone         VARCHAR(32),
  length       VARCHAR(32),
  language     VARCHAR(32),
  seo_keywords JSON,
  plagiarism_score DOUBLE,
  seo_score    DOUBLE,
  seo_issues   JSON,
  is_favorite  TINYINT(1)  NOT NULL DEFAULT 0,
  received_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (user_id),
  INDEX (event),
  INDEX (received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf88mb4;
*/

// ---- Helpers -------------------------------------------------------------
function verify_signature(string $raw_body, string $secret, ?string $sig_header): bool {
    if (!$sig_header) return false;
    $expected = 'sha256=' . hash_hmac('sha256', $raw_body, $secret);
    return hash_equals($expected, $sig_header);
}

function pdo(): PDO {
    $dsn = 'mysql:host=' . getenv('DB_HOST') . ';dbname=' . getenv('DB_NAME') . ';charset=utf8mb4';
    return new PDO($dsn, getenv('DB_USER'), getenv('DB_PASS'), [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
}

// ---- Main ----------------------------------------------------------------
$raw_body = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_AICONTENT_SIGNATURE'] ?? null;
$event = $_SERVER['HTTP_X_AICONTENT_EVENT'] ?? '';

if (!verify_signature($raw_body, $WEBHOOK_SECRET, $signature)) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Invalid signature']);
    exit;
}

$payload = json_decode($raw_body, true) ?: [];
$user_id = $payload['userId'] ?? null;
$data = $payload['data'] ?? [];

// ----- Option A: Plain MySQL via PDO --------------------------------------
try {
    $pdo = pdo();
    $stmt = $pdo->prepare(
        'INSERT INTO ai_content_webhooks
            (source_id, user_id, event, title, content, type, tone, length,
             language, seo_keywords, plagiarism_score, seo_score, seo_issues, is_favorite)
         VALUES
            (:source_id, :user_id, :event, :title, :content, :type, :tone, :length,
             :language, :seo_keywords, :plagiarism_score, :seo_score, :seo_issues, :is_favorite)'
    );

    $stmt->execute([
        ':source_id'        => $data['_id'] ?? $data['id'] ?? null,
        ':user_id'          => $user_id,
        ':event'            => $event,
        ':title'            => $data['title'] ?? '',
        ':content'          => $data['content'] ?? $data['text'] ?? '',
        ':type'             => $data['type'] ?? null,
        ':tone'             => $data['tone'] ?? null,
        ':length'           => $data['length'] ?? null,
        ':language'         => $data['language'] ?? null,
        ':seo_keywords'     => json_encode($data['seoKeywords'] ?? []),
        ':plagiarism_score' => $data['plagiarismScore'] ?? null,
        ':seo_score'        => $data['seoScore'] ?? null,
        ':seo_issues'       => json_encode($data['seoIssues'] ?? []),
        ':is_favorite'      => !empty($data['isFavorite']) ? 1 : 0,
    ]);

    error_log("[ai-content] Saved webhook event: {$event}");
} catch (Throwable $e) {
    error_log('[ai-content] PDO error: ' . $e->getMessage());
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Database error']);
    exit;
}

// ----- Option B: WordPress (uncomment if running inside WP) ---------------
/*
require_once __DIR__ . '/wp-load.php';

$post_id = wp_insert_post([
    'post_title'   => sanitize_text_field($data['title'] ?? 'AI Content'),
    'post_content' => wp_kses_post($data['content'] ?? ''),
    'post_status'  => 'draft',
    'post_type'    => 'post',
    'post_author'  => 1, // site admin
    'meta_input'   => [
        'ai_content_event'      => $event,
        'ai_content_user_id'    => $user_id,
        'ai_content_source_id'  => $data['_id'] ?? $data['id'] ?? '',
        'ai_content_tone'       => $data['tone'] ?? '',
        'ai_content_language'   => $data['language'] ?? '',
        'ai_content_seo_score'  => $data['seoScore'] ?? '',
        'ai_content_plagiarism' => $data['plagiarismScore'] ?? '',
    ],
]);

if (is_wp_error($post_id)) {
    error_log('[ai-content] wp_insert_post error: ' . $post_id->get_error_message());
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'WordPress insert failed']);
    exit;
}
*/

header('Content-Type: application/json');
http_response_code(200);
echo json_encode(['received' => true, 'event' => $event]);
`;

const RECEIVER_TABS: { id: 'nextjs' | 'express' | 'php'; label: string; code: string }[] = [
  { id: 'nextjs', label: 'Next.js', code: NEXTJS_RECEIVER },
  { id: 'express', label: 'Express.js', code: EXPRESS_RECEIVER },
  { id: 'php', label: 'PHP / WordPress', code: PHP_RECEIVER },
];

// ----- Small UI helpers ---------------------------------------------------

function StatusDot({ status }: { status: WebhookItem['lastStatus'] }) {
  const color =
    status === 'success'
      ? 'bg-green-500'
      : status === 'failed'
        ? 'bg-red-500'
        : status === 'pending'
          ? 'bg-yellow-500'
          : 'bg-gray-300';
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ----- Main component ------------------------------------------------------

export default function WebhooksContent() {
  const router = useRouter();
  const { user, loading: authLoading, getAuthHeader } = useAuth();

  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [showReceiver, setShowReceiver] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formSecret, setFormSecret] = useState('');
  const [formEvents, setFormEvents] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Banner: secret shown once after creation
  const [createdSecret, setCreatedSecret] = useState<{ name: string; secret: string } | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);

  // Per-card UI state
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [deliveries, setDeliveries] = useState<Record<string, Delivery[]>>({});
  const [loadingDeliveries, setLoadingDeliveries] = useState<Record<string, boolean>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Receiver code state
  const [activeTab, setActiveTab] = useState<'nextjs' | 'express' | 'php'>('nextjs');
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user) fetchWebhooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const fetchWebhooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/webhooks', { headers: getAuthHeader() });
      const data = await res.json();
      if (data.success) {
        setWebhooks(data.webhooks as WebhookItem[]);
      } else {
        setError(data.error || 'Failed to fetch webhooks');
        if (res.status === 401) router.push('/login');
      }
    } catch (err) {
      console.error(err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader, router]);

  const toggleEventCheckbox = (value: string) => {
    setFormEvents((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleCreate = async () => {
    setFormError(null);

    if (!formName.trim()) {
      setFormError('Name is required.');
      return;
    }
    try {
      // Validate URL client-side first.
      const u = new URL(formUrl);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        setFormError('URL must start with http:// or https://');
        return;
      }
    } catch {
      setFormError('Enter a valid URL.');
      return;
    }
    if (formEvents.length === 0) {
      setFormError('Select at least one event.');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({
          name: formName.trim(),
          url: formUrl.trim(),
          events: formEvents,
          secret: formSecret.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success && data.webhook) {
        setWebhooks((prev) => [
          { ...data.webhook, secret: undefined } as WebhookItem,
          ...prev,
        ]);
        if (data.webhook.secret) {
          setCreatedSecret({ name: data.webhook.name, secret: data.webhook.secret });
          setSecretCopied(false);
        }
        // Reset form
        setFormName('');
        setFormUrl('');
        setFormSecret('');
        setFormEvents([]);
        setShowCreate(false);
      } else {
        setFormError(data.error || 'Failed to create webhook.');
      }
    } catch {
      setFormError('Network error. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (webhook: WebhookItem) => {
    setTogglingId(webhook._id);
    try {
      const res = await fetch(`/api/webhooks/${webhook._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ isActive: !webhook.isActive }),
      });
      const data = await res.json();
      if (data.success && data.webhook) {
        setWebhooks((prev) =>
          prev.map((w) => (w._id === webhook._id ? data.webhook : w))
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTogglingId(null);
    }
  };

  const handleTest = async (webhook: WebhookItem) => {
    setTestingId(webhook._id);
    try {
      const res = await fetch(`/api/webhooks/${webhook._id}/test`, {
        method: 'POST',
        headers: getAuthHeader(),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh list to reflect updated lastFiredAt/lastStatus.
        await fetchWebhooks();
        // Auto-expand delivery log so the user sees the result.
        setExpanded((prev) => ({ ...prev, [webhook._id]: true }));
        await loadDeliveries(webhook._id);
      } else {
        alert(data.error || 'Test failed');
      }
    } catch (err) {
      console.error(err);
      alert('Network error sending test.');
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (webhook: WebhookItem) => {
    if (!confirm(`Delete webhook "${webhook.name}"? This cannot be undone.`)) return;
    setDeletingId(webhook._id);
    try {
      const res = await fetch(`/api/webhooks/${webhook._id}`, {
        method: 'DELETE',
        headers: getAuthHeader(),
      });
      const data = await res.json();
      if (data.success) {
        setWebhooks((prev) => prev.filter((w) => w._id !== webhook._id));
      } else {
        alert(data.error || 'Failed to delete.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error deleting.');
    } finally {
      setDeletingId(null);
    }
  };

  const loadDeliveries = async (id: string) => {
    setLoadingDeliveries((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/webhooks/${id}/deliveries`, {
        headers: getAuthHeader(),
      });
      const data = await res.json();
      if (data.success) {
        setDeliveries((prev) => ({ ...prev, [id]: data.deliveries as Delivery[] }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDeliveries((prev) => ({ ...prev, [id]: false }));
    }
  };

  const toggleExpanded = (webhook: WebhookItem) => {
    setExpanded((prev) => {
      const next = { ...prev, [webhook._id]: !prev[webhook._id] };
      if (next[webhook._id] && !deliveries[webhook._id]) {
        loadDeliveries(webhook._id);
      }
      return next;
    });
  };

  const copyToClipboard = async (text: string, onDone: () => void) => {
    try {
      await navigator.clipboard.writeText(text);
      onDone();
      setTimeout(onDone, 2000);
    } catch (err) {
      console.error('Clipboard error', err);
    }
  };

  const activeTabCode = RECEIVER_TABS.find((t) => t.id === activeTab)?.code || '';

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-purple-600 transition mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-sm">
              <Webhook className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Webhook Integrations
              </h1>
              <p className="text-gray-700 mt-1 text-sm">
                Send content, SEO data, and fixes to your website automatically.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowReceiver(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition text-sm font-medium text-gray-800"
            >
              <Code2 className="w-4 h-4" />
              Receiver Code
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:opacity-90 transition text-sm font-medium shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Webhook
            </button>
          </div>
        </div>

        {/* Created-secret banner */}
        <AnimatePresence>
          {createdSecret && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 overflow-hidden"
            >
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-green-800">
                      Webhook “{createdSecret.name}” created — copy your signing secret now.
                    </p>
                    <p className="text-xs text-green-700 mt-0.5">
                      The secret is only shown once — store it safely.
                    </p>

                    <div className="mt-3 flex flex-col sm:flex-row gap-2">
                      <code className="flex-1 bg-white border border-green-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-800 overflow-x-auto break-all">
                        {createdSecret.secret}
                      </code>
                      <button
                        onClick={() =>
                          copyToClipboard(createdSecret.secret, () => setSecretCopied(true))
                        }
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition"
                      >
                        {secretCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" /> Copy
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setCreatedSecret(null)}
                        className="inline-flex items-center justify-center px-3 py-2 rounded-lg border border-green-200 text-green-700 text-xs font-medium hover:bg-green-100 transition"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button
              onClick={fetchWebhooks}
              className="text-xs font-medium text-red-700 underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Webhook list */}
        {webhooks.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-purple-50 flex items-center justify-center mb-4">
              <Webhook className="w-8 h-8 text-purple-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No webhooks yet</h3>
            <p className="text-gray-700 mb-4 text-sm max-w-md mx-auto">
              Create your first webhook to push content, SEO audits, and fixes to your site.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium hover:opacity-90 transition"
            >
              <Plus className="w-4 h-4" />
              Add Webhook
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {webhooks.map((wh, idx) => (
              <motion.div
                key={wh._id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
              >
                {/* Card header */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">{wh.name}</h3>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                            wh.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {wh.isActive ? 'Active' : 'Paused'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-700 truncate font-mono">{wh.url}</p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleToggleActive(wh)}
                        disabled={togglingId === wh._id}
                        title={wh.isActive ? 'Pause' : 'Activate'}
                        className={`p-2 rounded-lg transition ${
                          wh.isActive
                            ? 'text-gray-600 hover:bg-gray-100'
                            : 'text-green-600 hover:bg-green-50'
                        } disabled:opacity-50`}
                      >
                        {togglingId === wh._id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : wh.isActive ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleTest(wh)}
                        disabled={testingId === wh._id}
                        title="Send test event"
                        className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition disabled:opacity-50"
                      >
                        {testingId === wh._id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(wh)}
                        disabled={deletingId === wh._id}
                        title="Delete"
                        className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition disabled:opacity-50"
                      >
                        {deletingId === wh._id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Events */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {wh.events.length === 0 ? (
                      <span className="text-xs text-gray-600 italic">No events subscribed</span>
                    ) : (
                      wh.events.map((ev) => (
                        <span
                          key={ev}
                          className="text-[11px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100"
                        >
                          {eventLabel(ev)}
                        </span>
                      ))
                    )}
                  </div>

                  {/* Meta */}
                  <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-gray-700">
                    <span className="inline-flex items-center gap-1.5">
                      <StatusDot status={wh.lastStatus} />
                      {wh.lastStatus ? (
                        <span className="capitalize">{wh.lastStatus}</span>
                      ) : (
                        <span>Not fired yet</span>
                      )}
                      {wh.lastResponseCode !== null && (
                        <span className="text-gray-600">· {wh.lastResponseCode}</span>
                      )}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {timeAgo(wh.lastFiredAt)}
                    </span>
                    <button
                      onClick={() => toggleExpanded(wh)}
                      className="inline-flex items-center gap-1 text-gray-600 hover:text-purple-600 transition ml-auto"
                    >
                      <Activity className="w-3.5 h-3.5" />
                      {expanded[wh._id] ? 'Hide' : 'Show'} delivery log
                      {expanded[wh._id] ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Delivery log */}
                <AnimatePresence initial={false}>
                  {expanded[wh._id] && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-gray-100 bg-gray-50"
                    >
                      <div className="p-5">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold text-gray-800">
                            Recent deliveries
                          </h4>
                          <button
                            onClick={() => loadDeliveries(wh._id)}
                            className="text-xs text-purple-600 hover:underline"
                          >
                            Refresh
                          </button>
                        </div>

                        {loadingDeliveries[wh._id] && !deliveries[wh._id] ? (
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading…
                          </div>
                        ) : !deliveries[wh._id] || deliveries[wh._id].length === 0 ? (
                          <p className="text-sm text-gray-700">No deliveries yet.</p>
                        ) : (
                          <div className="space-y-2 max-h-96 overflow-y-auto">
                            {deliveries[wh._id].map((d) => (
                              <DeliveryRow key={d._id} delivery={d} />
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ----- Create webhook modal ----- */}
      <AnimatePresence>
        {showCreate && (
          <Modal onClose={() => setShowCreate(false)} title="Add Webhook">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="My website receiver"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Receiver URL
                </label>
                <input
                  type="url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://your-site.com/api/webhooks/ai-content"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                />
                <p className="text-xs text-gray-700 mt-1">
                  The HTTPS endpoint that receives POST requests.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Signing secret <span className="text-gray-600">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formSecret}
                  onChange={(e) => setFormSecret(e.target.value)}
                  placeholder="Leave blank to auto-generate"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                />
                <p className="text-xs text-gray-700 mt-1">
                  Verifies the <code>X-AIContent-Signature</code> header. Min 16 chars.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Events to subscribe
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {EVENT_OPTIONS.map((ev) => {
                    const checked = formEvents.includes(ev.value);
                    return (
                      <label
                        key={ev.value}
                        className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition ${
                          checked
                            ? 'border-purple-300 bg-purple-50'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleEventCheckbox(ev.value)}
                          className="mt-0.5 accent-purple-600"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">{ev.label}</p>
                          <p className="text-[11px] text-gray-700">{ev.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {formError && (
                <p className="text-sm text-red-600 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> {formError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Creating…
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" /> Create
                    </>
                  )}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ----- Receiver code modal ----- */}
      <AnimatePresence>
        {showReceiver && (
          <Modal onClose={() => setShowReceiver(false)} title="Receiver Code" wide>
            <div className="space-y-4">
              <p className="text-sm text-gray-700">
                Drop these snippets on your server. Each verifies the HMAC-SHA256 signature and saves the event to your database.
              </p>

              {/* Tabs */}
              <div className="flex flex-wrap gap-1.5 border-b border-gray-200">
                {RECEIVER_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-2 text-sm font-medium transition border-b-2 -mb-px ${
                      activeTab === tab.id
                        ? 'border-purple-600 text-purple-600'
                        : 'border-transparent text-gray-700 hover:text-gray-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Code block */}
              <div className="relative">
                <button
                  onClick={() =>
                    copyToClipboard(activeTabCode, () => setCodeCopied(true))
                  }
                  className="absolute top-2 right-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white border border-gray-200 text-xs font-medium text-gray-800 hover:bg-gray-50 transition z-10"
                >
                  {codeCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-600" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </>
                  )}
                </button>
                <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 text-xs leading-relaxed overflow-x-auto max-h-[60vh]">
                  <code>{activeTabCode}</code>
                </pre>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setShowReceiver(false)}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

// ----- Sub-components ------------------------------------------------------

function DeliveryRow({ delivery }: { delivery: Delivery }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-lg border border-gray-100">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2 text-left"
      >
        <StatusDot
          status={delivery.success ? 'success' : 'failed'}
        />
        <span className="text-xs font-medium text-gray-900">{delivery.event}</span>
        {delivery.statusCode !== null && (
          <span
            className={`text-[11px] px-1.5 py-0.5 rounded font-mono ${
              delivery.success
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {delivery.statusCode}
          </span>
        )}
        <span className="text-[11px] text-gray-600 ml-auto">{delivery.durationMs}ms</span>
        <span className="text-[11px] text-gray-600">
          {new Date(delivery.createdAt).toLocaleString()}
        </span>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-gray-100"
          >
            <div className="p-3 space-y-2">
              {delivery.error && (
                <div>
                  <p className="text-[11px] font-semibold text-red-600 uppercase mb-1">Error</p>
                  <pre className="text-xs text-red-700 bg-red-50 rounded p-2 overflow-x-auto">
                    {delivery.error}
                  </pre>
                </div>
              )}
              <div>
                <p className="text-[11px] font-semibold text-gray-700 uppercase mb-1">Payload</p>
                <pre className="text-xs text-gray-800 bg-gray-50 rounded p-2 overflow-x-auto">
                  {JSON.stringify(delivery.payload, null, 2)}
                </pre>
              </div>
              {delivery.response && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-700 uppercase mb-1">
                    Response body
                  </p>
                  <pre className="text-xs text-gray-800 bg-gray-50 rounded p-2 overflow-x-auto max-h-40">
                    {delivery.response}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Modal({
  children,
  onClose,
  title,
  wide,
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
  wide?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        onClick={(e) => e.stopPropagation()}
        className={`bg-white rounded-2xl shadow-xl w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </motion.div>
    </motion.div>
  );
}
