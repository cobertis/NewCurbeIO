import logo from "@assets/logo no fondo_1760457183587.png";
import backgroundImage from "@assets/Curbe_SaaS_Brand_Illustration_1765854893427.png";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  ssoEnabled?: boolean;
  onGoogleSSO?: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}

export function AuthLayout({
  title,
  subtitle,
  ssoEnabled = true,
  onGoogleSSO,
  footer,
  children,
}: AuthLayoutProps) {
  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center p-4 md:p-8 relative bg-slate-950"
    >
      {/* Subtle noise texture */}
      <div 
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
      
      <div 
        className="w-full max-w-[960px] flex flex-col lg:flex-row gap-0 relative z-10 rounded-2xl overflow-hidden"
        style={{
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
        }}
      >
        {/* Left panel - Form */}
        <div className="w-full lg:w-[48%] bg-white flex flex-col">
          <div className="flex flex-col h-full px-12 py-10">
            {/* Logo */}
            <div className="mb-8">
              <img src={logo} alt="Curbe" className="h-7 w-auto" />
            </div>

            {/* Header */}
            <div className="mb-6">
              <h1 className="text-[2rem] font-semibold text-gray-900 leading-tight tracking-[-0.02em] mb-1">
                {title}
              </h1>
              <p className="text-gray-500 text-[15px]">
                {subtitle}
              </p>
            </div>

            {/* SSO */}
            {ssoEnabled && (
              <>
                <button
                  type="button"
                  onClick={onGoogleSSO}
                  className="w-full h-[48px] flex items-center justify-center gap-3 bg-white border border-gray-200 rounded-lg text-[14px] font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all duration-150"
                  data-testid="button-google-sso"
                >
                  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>

                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-gray-200"></div>
                  <span className="text-[12px] text-gray-400 font-medium">or</span>
                  <div className="flex-1 h-px bg-gray-200"></div>
                </div>
              </>
            )}

            {/* Form content */}
            <div className="flex-1">
              {children}
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4">
              {footer}
            </div>
          </div>
        </div>

        {/* Right panel - Ambient image */}
        <div className="hidden lg:block w-[52%] relative">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ 
              backgroundImage: `url(${backgroundImage})`,
              filter: 'blur(2px) saturate(0.9) brightness(0.75)',
            }}
          />
          {/* Dark overlay */}
          <div 
            className="absolute inset-0"
            style={{
              background: 'rgba(0,0,0,0.45)',
            }}
          />
          {/* Optional minimal text */}
          <div className="absolute bottom-8 left-8 right-8">
            <p className="text-white/50 text-[13px]">
              Customer relationships, simplified.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
