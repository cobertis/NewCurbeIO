import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  message?: string;
  fullScreen?: boolean;
  className?: string;
}

export function LoadingSpinner({ 
  message = "Loading...", 
  fullScreen = true,
  className 
}: LoadingSpinnerProps) {
  return (
    <div className={cn(
      "flex items-center justify-center",
      fullScreen ? "min-h-screen" : "h-full w-full",
      className
    )}>
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
