import { useEffect } from "react";

export default function WidgetTestPage() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  useEffect(() => {
    if (!token) return;

    const script = document.createElement("script");
    script.src = `${window.location.origin}/widget/sdk.js`;
    script.async = true;
    script.onload = () => {
      if ((window as any).curbeWidgetSDK) {
        (window as any).curbeWidgetSDK.run({
          websiteToken: token,
          baseUrl: window.location.origin,
        });
      }
    };
    document.head.appendChild(script);

    return () => {
      if ((window as any).curbeWidgetSDK) {
        (window as any).curbeWidgetSDK.shutdown();
      }
      script.remove();
    };
  }, [token]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Missing Token</h1>
          <p className="text-gray-600">Please provide a widget token in the URL.</p>
          <p className="text-sm text-gray-500 mt-2">Example: /widget/test?token=YOUR_TOKEN</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200">
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Widget Test Page</h1>
          <p className="text-gray-600 mb-6">
            This is a test page to preview your chat widget. The widget should appear in the bottom-right corner.
          </p>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-800">How it works:</h2>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">1.</span>
                  <span>Click the chat bubble in the bottom-right corner</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">2.</span>
                  <span>Fill out the pre-chat form (if enabled)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">3.</span>
                  <span>Start a conversation with your team</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Widget Token</h3>
              <code className="text-sm bg-slate-200 px-2 py-1 rounded break-all">{token}</code>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Sample Content</h2>
          <p className="text-gray-600 mb-4">
            This simulates a typical webpage where your widget would be embedded. 
            Visitors can browse your content and open the chat when they need assistance.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-slate-100 rounded-lg p-4">
                <div className="w-full h-24 bg-slate-200 rounded mb-3"></div>
                <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-slate-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
