import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  { id: 1, label: "Number" },
  { id: 2, label: "Info" },
  { id: 3, label: "Brand" },
  { id: 4, label: "Campaign" },
  { id: 5, label: "Review" },
];

interface StepIndicatorProps {
  currentStep: number;
  className?: string;
}

export function StepIndicator({ currentStep, className }: StepIndicatorProps) {
  return (
    <div className={cn("flex items-center justify-between w-full mb-10", className)}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        
        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold border-2",
                  isCompleted
                    ? "bg-white dark:bg-gray-900 border-blue-600 text-blue-600"
                    : isCurrent
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500"
                )}
                data-testid={`step-indicator-${index + 1}`}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={cn(
                  "text-sm font-medium whitespace-nowrap",
                  isCompleted || isCurrent
                    ? "text-gray-900 dark:text-gray-100"
                    : "text-gray-400 dark:text-gray-500"
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-4 mt-[-24px]",
                  isCompleted ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
