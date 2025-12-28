import { cn } from "@/lib/utils";
import { Phone, ExternalLink, ArrowRight } from "lucide-react";

interface WhatsAppTemplatePreviewProps {
  template: {
    name: string;
    language: string;
    components?: Array<{
      type: string;
      text?: string;
      format?: string;
      buttons?: Array<{
        type: string;
        text: string;
        url?: string;
        phone_number?: string;
      }>;
    }>;
  };
  variables?: Record<string, string>;
  className?: string;
  compact?: boolean;
}

export function WhatsAppTemplatePreview({ 
  template, 
  variables = {}, 
  className,
  compact = false 
}: WhatsAppTemplatePreviewProps) {
  const interpolateText = (text: string, prefix: string) => {
    let result = text;
    Object.keys(variables)
      .filter(k => k.startsWith(prefix))
      .forEach(key => {
        const varNum = key.split("_").slice(1).join("_");
        const value = variables[key];
        if (value) {
          result = result.replace(new RegExp(`\\{\\{${varNum}\\}\\}`, 'g'), value);
        }
      });
    return result;
  };

  const headerComp = template.components?.find(c => c.type?.toUpperCase() === "HEADER");
  const bodyComp = template.components?.find(c => c.type?.toUpperCase() === "BODY");
  const footerComp = template.components?.find(c => c.type?.toUpperCase() === "FOOTER");
  const buttonsComp = template.components?.find(c => 
    c.type?.toUpperCase() === "BUTTONS" || c.type?.toUpperCase() === "BUTTON"
  );

  return (
    <div className={cn(
      "bg-[#e7fed6] dark:bg-[#025144] rounded-lg overflow-hidden shadow-sm max-w-[320px]",
      className
    )}>
      <div className={cn("p-3", compact && "p-2")}>
        {headerComp?.text && (
          <p className={cn(
            "font-semibold text-gray-900 dark:text-white mb-2",
            compact ? "text-sm" : "text-base"
          )}>
            {interpolateText(headerComp.text, "HEADER_")}
          </p>
        )}
        
        {bodyComp?.text && (
          <p className={cn(
            "text-gray-800 dark:text-gray-100 whitespace-pre-wrap",
            compact ? "text-xs" : "text-sm"
          )}>
            {interpolateText(bodyComp.text, "BODY_")}
          </p>
        )}
        
        {footerComp?.text && (
          <p className={cn(
            "text-gray-500 dark:text-gray-400 mt-2",
            compact ? "text-[10px]" : "text-xs"
          )}>
            {footerComp.text}
          </p>
        )}
      </div>
      
      {buttonsComp?.buttons && buttonsComp.buttons.length > 0 && (
        <div className="border-t border-[#c5e8b7] dark:border-[#014d40]">
          {buttonsComp.buttons.map((btn, idx) => {
            const btnType = btn.type?.toUpperCase();
            let Icon = ArrowRight;
            if (btnType === "PHONE_NUMBER" || btnType === "VOICE_CALL") {
              Icon = Phone;
            } else if (btnType === "URL") {
              Icon = ExternalLink;
            }
            
            return (
              <div
                key={idx}
                className={cn(
                  "flex items-center justify-center gap-2 py-2 text-[#0d7cd5] dark:text-[#4fc3f7] cursor-default",
                  compact ? "text-xs py-1.5" : "text-sm",
                  idx > 0 && "border-t border-[#c5e8b7] dark:border-[#014d40]"
                )}
              >
                <Icon className={cn(compact ? "h-3 w-3" : "h-4 w-4")} />
                <span className="font-medium">{btn.text}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function extractTemplateVariables(template: {
  components?: Array<{
    type: string;
    text?: string;
    url?: string;
    buttons?: Array<{
      type: string;
      text: string;
      url?: string;
    }>;
  }>;
}): Record<string, string> {
  const vars: Record<string, string> = {};
  
  template.components?.forEach((comp) => {
    const compType = comp.type?.toUpperCase();
    
    if (["HEADER", "BODY"].includes(compType) && comp.text) {
      const matches = comp.text.match(/\{\{(\d+)\}\}/g) || [];
      matches.forEach((match) => {
        const num = match.replace(/[{}]/g, '');
        vars[`${compType}_${num}`] = "";
      });
    }
    
    if ((compType === "BUTTONS" || compType === "BUTTON") && comp.buttons) {
      comp.buttons.forEach((btn, btnIdx) => {
        if (btn.type?.toUpperCase() === "URL" && btn.url) {
          const urlMatches = btn.url.match(/\{\{(\d+)\}\}/g) || [];
          urlMatches.forEach((match) => {
            const num = match.replace(/[{}]/g, '');
            vars[`BUTTON_${btnIdx}_${num}`] = "";
          });
        }
      });
    }
  });
  
  return vars;
}

export function buildRenderedText(template: {
  components?: Array<{
    type: string;
    text?: string;
  }>;
}, variables: Record<string, string>): string {
  let renderedText = "";
  
  template.components?.forEach((comp) => {
    const compType = comp.type?.toUpperCase();
    
    if (compType === "HEADER" && comp.text) {
      let headerText = comp.text;
      Object.keys(variables)
        .filter(k => k.startsWith("HEADER_"))
        .forEach(key => {
          const varNum = key.split("_")[1];
          headerText = headerText.replace(`{{${varNum}}}`, variables[key] || "");
        });
      renderedText += `*${headerText}*\n`;
    }
    
    if (compType === "BODY" && comp.text) {
      let bodyText = comp.text;
      Object.keys(variables)
        .filter(k => k.startsWith("BODY_"))
        .forEach(key => {
          const varNum = key.split("_")[1];
          bodyText = bodyText.replace(`{{${varNum}}}`, variables[key] || "");
        });
      renderedText += bodyText + "\n";
    }
    
    if (compType === "FOOTER" && comp.text) {
      renderedText += `_${comp.text}_\n`;
    }
  });
  
  return renderedText.trim();
}
