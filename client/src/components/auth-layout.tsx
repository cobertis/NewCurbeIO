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
      className="min-h-screen w-full flex items-center justify-center p-4 md:p-8 relative"
      style={{
        background: 'radial-gradient(ellipse 80% 50% at 50% 50%, #0C1829 0%, #070F1E 50%, #050B14 100%)',
      }}
    >
      <div 
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
      
      <div className="w-full max-w-[1080px] h-[660px] flex flex-col lg:flex-row gap-0 relative z-10">
        <div 
          className="w-full lg:w-[42%] h-full flex flex-col relative z-10 lg:rounded-l-[2rem] lg:rounded-r-none rounded-[2rem] overflow-hidden"
          style={{
            background: '#F6F8FB',
            boxShadow: '0 25px 80px -12px rgba(0,0,0,0.08), 0 4px 20px -4px rgba(0,0,0,0.04)',
            border: '1px solid rgba(0,0,0,0.03)',
          }}
        >
          <div 
            className="absolute inset-0 opacity-[0.015] pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            }}
          />
          
          <div className="flex flex-col h-full p-8 md:p-10 relative z-10">
            <div className="shrink-0">
              <div className="flex items-center gap-2 mb-5">
                <img src={logo} alt="Curbe" className="h-7 w-auto" />
              </div>

              <h1 className="text-[1.625rem] md:text-[1.875rem] font-semibold text-gray-900 leading-[1.1] tracking-[-0.02em] mb-1">
                {title}
              </h1>
              <p className="text-gray-500 text-[13px] mb-4">
                {subtitle}
              </p>
            </div>

            {ssoEnabled && (
              <>
                <button
                  type="button"
                  onClick={onGoogleSSO}
                  className="w-full h-[44px] flex items-center justify-center gap-3 bg-white border border-gray-200 rounded-xl text-[13px] font-medium text-gray-700 hover:bg-white hover:border-gray-300 hover:shadow-sm transition-all duration-150 shrink-0"
                  style={{
                    boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                  }}
                  data-testid="button-google-sso"
                >
                  <svg className="w-[16px] h-[16px]" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>

                <div className="flex items-center gap-3 my-3 shrink-0">
                  <div className="flex-1 h-px bg-gray-900/[0.06]"></div>
                  <span className="text-[10px] text-gray-400 font-medium">or</span>
                  <div className="flex-1 h-px bg-gray-900/[0.06]"></div>
                </div>
              </>
            )}

            <div className="flex-1 min-h-0">
              {children}
            </div>

            <div className="shrink-0 pt-2">
              {footer}
            </div>
          </div>
        </div>

        <div className="hidden lg:block w-[58%] h-full relative rounded-r-[2rem] overflow-hidden">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ 
              backgroundImage: `url(${backgroundImage})`,
            }}
          />
          <div 
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 40%, transparent 60%)',
            }}
          />
          <div 
            className="absolute bottom-0 left-0 right-0 p-10"
            style={{
              backdropFilter: 'blur(8px)',
              background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 100%)',
            }}
          >
            <h2 className="text-[1.5rem] font-semibold text-white mb-2 tracking-tight">
              Turn every interaction into progress.
            </h2>
            <p className="text-white/60 text-sm max-w-md mb-5">
              From first hello to loyal customer—without the chaos.
            </p>
            
            <div className="flex gap-3">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-white/90 text-[13px] font-medium">Automation</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
