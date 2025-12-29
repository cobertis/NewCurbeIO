import { useState, useEffect } from "react";
import { Link } from "wouter";
import logo from "@assets/logo no fondo_1760457183587.png";
import productMockup from "@assets/image_1766258646875.png";
import { Star, Quote, Shield, Users, TrendingUp, Zap } from "lucide-react";

const testimonials = [
  {
    quote: "The interface and ease of use makes our work so much easier, whilst giving us the professional image we strive to maintain.",
    highlightedText: "interface and ease of use",
    authorName: "Ahmet Deveci",
    authorTitle: "Director, CCTV Aware",
    avatar: "AD",
  },
  {
    quote: "Curbe has transformed how we manage customer relationships. The automation features save us hours every week.",
    highlightedText: "transformed how we manage",
    authorName: "Maria Rodriguez",
    authorTitle: "CEO, InsureMax Solutions",
    avatar: "MR",
  },
  {
    quote: "The unified inbox is a game changer. All our client communications in one place makes follow-ups effortless.",
    highlightedText: "game changer",
    authorName: "James Chen",
    authorTitle: "Founder, Premier Insurance Group",
    avatar: "JC",
  },
  {
    quote: "Our team productivity increased by 40% after switching to Curbe. The CRM just works exactly how we need it.",
    highlightedText: "productivity increased by 40%",
    authorName: "Sarah Mitchell",
    authorTitle: "Operations Director, TrustShield Insurance",
    avatar: "SM",
  },
  {
    quote: "Finally a CRM that understands the insurance industry. Customer support is exceptional and the platform is intuitive.",
    highlightedText: "understands the insurance industry",
    authorName: "Robert Thompson",
    authorTitle: "Managing Partner, SecureLife Agency",
    avatar: "RT",
  },
];

const stats = [
  { icon: Users, value: "10,000+", label: "Active Users" },
  { icon: TrendingUp, value: "40%", label: "Productivity Boost" },
  { icon: Shield, value: "99.9%", label: "Uptime SLA" },
  { icon: Zap, value: "< 1s", label: "Response Time" },
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
          <span className="text-white font-medium">{highlightedText}</span>
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

      {/* RIGHT PANEL - Modern Dark Theme */}
      <div 
        className="hidden lg:flex lg:w-1/2 flex-col relative overflow-hidden"
        style={{ 
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)'
        }}
      >
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Gradient Orbs */}
          <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute bottom-[-20%] left-[-10%] w-[400px] h-[400px] rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] rounded-full bg-cyan-500/5 blur-3xl" />
          
          {/* Grid Pattern */}
          <div 
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                               linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: '60px 60px'
            }}
          />
        </div>

        {/* Content Container */}
        <div className="relative z-10 flex flex-col h-full p-10 lg:p-12">
          
          {/* Stats Grid - Top */}
          <div className="grid grid-cols-2 gap-4 mb-10">
            {stats.map((stat, index) => (
              <div 
                key={index}
                className="group p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm hover:bg-white/[0.06] hover:border-white/[0.1] transition-all duration-300"
              >
                <stat.icon className="w-5 h-5 text-blue-400/80 mb-2 group-hover:text-blue-400 transition-colors" />
                <div className="text-2xl font-bold text-white tracking-tight">{stat.value}</div>
                <div className="text-xs text-slate-400 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Testimonial Card - Center */}
          <div className="flex-1 flex items-center justify-center">
            <div 
              className={`w-full max-w-md transition-all duration-300 ${
                isTransitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
              }`}
            >
              {/* Quote Icon */}
              <div className="mb-6">
                <Quote className="w-10 h-10 text-blue-500/40 fill-blue-500/20" />
              </div>
              
              {/* Quote Text */}
              <p className="text-xl lg:text-2xl text-slate-300 leading-relaxed font-light mb-8">
                "{renderQuoteWithHighlight()}"
              </p>
              
              {/* Author Info */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm shadow-lg shadow-blue-500/20">
                  {testimonial.avatar}
                </div>
                <div>
                  <p className="text-white font-semibold">{testimonial.authorName}</p>
                  <p className="text-slate-400 text-sm">{testimonial.authorTitle}</p>
                </div>
              </div>
              
              {/* Rating Stars */}
              <div className="flex gap-1 mt-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
                <span className="text-slate-500 text-sm ml-2">5.0</span>
              </div>
            </div>
          </div>

          {/* Testimonial Dots Indicator */}
          <div className="flex justify-center gap-2 mb-8">
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
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === currentTestimonial 
                    ? 'w-8 bg-blue-500' 
                    : 'w-1.5 bg-slate-600 hover:bg-slate-500'
                }`}
                data-testid={`testimonial-dot-${index}`}
              />
            ))}
          </div>

          {/* Product Mockup - Bottom */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-[#0f172a] z-10 h-8 -top-8" />
            <div className="relative rounded-t-2xl overflow-hidden border border-white/[0.08] border-b-0 bg-white/[0.02] backdrop-blur-sm">
              <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
                <div className="flex-1 mx-4">
                  <div className="h-5 w-48 mx-auto rounded-md bg-white/[0.05] flex items-center justify-center">
                    <span className="text-[10px] text-slate-500">app.curbe.io</span>
                  </div>
                </div>
              </div>
              <img 
                src={productMockup} 
                alt="Product Preview" 
                className="w-full object-cover object-top max-h-[200px]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
