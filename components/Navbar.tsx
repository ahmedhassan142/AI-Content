'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Menu, X, LayoutDashboard, History, Star, LogOut,
  User, ChevronDown, FileText, Crown, Eye, Heart, Search, Webhook
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, guestSession, isGuest, logout, loading, createGuestSession } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isStartingGuest, setIsStartingGuest] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        profileButtonRef.current &&
        !profileButtonRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsProfileOpen(false);
  }, [pathname]);

  // Close dropdown on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const isActive = (path: string) => pathname === path;

  const dashboardNavItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/seo', label: 'SEO Tools', icon: Search },
    { path: '/webhooks', label: 'Webhooks', icon: Webhook },
    { path: '/history', label: 'History', icon: History },
    { path: '/favorites', label: 'Favorites', icon: Heart },
  ];

  const publicNavItems = [
    { path: '/seo', label: 'SEO Tools' },
    { path: '/#features', label: 'Features', hash: true },
  ];

  const handleLogout = async () => {
    setIsProfileOpen(false);
    await logout();
    router.push('/');
  };

  const handleGuestMode = async () => {
    setIsStartingGuest(true);
    await createGuestSession();
    setIsStartingGuest(false);
    window.location.href = '/dashboard';
  };

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string, isHash?: boolean) => {
    if (isHash && pathname === '/') {
      e.preventDefault();
      const element = document.querySelector(path);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
    setIsMobileMenuOpen(false);
  };

  const authPages = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email'];
  if (authPages.includes(pathname)) {
    return null;
  }

  // Don't show guest button if already in guest mode or logged in
  const showGuestButton = !user && !isGuest && !loading;

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-200' : 'bg-white/90 backdrop-blur-sm border-b border-gray-100'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link href={(user || isGuest) ? '/dashboard' : '/'} className="flex items-center gap-2 group">
              <div className="p-1.5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg transition-transform group-hover:scale-105">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                AI Content Writer
              </span>
              {isGuest && (
                <span className="ml-2 text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">
                  Guest Mode
                </span>
              )}
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {(!user && !isGuest) ? (
                publicNavItems.map((item) => (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={(e) => handleNavClick(e, item.path, item.hash)}
                    className="px-4 py-2 text-gray-700 hover:text-purple-600 transition rounded-lg hover:bg-purple-50"
                  >
                    {item.label}
                  </Link>
                ))
              ) : (
                dashboardNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                        isActive(item.path)
                          ? 'bg-purple-100 text-purple-600 font-medium'
                          : 'text-gray-700 hover:text-purple-600 hover:bg-purple-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })
              )}
            </div>

            {/* Right side - Auth buttons or Profile */}
            <div className="hidden md:flex items-center gap-3">
              {loading ? (
                <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse"></div>
              ) : (user || isGuest) ? (
                <div className="flex items-center gap-3">
                  {/* Guest Mode Indicator */}
                  {isGuest && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 rounded-lg">
                      <Eye className="w-4 h-4 text-yellow-600" />
                      <span className="text-xs text-yellow-700">Guest</span>
                    </div>
                  )}
                  
                  {/* Profile Button */}
                  <div className="relative">
                    <button
                      ref={profileButtonRef}
                      onClick={() => setIsProfileOpen(!isProfileOpen)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition border border-transparent hover:border-gray-200"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center text-white font-semibold shadow-sm">
                        {isGuest ? 'G' : (user?.name?.charAt(0).toUpperCase() || 'U')}
                      </div>
                      <span className="text-sm font-medium text-gray-700 hidden sm:inline-block">
                        {isGuest ? 'Guest User' : user?.name?.split(' ')[0]}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-gray-500 transition-all duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {isProfileOpen && (
                        <motion.div
                          ref={dropdownRef}
                          initial={{ opacity: 0, y: -10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                          className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
                        >
                          {/* User Info Header */}
                          <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-blue-50">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                                {isGuest ? 'G' : (user?.name?.charAt(0).toUpperCase() || 'U')}
                              </div>
                              <div className="flex-1">
                                <p className="font-semibold text-gray-900">
                                  {isGuest ? 'Guest User' : user?.name}
                                </p>
                                <p className="text-xs text-gray-700 truncate">
                                  {isGuest ? 'Temporary session' : user?.email}
                                </p>
                                {isGuest && (
                                  <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs">
                                    <Eye className="w-3 h-3" />
                                    Guest Mode
                                  </div>
                                )}
                                {user && !isGuest && (
                                  <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
                                    <Crown className="w-3 h-3" />
                                    {user.role === 'admin' ? 'Admin' : 'Pro Member'}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Menu Items */}
                          <div className="py-2">
                            {!isGuest && (
                              <Link
                                href="/profile"
                                className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50 transition-colors"
                                onClick={() => setIsProfileOpen(false)}
                              >
                                <User className="w-4 h-4 text-gray-700" />
                                <span>My Profile</span>
                              </Link>
                            )}
                            <Link
                              href="/dashboard"
                              className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50 transition-colors"
                              onClick={() => setIsProfileOpen(false)}
                            >
                              <LayoutDashboard className="w-4 h-4 text-gray-700" />
                              <span>Dashboard</span>
                            </Link>
                            <Link
                              href="/history"
                              className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50 transition-colors"
                              onClick={() => setIsProfileOpen(false)}
                            >
                              <History className="w-4 h-4 text-gray-700" />
                              <span>My Content</span>
                            </Link>
                            <Link
                              href="/favorites"
                              className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50 transition-colors"
                              onClick={() => setIsProfileOpen(false)}
                            >
                              <Heart className="w-4 h-4 text-gray-700" />
                              <span>Favorites</span>
                            </Link>
                            
                            <hr className="my-1" />
                            
                            {isGuest ? (
                              <Link
                                href="/signup"
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-green-600 hover:bg-green-50 transition-colors"
                                onClick={() => setIsProfileOpen(false)}
                              >
                                <Crown className="w-4 h-4" />
                                <span>Sign Up to Save Content</span>
                              </Link>
                            ) : null}
                            
                            <button
                              onClick={handleLogout}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <LogOut className="w-4 h-4" />
                              <span>{isGuest ? 'Exit Guest Mode' : 'Logout'}</span>
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              ) : (
                // Show Login, Guest, and Signup buttons
                <>
                  <Link
                    href="/login"
                    className="px-4 py-2 text-gray-700 hover:text-purple-600 transition rounded-lg"
                  >
                    Login
                  </Link>
                  
                  {/* Try as Guest Button */}
                  <button
                    onClick={handleGuestMode}
                    disabled={isStartingGuest}
                    className="px-4 py-2 border-2 border-purple-300 text-purple-700 rounded-lg font-medium hover:bg-purple-50 transition flex items-center gap-2"
                  >
                    {isStartingGuest ? (
                      <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                    Try as Guest
                  </button>
                  
                  <Link
                    href="/signup"
                    className="px-5 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:opacity-90 transition shadow-sm"
                  >
                    Sign Up Free
                  </Link>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-b border-gray-200 shadow-lg"
            >
              <div className="px-4 py-4 space-y-2">
                {(!user && !isGuest) ? (
                  <>
                    {publicNavItems.map((item) => (
                      <Link
                        key={item.path}
                        href={item.path}
                        onClick={(e) => {
                          handleNavClick(e, item.path, item.hash);
                          setIsMobileMenuOpen(false);
                        }}
                        className="block px-4 py-2 text-gray-700 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition"
                      >
                        {item.label}
                      </Link>
                    ))}
                    <div className="pt-4 border-t border-gray-100 space-y-2">
                      <Link
                        href="/login"
                        className="block px-4 py-2 text-center text-gray-700 hover:text-purple-600 rounded-lg transition"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        Login
                      </Link>
                      <button
                        onClick={handleGuestMode}
                        disabled={isStartingGuest}
                        className="w-full px-4 py-2 text-center border-2 border-purple-300 text-purple-700 rounded-lg font-medium hover:bg-purple-50 transition flex items-center justify-center gap-2"
                      >
                        {isStartingGuest ? (
                          <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                        Try as Guest
                      </button>
                      <Link
                        href="/signup"
                        className="block px-4 py-2 text-center bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:opacity-90 transition"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        Sign Up Free
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl mb-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center text-white font-semibold text-lg">
                        {isGuest ? 'G' : (user?.name?.charAt(0).toUpperCase() || 'U')}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {isGuest ? 'Guest User' : user?.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {isGuest ? 'Temporary session' : user?.email}
                        </p>
                        {isGuest && (
                          <span className="text-xs text-yellow-600">Guest Mode</span>
                        )}
                      </div>
                    </div>
                    
                    {!isGuest && (
                      <Link
                        href="/profile"
                        className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <User className="w-5 h-5" />
                        <span>My Profile</span>
                      </Link>
                    )}
                    
                    <Link
                      href="/dashboard"
                      className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <LayoutDashboard className="w-5 h-5" />
                      <span>Dashboard</span>
                    </Link>

                    <Link
                      href="/seo"
                      className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Search className="w-5 h-5" />
                      <span>SEO Tools</span>
                    </Link>

                    <Link
                      href="/webhooks"
                      className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Webhook className="w-5 h-5" />
                      <span>Webhooks</span>
                    </Link>

                    <Link
                      href="/history"
                      className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <History className="w-5 h-5" />
                      <span>History</span>
                    </Link>
                    
                    <Link
                      href="/favorites"
                      className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Heart className="w-5 h-5" />
                      <span>Favorites</span>
                    </Link>
                    
                    {isGuest && (
                      <Link
                        href="/signup"
                        className="flex items-center gap-3 px-4 py-3 text-green-600 hover:bg-green-50 rounded-lg transition"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Crown className="w-5 h-5" />
                        <span>Sign Up to Save Content</span>
                      </Link>
                    )}
                    
                    <button
                      onClick={() => {
                        handleLogout();
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition mt-4"
                    >
                      <LogOut className="w-5 h-5" />
                      <span>{isGuest ? 'Exit Guest Mode' : 'Logout'}</span>
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Spacer to prevent content from hiding under navbar */}
      <div className="h-16"></div>
    </>
  );
}