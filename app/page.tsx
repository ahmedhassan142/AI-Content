'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Sparkles, FileText, PenTool, Globe, Search, ShieldCheck, SpellCheck,
  CheckCircle, ArrowRight, Play, Users, Clock, Star, ChevronRight,
  Cpu, Cloud, Rocket, Mail, CreditCard, Zap, Crown
} from 'lucide-react';
import PaddleCheckout from '@/components/PaddleCheckouts';

// Your Paddle Price IDs from the catalog
const PRICE_IDS = {
  BASIC: 'pri_01kqcmp38664rkdnaqqqa3tf7b',      // Basic plan
  PRO: 'pri_01kqcmfdn2tepnadaa8pfgb6cx',       // Pro plan
  ENTERPRISE: 'pri_01kqcm95q8z7b4dq1kbkd7jm76', // Enterprise plan
};

export default function LandingPage() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  
  const features = [
    { icon: Sparkles, title: 'AI-Powered Generation', desc: 'Create high-quality content in seconds with advanced AI models', color: 'from-purple-500 to-pink-500' },
    { icon: PenTool, title: 'Multiple Tones', desc: 'Professional, casual, friendly, persuasive - any tone you need', color: 'from-blue-500 to-cyan-500' },
    { icon: Globe, title: 'Multi-Language', desc: 'Generate content in 50+ languages for global reach', color: 'from-green-500 to-emerald-500' },
    { icon: Search, title: 'SEO Optimization', desc: 'Get keyword suggestions to rank higher on search engines', color: 'from-orange-500 to-red-500' },
    { icon: ShieldCheck, title: 'Plagiarism Check', desc: 'Ensure your content is 100% unique and original', color: 'from-indigo-500 to-purple-500' },
    { icon: SpellCheck, title: 'Grammar Correction', desc: 'Fix grammar issues and improve readability', color: 'from-yellow-500 to-amber-500' },
  ];

  const stats = [
    { value: '50K+', label: 'Active Users', icon: Users },
    { value: '1M+', label: 'Content Generated', icon: FileText },
    { value: '98%', label: 'Satisfaction Rate', icon: Star },
    { value: '24/7', label: 'AI Support', icon: Clock },
  ];

  const pricing = [
    {
      name: 'Basic',
      price: '$9',
      yearlyPrice: '$86',
      period: 'month',
      description: 'Perfect for casual users',
      priceId: PRICE_IDS.BASIC,
      icon: Zap,
      features: ['5 content generations/day', 'Basic tones', '3 languages', '500 words per generation', 'Email support'],
      buttonText: 'Get Started',
      popular: false,
    },
    {
      name: 'Pro',
      price: '$19',
      yearlyPrice: '$182',
      period: 'month',
      description: 'For serious content creators',
      priceId: PRICE_IDS.PRO,
      icon: Rocket,
      features: ['Unlimited generations', 'All tones + custom', '50+ languages', '5000 words per generation', 'SEO keywords', 'Plagiarism checker', 'Grammar check', 'Priority support'],
      buttonText: 'Start Free Trial',
      popular: true,
    },
    {
      name: 'Enterprise',
      price: '$49',
      yearlyPrice: '$470',
      period: 'month',
      description: 'For teams and agencies',
      priceId: PRICE_IDS.ENTERPRISE,
      icon: Crown,
      features: ['Everything in Pro', 'Team collaboration', 'API access', 'Custom AI training', 'Dedicated support', 'Analytics dashboard', 'White-label options'],
      buttonText: 'Contact Sales',
      popular: false,
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-blue-50 pt-20">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse delay-1000"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 rounded-full mb-6">
                <Rocket className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-800">AI-Powered Content Creation</span>
              </div>
              <h1 className="text-5xl lg:text-7xl font-bold mb-6">
                <span className="bg-gradient-to-r from-purple-600 via-pink-500 to-blue-600 bg-clip-text text-transparent">
                  Create Amazing Content
                </span>
                <br />
                <span className="text-gray-900">10x Faster with AI</span>
              </h1>
              <p className="text-xl text-gray-800 mb-8 leading-relaxed">
                Generate high-quality blog posts, social media content, emails, and more in seconds. 
                Used by 50,000+ content creators worldwide.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Link
                  href="/signup"
                  className="group px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold text-lg hover:opacity-90 transition shadow-lg flex items-center justify-center gap-2"
                >
                  Start Creating Free
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
                </Link>
                <button
                  onClick={() => setIsPlaying(true)}
                  className="px-8 py-4 border-2 border-purple-200 text-purple-700 rounded-xl font-semibold text-lg hover:bg-purple-50 transition flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5" />
                  Watch Demo
                </button>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-1 text-gray-800">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  No credit card required
                </div>
                <div className="flex items-center gap-1 text-gray-800">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Free forever plan
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="relative rounded-2xl shadow-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-1">
                  <div className="bg-white rounded-xl overflow-hidden">
                    <div className="bg-gray-100 px-4 py-3 border-b flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      </div>
                      <div className="flex-1 text-center text-sm text-gray-700 font-medium">AI Content Writer Pro</div>
                    </div>
                    <div className="p-6">
                      <div className="space-y-4">
                        <div className="h-4 bg-gray-300 rounded w-3/4 animate-pulse"></div>
                        <div className="h-4 bg-gray-300 rounded w-full animate-pulse"></div>
                        <div className="h-4 bg-gray-300 rounded w-5/6 animate-pulse"></div>
                        <div className="h-32 bg-gradient-to-r from-purple-100 to-blue-100 rounded-lg flex items-center justify-center">
                          <Sparkles className="w-8 h-8 text-purple-600 animate-pulse" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-yellow-400 rounded-full filter blur-2xl opacity-30 animate-pulse"></div>
              <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-purple-400 rounded-full filter blur-2xl opacity-30 animate-pulse delay-1000"></div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="text-center"
                >
                  <div className="flex justify-center mb-3">
                    <div className="p-3 bg-gradient-to-r from-purple-100 to-blue-100 rounded-full">
                      <Icon className="w-6 h-6 text-purple-700" />
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
                  <div className="text-gray-700 font-medium">{stat.label}</div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-gradient-to-b from-white to-gray-100">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Powerful Features
              </span>
            </h2>
            <p className="text-xl text-gray-800 max-w-3xl mx-auto">
              Everything you need to create professional content with AI
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -5 }}
                  className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 group"
                >
                  <div className={`w-14 h-14 bg-gradient-to-r ${feature.color} rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-gray-900">{feature.title}</h3>
                  <p className="text-gray-700 leading-relaxed">{feature.desc}</p>
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
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              How It <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">Works</span>
            </h2>
            <p className="text-xl text-gray-800">Create amazing content in 3 simple steps</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Enter Your Topic', desc: 'Type your topic or keywords, choose tone and length', icon: PenTool },
              { step: '02', title: 'AI Generates Content', desc: 'Our AI creates unique, high-quality content in seconds', icon: Cpu },
              { step: '03', title: 'Edit & Publish', desc: 'Review, edit, and export your content anywhere', icon: Cloud },
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.2 }}
                  className="text-center relative"
                >
                  {index < 2 && (
                    <div className="hidden md:block absolute top-20 left-full w-full h-0.5 bg-gradient-to-r from-purple-200 to-blue-200 -translate-x-1/2">
                      <ChevronRight className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-6 text-purple-600" />
                    </div>
                  )}
                  <div className="w-24 h-24 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
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

      {/* Pricing Section with Paddle Integration */}
      <section id="pricing" className="py-24 bg-gradient-to-b from-gray-100 to-white">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Simple, <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">Transparent</span> Pricing
            </h2>
            <p className="text-xl text-gray-800">Choose the plan that works for you</p>

            {/* Billing Toggle */}
            <div className="flex justify-center mt-8">
              <div className="bg-gray-100 p-1 rounded-xl inline-flex">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-6 py-2 rounded-lg font-medium transition ${
                    billingCycle === 'monthly'
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle('yearly')}
                  className={`px-6 py-2 rounded-lg font-medium transition ${
                    billingCycle === 'yearly'
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Yearly
                  <span className="ml-1 text-xs text-green-600">Save 20%</span>
                </button>
              </div>
            </div>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {pricing.map((plan, index) => {
              const Icon = plan.icon;
              const displayPrice = billingCycle === 'yearly' ? plan.yearlyPrice : plan.price;
              const displayPeriod = billingCycle === 'yearly' ? 'year' : 'month';
              
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -10 }}
                  className={`relative bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 ${plan.popular ? 'ring-2 ring-purple-600 shadow-lg' : ''}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm rounded-full">
                      Most Popular
                    </div>
                  )}
                  <div className="p-8">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`p-2 rounded-xl ${plan.popular ? 'bg-purple-100' : 'bg-gray-100'}`}>
                        <Icon className={`w-6 h-6 ${plan.popular ? 'text-purple-600' : 'text-gray-600'}`} />
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
                    </div>
                    
                    <p className="text-gray-500 mb-4">{plan.description}</p>
                    
                    <div className="mb-6">
                      <span className="text-4xl font-bold text-gray-900">{displayPrice}</span>
                      <span className="text-gray-500">/{displayPeriod}</span>
                      {billingCycle === 'yearly' && (
                        <p className="text-xs text-green-600 mt-1">Save 20% annually</p>
                      )}
                    </div>
                    
                    <ul className="space-y-3 mb-8">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-gray-700">
                          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    
                    {plan.name === 'Enterprise' ? (
                      <Link
                        href="/contact"
                        className={`w-full py-3 rounded-xl font-semibold transition text-center block border-2 border-purple-300 text-purple-700 hover:bg-purple-50`}
                      >
                        {plan.buttonText}
                      </Link>
                    ) : (
                      <PaddleCheckout
                        priceId={plan.priceId}
                        planName={plan.name}
                        buttonText={plan.buttonText}
                        variant={plan.popular ? 'primary' : 'outline'}
                        className="w-full"
                      />
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Secure Payment Note */}
          <div className="text-center mt-12">
            <div className="inline-flex items-center gap-2 text-gray-500 text-sm">
              <CreditCard className="w-4 h-4" />
              <span>Secure payments powered by Paddle</span>
              <span className="mx-2">•</span>
              <span>7-day free trial on Pro plan</span>
              <span className="mx-2">•</span>
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 bg-purple-900 text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
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
                transition={{ delay: index * 0.1 }}
                className="bg-white/10 backdrop-blur-sm rounded-2xl p-6"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="mb-4 text-purple-100 leading-relaxed">"{testimonial.content}"</p>
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
            className="bg-white/10 backdrop-blur-sm rounded-2xl p-12"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Ready to Create Amazing Content?
            </h2>
            <p className="text-xl text-purple-100 mb-8">
              Join 50,000+ content creators who are already using AI Content Writer
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-purple-700 rounded-xl font-semibold text-lg hover:shadow-lg transition transform hover:scale-105"
            >
              Start Your Free Trial
              <Rocket className="w-5 h-5" />
            </Link>
            <p className="text-purple-200 text-sm mt-4">No credit card required. Free forever plan available.</p>
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
              <p className="text-gray-400 text-sm">Create amazing content 10x faster with AI.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-white">Product</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#features" className="hover:text-white transition">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition">Pricing</a></li>
                <li><Link href="/dashboard" className="hover:text-white transition">Demo</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-white">Company</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#" className="hover:text-white transition">About</a></li>
                <li><a href="#" className="hover:text-white transition">Blog</a></li>
                <li><a href="#" className="hover:text-white transition">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-white">Legal</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#" className="hover:text-white transition">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-400 text-sm">© 2024 AI Content Writer. All rights reserved.</p>
            <div className="flex gap-4">
              <a href="#" className="text-gray-400 hover:text-white transition"><Mail className="w-5 h-5" /></a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}