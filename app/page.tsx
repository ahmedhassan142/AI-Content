'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Sparkles, FileText, PenTool, Globe, Search, ShieldCheck, SpellCheck,
  CheckCircle, ArrowRight, Play, Users, Clock, Star, ChevronRight,
  Cpu, Cloud, Rocket, Mail, Zap,
} from 'lucide-react';

export default function LandingPage() {
  const [isPlaying, setIsPlaying] = useState(false);

  const features = [
    { icon: Sparkles, title: 'AI-Powered Generation', desc: 'Create high-quality content in seconds with advanced AI models tuned for clarity and engagement.', color: 'from-purple-500 to-pink-500' },
    { icon: PenTool, title: 'Multiple Tones', desc: 'Professional, casual, friendly, persuasive — match the perfect tone for every audience.', color: 'from-blue-500 to-cyan-500' },
    { icon: Globe, title: 'Multi-Language', desc: 'Generate content in 50+ languages for global reach and localization.', color: 'from-green-500 to-emerald-500' },
    { icon: Search, title: 'SEO Optimization', desc: 'Get keyword suggestions and on-page SEO insights to rank higher on search engines.', color: 'from-orange-500 to-red-500' },
    { icon: ShieldCheck, title: 'Plagiarism Check', desc: 'Ensure your content is original and unique with built-in plagiarism detection.', color: 'from-indigo-500 to-purple-500' },
    { icon: SpellCheck, title: 'Grammar Correction', desc: 'Fix grammar issues, improve readability, and polish every sentence automatically.', color: 'from-yellow-500 to-amber-500' },
  ];

  const stats = [
    { value: '50K+', label: 'Active Users', icon: Users },
    { value: '1M+', label: 'Content Generated', icon: FileText },
    { value: '98%', label: 'Satisfaction Rate', icon: Star },
    { value: '24/7', label: 'AI Support', icon: Clock },
  ];

  const trustedBy = ['TechCrunch', 'Product Hunt', 'Indie Hackers', 'Maker Log', 'Hacker News'];

  // All features unlocked for every user — free forever
  const freeFeatures = [
    'Unlimited content generations',
    'All tones + custom tones',
    '50+ languages supported',
    '5,000 words per generation',
    'SEO keyword suggestions',
    'Plagiarism checker',
    'Grammar correction',
    'Content history & favorites',
    'SEO audit tools',
    'Webhooks & API access',
    'Priority support',
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-blue-50">
        {/* Animated background blobs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-[28rem] h-[28rem] bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-[28rem] h-[28rem] bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
          <div className="absolute top-1/3 left-1/2 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
          {/* Grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)',
              backgroundSize: '64px 64px',
            }}
          ></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-24 lg:pt-24 lg:pb-32">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: copy */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-100 rounded-full mb-6">
                <Rocket className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-800">AI-Powered Content Creation</span>
              </div>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] mb-6">
                <span className="block text-gray-900">Create amazing</span>
                <span className="block bg-gradient-to-r from-purple-600 via-pink-500 to-blue-600 bg-clip-text text-transparent">
                  content 10x faster
                </span>
                <span className="block text-gray-900">with AI.</span>
              </h1>
              <p className="text-lg lg:text-xl text-gray-700 mb-8 leading-relaxed max-w-xl">
                Generate high-quality blog posts, social media content, emails, and more in seconds.
                Trusted by 50,000+ creators, marketers, and founders worldwide.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Link
                  href="/signup"
                  className="group px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold text-lg hover:opacity-90 transition shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2"
                >
                  Start Free — No Card Needed
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
                </Link>
                <button
                  onClick={() => setIsPlaying(true)}
                  className="px-8 py-4 border-2 border-gray-200 text-gray-800 rounded-xl font-semibold text-lg hover:bg-gray-50 hover:border-gray-300 transition flex items-center justify-center gap-2 bg-white/60 backdrop-blur"
                >
                  <Play className="w-5 h-5 text-purple-600" />
                  Watch Demo
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <div className="flex items-center gap-1.5 text-gray-700">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  No credit card required
                </div>
                <div className="flex items-center gap-1.5 text-gray-700">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Free forever
                </div>
                <div className="flex items-center gap-1.5 text-gray-700">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Unlimited usage
                </div>
              </div>
            </motion.div>

            {/* Right: SVG/CSS illustration */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="relative rounded-2xl shadow-2xl shadow-purple-500/10 overflow-hidden border border-gray-100 bg-white">
                {/* Browser chrome */}
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                  </div>
                  <div className="flex-1 mx-3 px-3 py-1 bg-white rounded-md text-xs text-gray-500 font-mono border border-gray-100">
                    app.ai-content-writer.com
                  </div>
                </div>

                {/* App body */}
                <div className="p-6 bg-white">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Draft</div>
                      <div className="text-base font-semibold text-gray-900">Blog post — AI trends 2025</div>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">
                      <Sparkles className="w-3 h-3" /> Generating
                    </div>
                  </div>

                  {/* Skeleton content lines */}
                  <div className="space-y-3 mb-5">
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    <div className="h-3 bg-gray-200 rounded w-full"></div>
                    <div className="h-3 bg-gray-200 rounded w-11/12"></div>
                    <div className="h-3 bg-gray-200 rounded w-4/5"></div>
                  </div>

                  {/* SEO chips */}
                  <div className="flex flex-wrap gap-2 mb-5">
                    {['AI content', 'automation', 'generative', 'marketing'].map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 bg-gradient-to-r from-purple-50 to-blue-50 text-purple-700 text-xs font-medium rounded-full border border-purple-100"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-100">
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">98%</div>
                      <div className="text-[11px] text-gray-600">Originality</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">A+</div>
                      <div className="text-[11px] text-gray-600">SEO score</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">0</div>
                      <div className="text-[11px] text-gray-600">Grammar issues</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating accent cards */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-5 -right-3 sm:-right-5 bg-white rounded-xl shadow-xl p-3 border border-gray-100 hidden sm:flex items-center gap-2"
              >
                <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-900">Plagiarism free</div>
                  <div className="text-[11px] text-gray-600">100% original</div>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                className="absolute -bottom-5 -left-3 sm:-left-5 bg-white rounded-xl shadow-xl p-3 border border-gray-100 hidden sm:flex items-center gap-2"
              >
                <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-900">1.2s</div>
                  <div className="text-[11px] text-gray-600">Avg generation</div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Trusted-by bar */}
        <div className="relative z-10 border-t border-gray-100 bg-white/60 backdrop-blur">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-10">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Trusted by teams at</span>
              <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
                {trustedBy.map((name) => (
                  <span key={name} className="text-sm font-semibold text-gray-400">{name}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="text-center"
                >
                  <div className="flex justify-center mb-3">
                    <div className="p-3 bg-gradient-to-r from-purple-100 to-blue-100 rounded-full">
                      <Icon className="w-6 h-6 text-purple-700" />
                    </div>
                  </div>
                  <div className="text-3xl lg:text-4xl font-bold text-gray-900">{stat.value}</div>
                  <div className="text-gray-700 font-medium text-sm mt-1">{stat.label}</div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16 max-w-3xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-100 rounded-full mb-4">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-800">Features</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 tracking-tight">
              Everything you need to create
              <span className="block bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                professional content with AI
              </span>
            </h2>
            <p className="text-lg text-gray-700">
              One platform for writing, SEO, plagiarism checks, and grammar — all powered by advanced AI.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className="group relative bg-white rounded-2xl p-7 border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                >
                  <div className={`w-14 h-14 bg-gradient-to-r ${feature.color} rounded-xl flex items-center justify-center mb-5 shadow-md group-hover:scale-110 transition`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-gray-900">{feature.title}</h3>
                  <p className="text-gray-700 leading-relaxed">{feature.desc}</p>
                  <ArrowRight className="w-5 h-5 text-purple-500 mt-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 tracking-tight">
              How It <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">Works</span>
            </h2>
            <p className="text-lg text-gray-700">Create amazing content in 3 simple steps</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Enter Your Topic', desc: 'Type your topic or keywords, then choose tone and length.', icon: PenTool },
              { step: '02', title: 'AI Generates Content', desc: 'Our AI creates unique, high-quality content in seconds.', icon: Cpu },
              { step: '03', title: 'Edit & Publish', desc: 'Review, edit, and export your content anywhere.', icon: Cloud },
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.2 }}
                  className="text-center relative"
                >
                  {index < 2 && (
                    <div className="hidden md:block absolute top-20 left-full w-full h-0.5 bg-gradient-to-r from-purple-200 to-blue-200 -translate-x-1/2">
                      <ChevronRight className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-6 text-purple-600" />
                    </div>
                  )}
                  <div className="w-24 h-24 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-500/20">
                    <span className="text-3xl font-bold text-white">{item.step}</span>
                  </div>
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto -mt-12 mb-4 relative z-10">
                    <Icon className="w-6 h-6 text-purple-700" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-gray-900">{item.title}</h3>
                  <p className="text-gray-700">{item.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing Section — Free Forever */}
      <section id="pricing" className="py-24 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-100 rounded-full mb-4">
              <Zap className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-800">Pricing</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 tracking-tight">
              Free <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">Forever</span>
            </h2>
            <p className="text-lg text-gray-700">Every feature. Every user. No subscription, no credit card.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -10 }}
            className="relative bg-white rounded-3xl shadow-xl ring-2 ring-purple-600 overflow-hidden max-w-2xl mx-auto"
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm rounded-full">
              Always Free
            </div>
            <div className="p-10">
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-purple-100">
                  <Zap className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Free Forever</h3>
              </div>

              <p className="text-gray-700 mb-6 text-center">
                Everything unlocked from day one. No trials, no limits.
              </p>

              <div className="mb-8 text-center">
                <span className="text-6xl font-bold text-gray-900">$0</span>
                <span className="text-gray-700 text-lg">/forever</span>
              </div>

              <ul className="grid sm:grid-cols-2 gap-3 mb-8">
                {freeFeatures.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-gray-800">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className="w-full py-3 rounded-xl font-semibold transition text-center block bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:opacity-90"
              >
                Get Started — It&apos;s Free
              </Link>

              <p className="text-center text-sm text-gray-700 mt-4">
                No credit card required · Free forever · Unlimited usage
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 bg-purple-900 text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
              Loved by <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-pink-400">Content Creators</span>
            </h2>
            <p className="text-xl text-purple-200">Join thousands of satisfied users</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { name: 'Sarah Johnson', role: 'Content Marketer', content: 'This AI tool has transformed my content workflow. I can now produce 10x more content in half the time!', rating: 5 },
              { name: 'Michael Chen', role: 'SEO Specialist', content: 'The SEO keyword suggestions are spot-on. My articles are ranking higher than ever before.', rating: 5 },
              { name: 'Emily Rodriguez', role: 'Blogger', content: 'Best investment for my blog. The content quality is amazing and it saves me hours of writing.', rating: 5 },
            ].map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="mb-4 text-purple-100 leading-relaxed">&ldquo;{testimonial.content}&rdquo;</p>
                <div>
                  <p className="font-semibold text-white">{testimonial.name}</p>
                  <p className="text-sm text-purple-300">{testimonial.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-purple-600 to-blue-600">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bg-white/10 backdrop-blur-sm rounded-2xl p-12 border border-white/20"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              Ready to Create Amazing Content?
            </h2>
            <p className="text-xl text-purple-100 mb-8">
              Free forever. Unlimited usage. No subscription.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-purple-700 rounded-xl font-semibold text-lg hover:shadow-lg transition transform hover:scale-105"
            >
              Get Started Free
              <Rocket className="w-5 h-5" />
            </Link>
            <p className="text-purple-200 text-sm mt-4">No credit card required. Free forever.</p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold text-white">AI Content Writer</span>
              </div>
              <p className="text-gray-300 text-sm">Create amazing content 10x faster with AI.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-white">Product</h4>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li><a href="#features" className="hover:text-white transition">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition">Pricing</a></li>
                <li><Link href="/dashboard" className="hover:text-white transition">Demo</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-white">Company</h4>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li><a href="#" className="hover:text-white transition">About</a></li>
                <li><a href="#" className="hover:text-white transition">Blog</a></li>
                <li><a href="#" className="hover:text-white transition">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-white">Legal</h4>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li><a href="#" className="hover:text-white transition">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-300 text-sm">© 2024 AI Content Writer. All rights reserved.</p>
            <div className="flex gap-4">
              <a href="#" className="text-gray-300 hover:text-white transition"><Mail className="w-5 h-5" /></a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
