import logo from "@assets/logo no fondo_1760457183587.png";
import { Star } from "lucide-react";

interface AuthShellProps {
  title: string;
  subtitle: string;
  onGoogleSSO?: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
  testimonial?: {
    quote: string;
    highlightedText: string;
    authorName: string;
    authorTitle: string;
  };
}

export function AuthShell({
  title,
  subtitle,
  onGoogleSSO,
  footer,
  children,
  testimonial = {
    quote: "The interface and ease of use makes our work so much easier, whilst giving us the professional image we strive to maintain.",
    highlightedText: "interface and ease of use",
    authorName: "Ahmet Deveci",
    authorTitle: "Director, CCTV Aware",
  },
}: AuthShellProps) {
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
      <div className="w-full lg:w-1/2 bg-white flex flex-col min-h-screen">
        <div className="px-8 lg:px-16 pt-8 lg:pt-12 pb-4">
          <img src={logo} alt="Curbe" className="h-8 w-auto mb-8" />
          <h1 className="text-[24px] lg:text-[28px] font-semibold text-gray-900 leading-tight">
            {title}
          </h1>
          <p className="text-gray-500 text-[14px] mt-1">
            {subtitle}
          </p>
        </div>

        <div className="flex-1 px-8 lg:px-16 py-4 overflow-y-auto">
          <div className="w-full max-w-[400px]">
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
          </div>
        </div>

        <div className="mt-auto px-8 lg:px-16 py-5 border-t border-gray-100">
          {footer}
        </div>
      </div>

      {/* RIGHT PANEL - Testimonial */}
      <div 
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-between py-10 px-6"
        style={{ background: 'linear-gradient(180deg, #EBF5FC 0%, #E0F0FA 50%, #D6EBF8 100%)' }}
      >
        {/* Testimonial Section */}
        <div className="flex flex-col items-center text-center max-w-md">
          <div className="flex gap-0.5 mb-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
            ))}
          </div>
          
          <p className="text-[17px] text-gray-700 leading-relaxed mb-4 italic">
            "{renderQuoteWithHighlight()}"
          </p>
          
          <p className="text-[14px] font-semibold text-gray-800">{testimonial.authorName}</p>
          <p className="text-[12px] text-gray-500">{testimonial.authorTitle}</p>
        </div>

        {/* Product Mockup */}
        <div className="flex-1 flex items-center justify-center w-full mt-4 relative">
          <div className="relative w-full max-w-lg">
            {/* Desktop Browser Window */}
            <div className="bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="bg-gray-50 px-3 py-2 border-b border-gray-100 flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm font-medium text-gray-800">Open chats</span>
                  <div className="flex -space-x-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-white"></div>
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 border-2 border-white"></div>
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-red-500 border-2 border-white"></div>
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-teal-500 border-2 border-white"></div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white text-xs font-medium">A</div>
                  <div>
                    <p className="text-xs font-medium text-gray-800">Amanda Brown</p>
                    <div className="bg-gray-100 rounded-lg p-2 mt-1">
                      <p className="text-xs text-gray-600">Hello, thanks for your...</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Phone */}
            <div className="absolute -right-4 top-1/2 -translate-y-1/3 w-[180px] bg-white rounded-[24px] shadow-2xl border border-gray-100 overflow-hidden">
              <div className="bg-gray-800 h-6 flex items-center justify-center">
                <div className="w-12 h-3 bg-black rounded-full"></div>
              </div>
              <div className="p-2 space-y-2">
                <div className="flex justify-end">
                  <div className="bg-blue-500 rounded-xl px-2 py-1.5">
                    <p className="text-[10px] text-white">Hello Amanda,</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-gray-100 rounded-xl px-2 py-1.5">
                    <p className="text-[10px] text-gray-600">Reply STOP to opt out.</p>
                  </div>
                </div>
                <div className="flex items-start gap-1">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-400 to-yellow-500"></div>
                  <div className="bg-white border border-gray-100 rounded-xl px-2 py-1.5 shadow-sm">
                    <p className="text-[10px] text-gray-600">Hello, thanks for your offer!</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-green-500 rounded-xl px-2 py-1.5">
                    <p className="text-[10px] text-white">Hello, thanks for your offer! Will try it</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Icons */}
            <div className="absolute -left-2 top-4 w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div className="absolute right-16 -bottom-2 w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Company Logos */}
        <div className="flex items-center justify-center gap-6 flex-wrap mt-4">
          <span className="text-gray-500 font-semibold text-xs">FORTO</span>
          <span className="text-gray-500 font-semibold text-xs">QiQ</span>
          <span className="text-gray-500 font-semibold text-xs">IXICA</span>
          <span className="text-gray-500 font-semibold text-xs">Cataphract</span>
          <span className="text-gray-500 font-semibold text-xs">Marketplace</span>
        </div>
      </div>
    </div>
  );
}
