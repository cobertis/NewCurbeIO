import { useState, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Bold, Italic, Link as LinkIcon, Code, Eye, FileCode } from "lucide-react";

interface HtmlEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function HtmlEditor({ value, onChange, placeholder }: HtmlEditorProps) {
  const [activeTab, setActiveTab] = useState<string>("code");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertTag = (openTag: string, closeTag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const newText = value.substring(0, start) + openTag + selectedText + closeTag + value.substring(end);
    
    onChange(newText);
    
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + openTag.length + selectedText.length + closeTag.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  return (
    <div className="border rounded-md">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-2">
          <TabsList className="h-9">
            <TabsTrigger value="code" className="gap-2" data-testid="tab-html-code">
              <FileCode className="h-4 w-4" />
              HTML Code
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2" data-testid="tab-html-preview">
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
          </TabsList>
          
          {activeTab === "code" && (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => insertTag("<strong>", "</strong>")}
                title="Bold"
                data-testid="button-html-bold"
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => insertTag("<em>", "</em>")}
                title="Italic"
                data-testid="button-html-italic"
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => insertTag('<a href="https://example.com">', "</a>")}
                title="Link"
                data-testid="button-html-link"
              >
                <LinkIcon className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => insertTag("<code>", "</code>")}
                title="Code"
                data-testid="button-html-code"
              >
                <Code className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <TabsContent value="code" className="m-0 border-0 p-0">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || "Enter HTML content here..."}
            className="min-h-[300px] rounded-none border-0 font-mono text-sm focus-visible:ring-0"
            data-testid="textarea-html-content"
          />
        </TabsContent>

        <TabsContent value="preview" className="m-0 border-0 p-0">
          <div className="min-h-[300px] overflow-auto p-4">
            <div 
              dangerouslySetInnerHTML={{ __html: value }} 
              className="prose prose-sm max-w-none dark:prose-invert"
              data-testid="preview-html-content"
            />
          </div>
        </TabsContent>
      </Tabs>
      
      <div className="border-t bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Available variables: <code className="mx-1 rounded bg-muted px-1 py-0.5">{'{{firstName}}'}</code>
        <code className="mx-1 rounded bg-muted px-1 py-0.5">{'{{name}}'}</code>
        <code className="mx-1 rounded bg-muted px-1 py-0.5">{'{{email}}'}</code>
      </div>
    </div>
  );
}
