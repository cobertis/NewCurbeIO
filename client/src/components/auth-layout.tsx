import logo from "@assets/logo no fondo_1760457183587.png";
import backgroundImage from "@assets/Curbe_SaaS_Brand_Illustration_1765854893427.png";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  ssoEnabled?: boolean;
  onGoogleSSO?: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
  rightPanelTitle?: string;
  rightPanelSubtitle?: string;
  rightPanelBadges?: string[];
}

export function AuthLayout({
  title,
  subtitle,
  ssoEnabled = false,
  onGoogleSSO,
  footer,
  children,
  rightPanelTitle = "Turn every interaction into progress.",
  rightPanelSubtitle = "From first hello to loyal customer—without the chaos.",
  rightPanelBadges = ["Automation", "Unified inbox"],
}: AuthLayoutProps) {
  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center p-4 md:p-6"
      style={{
        background: 'linear-gradient(145deg, #070B14 0%, #0B1220 50%, #0A1018 100%)',
      }}
    >
      {/* Subtle ambient glow */}
      <div 
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 30%, rgba(59, 130, 246, 0.03) 0%, transparent 60%)',
        }}
      />

      {/* Main card container - Hero presence */}
      <div 
        className="relative z-10 w-full flex rounded-2xl overflow-hidden animate-in fade-in duration-300"
        style={{
          width: 'clamp(360px, 82vw, 1140px)',
          height: 'clamp(620px, 72vh, 740px)',
          boxShadow: '0 25px 80px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.04)',
        }}
      >
        {/* Left Panel - Form (40%) */}
        <div 
          className="relative flex flex-col bg-white w-full lg:w-[40%]"
        >
          {/* Header zone - Logo */}
          <div className="shrink-0 px-8 lg:px-10 pt-8 pb-2">
            <img src={logo} alt="Curbe" className="h-10 w-auto" />
          </div>

          {/* Main content - Centered form */}
          <div className="flex-1 flex flex-col justify-center px-8 lg:px-10 py-4 overflow-y-auto">
            {/* Title & Subtitle */}
            <div className="mb-6">
              <h1 className="text-[32px] lg:text-[36px] font-semibold text-gray-900 leading-tight tracking-[-0.025em] mb-1">
                {title}
              </h1>
              <p className="text-gray-400 text-[14px] font-normal">
                {subtitle}
              </p>
            </div>

            {/* Form content */}
            <div className="space-y-5">
              {children}
            </div>

            {/* SSO Section - Below form */}
            {ssoEnabled && onGoogleSSO && (
              <div className="mt-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex-1 h-px bg-gray-200"></div>
                  <span className="text-[11px] text-gray-400 font-medium tracking-wider uppercase">or continue with</span>
                  <div className="flex-1 h-px bg-gray-200"></div>
                </div>

                <button
                  type="button"
                  onClick={onGoogleSSO}
                  className="w-full h-11 flex items-center justify-center gap-2.5 bg-white border border-gray-200 rounded-lg text-[13px] font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700 transition-all duration-150"
                  data-testid="button-google-sso"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google
                </button>
              </div>
            )}
          </div>

          {/* Footer zone - Fixed at bottom */}
          <div className="shrink-0 mt-auto px-8 lg:px-10 py-5 border-t border-gray-100">
            {footer}
          </div>
        </div>

        {/* Right Panel - Visual (60%) */}
        <div 
          className="relative hidden lg:flex w-[60%] items-center"
        >
          {/* Background image */}
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ 
              backgroundImage: `url(${backgroundImage})`,
            }}
          />
          
          {/* Gradient overlay - subtle from bottom */}
          <div 
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.5) 100%)',
            }}
          />

          {/* Content - Positioned lower but not at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-10 pb-12">
            <h2 className="text-[20px] font-semibold text-white mb-2 tracking-tight leading-snug max-w-md">
              {rightPanelTitle}
            </h2>
            <p className="text-white/50 text-[13px] mb-5 max-w-sm leading-relaxed">
              {rightPanelSubtitle}
            </p>
            
            {/* Badges - Smaller, more subtle */}
            {rightPanelBadges.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {rightPanelBadges.slice(0, 2).map((badge, index) => (
                  <span 
                    key={index}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium text-white/70 border border-white/10"
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <span className="w-1 h-1 rounded-full bg-blue-400/80" />
                    {badge}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
