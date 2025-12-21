import { cn } from "@/lib/utils";

const steps = [
  { id: 1, label: "Number" },
  { id: 2, label: "Info" },
  { id: 3, label: "Brand" },
  { id: 4, label: "Campaign" },
  { id: 5, label: "Review" },
];

interface StepIndicatorProps {
  className?: string;
}

export function StepIndicator({ className }: StepIndicatorProps) {
  return (
    <div className={cn("flex items-center justify-between w-full mb-10", className)}>
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold border-2 bg-blue-600 border-blue-600 text-white"
              data-testid={`step-indicator-${index + 1}`}
            >
              {index + 1}
            </div>
            <span className="text-sm font-medium whitespace-nowrap text-gray-900 dark:text-gray-100">
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div className="flex-1 h-0.5 mx-4 mt-[-24px] bg-blue-600" />
          )}
        </div>
      ))}
    </div>
  );
}
