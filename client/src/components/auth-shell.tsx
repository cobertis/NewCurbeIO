import { useState, useEffect } from "react";
import { Link } from "wouter";
import logo from "@assets/logo no fondo_1760457183587.png";
import productMockup from "@assets/image_1766258646875.png";
import { Star } from "lucide-react";

const testimonials = [
  {
    quote: "The interface and ease of use makes our work so much easier, whilst giving us the professional image we strive to maintain.",
    highlightedText: "interface and ease of use",
    authorName: "Ahmet Deveci",
    authorTitle: "Director, CCTV Aware",
  },
  {
    quote: "Curbe has transformed how we manage customer relationships. The automation features save us hours every week.",
    highlightedText: "transformed how we manage",
    authorName: "Maria Rodriguez",
    authorTitle: "CEO, InsureMax Solutions",
  },
  {
    quote: "The unified inbox is a game changer. All our client communications in one place makes follow-ups effortless.",
    highlightedText: "game changer",
    authorName: "James Chen",
    authorTitle: "Founder, Premier Insurance Group",
  },
  {
    quote: "Our team productivity increased by 40% after switching to Curbe. The CRM just works exactly how we need it.",
    highlightedText: "productivity increased by 40%",
    authorName: "Sarah Mitchell",
    authorTitle: "Operations Director, TrustShield Insurance",
  },
  {
    quote: "Finally a CRM that understands the insurance industry. Customer support is exceptional and the platform is intuitive.",
    highlightedText: "understands the insurance industry",
    authorName: "Robert Thompson",
    authorTitle: "Managing Partner, SecureLife Agency",
  },
];

interface AuthShellProps {
  title: string;
  subtitle: string;
  onGoogleSSO?: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}

export function AuthShell({
  title,
  subtitle,
  onGoogleSSO,
  footer,
  children,
}: AuthShellProps) {
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const testimonial = testimonials[currentTestimonial];

  const renderQuoteWithHighlight = () => {
    const { quote, highlightedText } = testimonial;
    const parts = quote.split(highlightedText);
    if (parts.length === 2) {
      return (
        <>
          {parts[0]}
          <span className="text-blue-500">{highlightedText}</span>
          {parts[1]}
        </>
      );
    }
    return quote;
  };

  return (
    <div className="flex min-h-screen">
      {/* LEFT PANEL - Form */}
      <div className="w-full lg:w-1/2 bg-white relative flex flex-col justify-center items-center min-h-screen px-8 lg:px-16">
        {/* Fixed Logo with Link */}
        <Link href="/">
          <img src={logo} alt="Curbe" className="absolute top-8 left-8 lg:left-16 h-12 w-auto cursor-pointer" />
        </Link>
        
        <div className="w-full max-w-[400px]">
          <h1 className="text-[24px] lg:text-[28px] font-semibold text-gray-900 leading-tight">
            {title}
          </h1>
          <p className="text-gray-500 text-[14px] mt-1 mb-6">
            {subtitle}
          </p>

          {onGoogleSSO && (
            <div className="mb-5">
              <button
                type="button"
                onClick={onGoogleSSO}
                className="w-full h-11 flex items-center justify-center gap-2.5 bg-white border border-gray-200 rounded-lg text-[13px] font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all"
                data-testid="button-google-sso"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign up with Google
              </button>
              
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-gray-200"></div>
                <span className="text-[12px] text-gray-400">or sign up with email</span>
                <div className="flex-1 h-px bg-gray-200"></div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {children}
          </div>

          <div className="mt-6 pt-5 border-t border-gray-100">
            {footer}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL - Testimonial */}
      <div 
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-between py-12 px-8"
        style={{ background: 'linear-gradient(180deg, #E8F4FD 0%, #DEF0FC 50%, #D4EBFA 100%)' }}
      >
        {/* Testimonial Section - At top */}
        <div className="flex flex-col items-center text-center max-w-lg pt-4">
          <div className="flex gap-1 mb-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
            ))}
          </div>
          
          <p className="text-[20px] text-gray-700 leading-relaxed mb-6 italic font-light">
            "{renderQuoteWithHighlight()}"
          </p>
          
          <p className="text-[15px] font-semibold text-gray-800">{testimonial.authorName}</p>
          <p className="text-[13px] text-gray-500">{testimonial.authorTitle}</p>
        </div>

        {/* Product Mockup Image - Center */}
        <div className="flex-1 flex items-center justify-center w-full px-4 py-6">
          <img 
            src={productMockup} 
            alt="Product Preview" 
            className="w-full max-w-lg object-contain"
          />
        </div>

        {/* Company Logos - At bottom */}
        <div className="flex items-center justify-center gap-8 flex-wrap pb-4">
          <span className="text-gray-400 font-bold text-sm tracking-wide">FORTO</span>
          <span className="text-gray-400 font-bold text-sm tracking-wide">QiQ</span>
          <span className="text-gray-400 font-bold text-sm tracking-wide">IXICA</span>
          <span className="text-gray-400 font-bold text-sm tracking-wide">Cataphract</span>
          <span className="text-gray-400 font-bold text-sm tracking-wide">Marketplace</span>
        </div>
      </div>
    </div>
  );
}
