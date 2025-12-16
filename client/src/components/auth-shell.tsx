import logo from "@assets/logo no fondo_1760457183587.png";
import backgroundImage from "@assets/Curbe_SaaS_Brand_Illustration_1765854893427.png";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  rightPanelTitle?: string;
  rightPanelSubtitle?: string;
  rightPanelBadges?: string[];
  showRightPanel?: boolean;
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  rightPanelTitle = "Turn every interaction into progress.",
  rightPanelSubtitle = "From first hello to loyal customer—without the chaos.",
  rightPanelBadges = ["Automation", "Unified inbox"],
  showRightPanel = true,
}: AuthShellProps) {
  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center p-4 md:p-8"
      style={{
        background: 'linear-gradient(135deg, #070B14 0%, #0B1220 50%, #0A1018 100%)',
      }}
    >
      {/* Subtle glow effect */}
      <div 
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 40%, rgba(59, 130, 246, 0.05) 0%, transparent 60%)',
        }}
      />

      {/* Main card container - FIXED dimensions */}
      <div 
        className="relative z-10 w-full flex rounded-3xl overflow-hidden"
        style={{
          width: 'clamp(920px, 78vw, 1100px)',
          height: 'clamp(560px, 70vh, 680px)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        }}
      >
        {/* Left Panel - Form (42%) */}
        <div 
          className="relative flex flex-col bg-white"
          style={{ width: showRightPanel ? '42%' : '100%' }}
        >
          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto px-12 py-10">
            {/* Logo */}
            <div className="mb-8">
              <img src={logo} alt="Curbe.io" className="h-8 w-auto" />
            </div>

            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-semibold text-gray-900 tracking-tight mb-2">
                {title}
              </h1>
              <p className="text-gray-500 text-[15px]">
                {subtitle}
              </p>
            </div>

            {/* Form content */}
            <div className="space-y-5">
              {children}
            </div>
          </div>

          {/* Footer - fixed at bottom */}
          {footer && (
            <div className="shrink-0 px-12 py-6 border-t border-gray-100">
              {footer}
            </div>
          )}
        </div>

        {/* Right Panel - Visual (58%) */}
        {showRightPanel && (
          <div 
            className="relative hidden lg:block"
            style={{ width: '58%' }}
          >
            {/* Background image */}
            <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{ 
                backgroundImage: `url(${backgroundImage})`,
              }}
            />
            
            {/* Gradient overlay */}
            <div 
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.6) 100%)',
              }}
            />

            {/* Content */}
            <div className="absolute bottom-0 left-0 right-0 p-10">
              <h2 className="text-2xl font-semibold text-white mb-2 tracking-tight">
                {rightPanelTitle}
              </h2>
              <p className="text-white/60 text-[15px] mb-6 max-w-md">
                {rightPanelSubtitle}
              </p>
              
              {/* Badges */}
              {rightPanelBadges.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {rightPanelBadges.map((badge, index) => (
                    <span 
                      key={index}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium text-white/90 border border-white/20"
                      style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        backdropFilter: 'blur(8px)',
                      }}
                    >
                      <span className="w-2 h-2 rounded-full bg-blue-400" />
                      {badge}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile responsive adjustments */}
      <style>{`
        @media (max-width: 1023px) {
          .auth-shell-container {
            width: 100% !important;
            height: auto !important;
            min-height: auto !important;
          }
        }
      `}</style>
    </div>
  );
}
