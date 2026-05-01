// components/PaddleCheckout.tsx
'use client';

import { useState, useEffect } from 'react';
import { Loader2, CreditCard } from 'lucide-react';

interface PaddleCheckoutProps {
  priceId: string;
  planName: string;
  buttonText?: string;
  variant?: 'primary' | 'outline';
  className?: string;
}

export default function PaddleCheckout({ 
  priceId, 
  planName, 
  buttonText = 'Subscribe Now',
  variant = 'primary',
  className = ''
}: PaddleCheckoutProps) {
  const [loading, setLoading] = useState(false);
  const [paddleReady, setPaddleReady] = useState(false);

  useEffect(() => {
    // Load Paddle.js script
    const script = document.createElement('script');
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    script.async = true;
    script.onload = () => {
      // @ts-ignore
      window.Paddle.Environment.set('sandbox'); // Change to 'production' when live
      // @ts-ignore
      window.Paddle.Initialize({
        vendor: 123456, // Your Paddle vendor ID (find in Paddle dashboard)
      });
      setPaddleReady(true);
    };
    document.body.appendChild(script);
  }, []);

  const handleSubscribe = () => {
    if (!paddleReady) {
      alert('Payment system is loading. Please try again.');
      return;
    }

    setLoading(true);
    
    // @ts-ignore
    window.Paddle.Checkout.open({
      items: [{ priceId: priceId, quantity: 1 }],
      successUrl: `${window.location.origin}/dashboard?payment=success`,
      cancelUrl: `${window.location.origin}/pricing?payment=canceled`,
    });

    setLoading(false);
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:opacity-90';
      case 'outline':
        return 'border-2 border-purple-600 text-purple-600 hover:bg-purple-50';
      default:
        return 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:opacity-90';
    }
  };

  return (
    <button
      onClick={handleSubscribe}
      disabled={loading || !paddleReady}
      className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${getVariantStyles()} ${className}`}
    >
      {loading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          Processing...
        </>
      ) : (
        <>
          <CreditCard className="w-5 h-5" />
          {buttonText}
        </>
      )}
    </button>
  );
}