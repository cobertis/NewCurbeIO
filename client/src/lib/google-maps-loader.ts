declare global {
  interface Window {
    google?: any;
  }
}

let googleMapsPromise: Promise<any> | null = null;

export async function loadGoogleMapsAPI(): Promise<any> {
  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Google Maps can only be loaded in browser'));
      return;
    }

    if (window.google?.maps) {
      resolve(window.google);
      return;
    }

    const callbackName = `googleMapsCallback_${Date.now()}`;
    
    (window as any)[callbackName] = () => {
      if (window.google?.maps) {
        resolve(window.google);
        delete (window as any)[callbackName];
      } else {
        reject(new Error('Google Maps failed to load'));
      }
    };

    const script = document.createElement('script');
    script.src = `/api/google-maps-js-loader?callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      reject(new Error('Failed to load Google Maps script'));
      delete (window as any)[callbackName];
    };

    document.head.appendChild(script);
  });

  return googleMapsPromise;
}
