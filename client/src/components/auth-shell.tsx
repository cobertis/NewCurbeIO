import { useState, useEffect } from "react";
import { Link } from "wouter";
import logo from "@assets/logo no fondo_1760457183587.png";
import productMockup from "@assets/image_1766258646875.png";
import { Star } from "lucide-react";

import partnerLogo1 from "@assets/77b640535dffb1a3a12d73103506709fbb276965b2be187431eec30f850b2_1767046239629.webp";
import partnerLogo2 from "@assets/084f7af56c84d676cb56fa563d9543869db8292a6883c7caf697a60bc159d_1767046243376.webp";
import partnerLogo3 from "@assets/0401d3f7e9583614c6a07a9c0c073a74077150ce285957b9bf2edaf1092f8_1767046247306.webp";
import partnerLogo4 from "@assets/a960c99d57404e59dd6cf342d000504a7012dbc2829da8918435fc0433d7e_1767046251215.webp";
import partnerLogo5 from "@assets/ad1762e2cab6dac864b3fc59aa460cb43bfe0adcac174bd0744332cdf9c41_1767046257018.webp";
import partnerLogo6 from "@assets/a89b5dba114815b08f2326c3979dff3b4e7216012592c8d16b5e17f6dd10d_1767046260519.webp";

const partnerLogos = [
  partnerLogo1,
  partnerLogo2,
  partnerLogo3,
  partnerLogo4,
  partnerLogo5,
  partnerLogo6,
];

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
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
        setIsTransitioning(false);
      }, 300);
    }, 6000);
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
          <span className="text-blue-700 font-semibold">{highlightedText}</span>
          {parts[1]}
        </>
      );
    }
    return quote;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] min-h-screen">
      {/* LEFT PANEL - Form */}
      <div className="bg-white relative flex flex-col justify-center items-center min-h-screen px-8 lg:px-16">
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

      {/* RIGHT PANEL - Textmagic Style */}
      <div className="hidden lg:flex relative overflow-hidden flex-col justify-between items-center auth-right-panel">
        {/* Diagonal overlays */}
        <div className="auth-diagonal-1" />
        <div className="auth-diagonal-2" />
        
        {/* Content wrapper */}
        <div className="relative z-10 flex flex-col justify-between items-center h-full w-full" style={{ padding: 'clamp(32px, 4vw, 56px)' }}>
          
          {/* Testimonial Block - Top */}
          <div 
            className={`flex flex-col items-center text-center max-w-[520px] transition-all duration-300 ${
              isTransitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
            }`}
          >
            {/* Stars */}
            <div className="flex gap-1 mb-5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
              ))}
            </div>
            
            {/* Quote */}
            <p 
              className="text-gray-800 leading-relaxed mb-6 font-medium"
              style={{ fontSize: 'clamp(18px, 1.6vw, 22px)', lineHeight: '1.5' }}
            >
              "{renderQuoteWithHighlight()}"
            </p>
            
            {/* Author */}
            <p className="text-[14px] font-bold text-gray-900">{testimonial.authorName}</p>
            <p className="text-[12px] text-gray-500">{testimonial.authorTitle}</p>
            
            {/* Dots indicator */}
            <div className="flex gap-2 mt-6">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setIsTransitioning(true);
                    setTimeout(() => {
                      setCurrentTestimonial(index);
                      setIsTransitioning(false);
                    }, 300);
                  }}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === currentTestimonial 
                      ? 'bg-blue-600 w-6' 
                      : 'bg-gray-400/40 hover:bg-gray-400/60'
                  }`}
                  data-testid={`testimonial-dot-${index}`}
                />
              ))}
            </div>
          </div>

          {/* Mockup Area - Center/Bottom with floating effect */}
          <div className="flex-1 flex items-center justify-center w-full mt-4 overflow-hidden">
            <div 
              className="w-full h-full flex items-center justify-center transform translate-y-[10px]"
              style={{ 
                filter: 'drop-shadow(0 18px 40px rgba(17,24,39,0.12))'
              }}
            >
              <img 
                src={productMockup} 
                alt="Product Preview" 
                className="w-full h-full object-contain max-w-none"
              />
            </div>
          </div>

          {/* Logo Row - Footer */}
          <div className="flex items-center justify-center gap-8 mt-6 flex-wrap">
            {partnerLogos.map((logoSrc, index) => (
              <img 
                key={index}
                src={logoSrc}
                alt={`Partner ${index + 1}`}
                className="h-6 w-auto object-contain"
                style={{ opacity: 0.6 }}
              />
            ))}
          </div>
        </div>
        
        {/* Inline styles for the panel */}
        <style>{`
          .auth-right-panel {
            background: linear-gradient(135deg, #EAF4FF 0%, #E6F2FF 55%, #DFF0FF 100%);
          }
          
          .auth-diagonal-1 {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            clip-path: polygon(0 0, 100% 0, 100% 45%, 0 75%);
            background: rgba(255, 255, 255, 0.55);
            z-index: 1;
          }
          
          .auth-diagonal-2 {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            clip-path: polygon(100% 30%, 100% 100%, 40% 100%);
            background: rgba(255, 255, 255, 0.35);
            z-index: 1;
          }
        `}</style>
      </div>
    </div>
  );
}
