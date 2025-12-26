import { aiDeskService } from "./ai-desk-service";
import { aiOpenAIService } from "./ai-openai-service";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const MAX_CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;

// Legal page detection patterns
const LEGAL_URL_PATTERNS = [
  /\/privacy/i,
  /\/privacy-policy/i,
  /\/terms/i,
  /\/terms-of-service/i,
  /\/terms-and-conditions/i,
  /\/tos\b/i,
  /\/legal/i,
  /\/gdpr/i,
  /\/cookie/i,
  /\/cookies/i,
  /\/disclaimer/i,
  /\/mobile-alerts-terms/i,
  /\/refund-policy/i,
  /\/ccpa/i,
  /\/acceptable-use/i,
  /\/dmca/i,
];

const LEGAL_TITLE_KEYWORDS = [
  'privacy policy',
  'privacy notice',
  'terms of service',
  'terms of use',
  'terms and conditions',
  'legal notice',
  'cookie policy',
  'cookies policy',
  'disclaimer',
  'gdpr',
  'ccpa',
  'refund policy',
  'acceptable use',
  'mobile alerts terms',
];

function isLegalPage(url: string, title: string): boolean {
  const urlPath = new URL(url).pathname.toLowerCase();
  
  // Check URL patterns
  for (const pattern of LEGAL_URL_PATTERNS) {
    if (pattern.test(urlPath)) {
      return true;
    }
  }
  
  // Check title keywords
  const lowerTitle = title.toLowerCase();
  for (const keyword of LEGAL_TITLE_KEYWORDS) {
    if (lowerTitle.includes(keyword)) {
      return true;
    }
  }
  
  return false;
}

// Dynamic imports for file processing to handle missing packages gracefully
let pdfParse: any = null;
let mammoth: any = null;

async function loadPdfParse() {
  if (!pdfParse) {
    try {
      pdfParse = (await import("pdf-parse")).default;
    } catch (e) {
      console.warn("[AI-Ingestion] pdf-parse not available");
    }
  }
  return pdfParse;
}

async function loadMammoth() {
  if (!mammoth) {
    try {
      mammoth = await import("mammoth");
    } catch (e) {
      console.warn("[AI-Ingestion] mammoth not available");
    }
  }
  return mammoth;
}

export interface IngestionResult {
  success: boolean;
  pagesProcessed: number;
  chunksCreated: number;
  chunksSkipped: number;
  error?: string;
}

export class AiIngestionService {
  async syncSource(companyId: string, sourceId: string): Promise<IngestionResult> {
    const source = await aiDeskService.getKbSource(companyId, sourceId);
    if (!source) {
      return { success: false, pagesProcessed: 0, chunksCreated: 0, chunksSkipped: 0, error: "Source not found" };
    }

    await aiDeskService.updateKbSourceStatus(companyId, sourceId, "syncing");

    try {
      if (source.type === "url" && source.url) {
        return await this.processUrl(companyId, sourceId, source.url, source.config as any);
      }
      
      if (source.type === "file" && source.fileId) {
        const file = await aiDeskService.getFile(companyId, source.fileId);
        if (!file) {
          throw new Error("File record not found");
        }
        const filePath = path.join(process.cwd(), file.storageKey);
        return await this.ingestFile(companyId, sourceId, filePath, file.mimeType, file.originalName);
      }
      
      return { success: false, pagesProcessed: 0, chunksCreated: 0, chunksSkipped: 0, error: "Unsupported source type" };
    } catch (error: any) {
      const errorMsg = error.message || String(error);
      await aiDeskService.updateKbSourceStatus(companyId, sourceId, "failed", errorMsg);
      return { success: false, pagesProcessed: 0, chunksCreated: 0, chunksSkipped: 0, error: errorMsg };
    }
  }

  async ingestFile(
    companyId: string,
    sourceId: string,
    filePath: string,
    mimeType: string,
    fileName: string
  ): Promise<IngestionResult> {
    let text = "";

    try {
      const ext = path.extname(fileName).toLowerCase();

      if (mimeType === "application/pdf" || ext === ".pdf") {
        const pdfParser = await loadPdfParse();
        if (!pdfParser) {
          throw new Error("PDF parsing not available - pdf-parse package not installed");
        }
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParser(dataBuffer);
        text = pdfData.text || "";
      } else if (
        mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        ext === ".docx"
      ) {
        const mammothLib = await loadMammoth();
        if (!mammothLib) {
          throw new Error("DOCX parsing not available - mammoth package not installed");
        }
        const dataBuffer = fs.readFileSync(filePath);
        const result = await mammothLib.extractRawText({ buffer: dataBuffer });
        text = result.value || "";
      } else if (mimeType === "text/plain" || mimeType === "text/markdown" || ext === ".txt" || ext === ".md") {
        text = fs.readFileSync(filePath, "utf-8");
      } else {
        throw new Error(`Unsupported file type: ${mimeType}`);
      }

      if (!text || text.trim().length < 50) {
        throw new Error("File contains insufficient text content");
      }

      const contentHash = crypto.createHash("sha256").update(text).digest("hex");
      const currentVersion = await aiDeskService.getNextChunkVersion(companyId);

      // Create document record
      const doc = await aiDeskService.createDocument({
        companyId,
        sourceId,
        title: fileName,
        contentHash,
        meta: { processedAt: new Date().toISOString(), fileType: mimeType },
      });

      // Chunk the text
      const chunks = this.chunkText(text);
      
      // Create embeddings
      const { embeddings } = await aiOpenAIService.createEmbeddings(chunks);

      // Save chunks
      const chunkRecords = chunks.map((content, index) => {
        const chunkHash = crypto.createHash("sha256").update(content).digest("hex");
        return {
          companyId,
          documentId: doc.id,
          chunkIndex: index,
          content,
          contentHash: chunkHash,
          version: currentVersion,
          embedding: JSON.stringify(embeddings[index] || []),
          meta: { fileName },
        };
      });

      const result = await aiDeskService.createChunksWithDedup(chunkRecords);

      await aiDeskService.archiveObsoleteChunks(companyId, currentVersion);
      await aiDeskService.updateSourceCounts(companyId, sourceId);
      await aiDeskService.updateKbSourceStatus(companyId, sourceId, "ready");

      console.log(`[AI-Ingestion] File processed: ${fileName}, ${result.created} chunks created, ${result.skipped} skipped`);

      return {
        success: true,
        pagesProcessed: 1,
        chunksCreated: result.created,
        chunksSkipped: result.skipped,
      };
    } catch (error: any) {
      const errorMsg = error.message || String(error);
      await aiDeskService.updateKbSourceStatus(companyId, sourceId, "failed", errorMsg);
      console.error(`[AI-Ingestion] File ingestion failed: ${errorMsg}`);
      return { success: false, pagesProcessed: 0, chunksCreated: 0, chunksSkipped: 0, error: errorMsg };
    }
  }

  private async processUrl(
    companyId: string,
    sourceId: string,
    url: string,
    config?: { maxPages?: number; sameDomainOnly?: boolean; excludeLegal?: boolean }
  ): Promise<IngestionResult> {
    const maxPages = config?.maxPages ?? 10;
    const sameDomainOnly = config?.sameDomainOnly ?? true;
    const excludeLegal = config?.excludeLegal !== false; // Default to true
    
    console.log(`[AI-Ingestion] Starting URL sync: ${url}, maxPages: ${maxPages}`);
    
    const visited = new Set<string>();
    const queue: string[] = [url];
    let pagesProcessed = 0;
    let chunksCreated = 0;
    let chunksSkipped = 0;

    const baseUrl = new URL(url);
    const baseDomain = baseUrl.hostname;

    const currentVersion = await aiDeskService.getNextChunkVersion(companyId);

    while (queue.length > 0 && pagesProcessed < maxPages) {
      const currentUrl = queue.shift()!;
      if (visited.has(currentUrl)) continue;
      visited.add(currentUrl);

      try {
        console.log(`[AI-Ingestion] Fetching: ${currentUrl}`);
        
        // First try direct fetch
        let html = "";
        let title = "";
        let content = "";
        let links: string[] = [];
        let usedJinaReader = false;
        
        const response = await fetch(currentUrl, {
          headers: { 
            "User-Agent": "Mozilla/5.0 (compatible; CurbeKBBot/1.0; +https://curbe.io)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
          signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
          console.log(`[AI-Ingestion] HTTP ${response.status} for ${currentUrl}`);
          continue;
        }
        
        const contentType = response.headers.get("content-type") || "";
        console.log(`[AI-Ingestion] Content-Type: ${contentType}`);
        if (!contentType.includes("text/html")) {
          console.log(`[AI-Ingestion] Skipping non-HTML content: ${contentType}`);
          continue;
        }

        html = await response.text();
        console.log(`[AI-Ingestion] HTML length: ${html.length}`);
        const parsed = this.parseHtml(html, currentUrl);
        title = parsed.title;
        content = parsed.content;
        links = parsed.links;
        console.log(`[AI-Ingestion] Parsed content length: ${content.length}, title: ${title}`);

        // If content is too short, try Jina Reader API (renders JavaScript)
        if (content.length < 100) {
          console.log(`[AI-Ingestion] Content too short, trying Jina Reader for JS rendering...`);
          try {
            const jinaResult = await this.fetchWithJinaReader(currentUrl);
            if (jinaResult.content.length > content.length) {
              content = jinaResult.content;
              title = jinaResult.title || title;
              links = [...links, ...jinaResult.links];
              usedJinaReader = true;
              console.log(`[AI-Ingestion] Jina Reader success: ${content.length} chars, title: ${title}`);
            }
          } catch (jinaError: any) {
            console.log(`[AI-Ingestion] Jina Reader failed: ${jinaError?.message || jinaError}`);
          }
        }

        if (!content || content.length < 100) {
          console.log(`[AI-Ingestion] Content too short (${content.length} chars), skipping`);
          continue;
        }

        // Check if this is a legal page and should be excluded
        if (excludeLegal && isLegalPage(currentUrl, title)) {
          console.log(`[AI-Ingestion] Skipping legal page: ${currentUrl} (title: ${title})`);
          continue;
        }

        const contentHash = crypto.createHash("sha256").update(content).digest("hex");
        
        let doc = await aiDeskService.getDocumentByHash(companyId, sourceId, contentHash);
        let isNewDoc = false;
        
        if (doc) {
          // Document exists - check if it has chunks
          const existingChunks = await aiDeskService.listChunks(companyId, doc.id);
          if (existingChunks.length > 0) {
            // Document has chunks, skip
            pagesProcessed++;
            continue;
          }
          // Document exists but has no chunks - we'll recreate them
          console.log(`[AI-Ingestion] Document ${doc.id} exists but has no chunks, creating chunks...`);
        } else {
          // Create new document
          doc = await aiDeskService.createDocument({
            companyId,
            sourceId,
            title: title || currentUrl,
            url: currentUrl,
            contentHash,
            meta: { fetchedAt: new Date().toISOString() },
          });
          isNewDoc = true;
        }

        const chunks = this.chunkText(content);
        
        // Try to create embeddings, but continue without them if OpenAI is not configured
        let embeddings: number[][] = [];
        try {
          const embeddingResult = await aiOpenAIService.createEmbeddings(chunks);
          embeddings = embeddingResult.embeddings;
        } catch (embeddingError: any) {
          console.log(`[AI-Ingestion] Embeddings skipped: ${embeddingError?.message || 'OpenAI not configured'}`);
          // Continue without embeddings - chunks will still be saved for viewing
        }

        const chunkRecords = chunks.map((text, index) => {
          const chunkHash = crypto.createHash("sha256").update(text).digest("hex");
          return {
            companyId,
            documentId: doc.id,
            chunkIndex: index,
            content: text,
            contentHash: chunkHash,
            version: currentVersion,
            embedding: JSON.stringify(embeddings[index] || []),
            meta: { url: currentUrl },
          };
        });

        const result = await aiDeskService.createChunksWithDedup(chunkRecords);
        chunksCreated += result.created;
        chunksSkipped += result.skipped;
        pagesProcessed++;

        if (sameDomainOnly) {
          for (const link of links) {
            try {
              const linkUrl = new URL(link);
              if (linkUrl.hostname === baseDomain && !visited.has(link)) {
                queue.push(link);
              }
            } catch {}
          }
        }
      } catch (e: any) {
        console.error(`[AI-Ingestion] Error processing ${currentUrl}:`, e?.message || e);
      }
    }

    await aiDeskService.archiveObsoleteChunks(companyId, currentVersion);
    await aiDeskService.updateSourceCounts(companyId, sourceId);
    await aiDeskService.updateKbSourceStatus(companyId, sourceId, "ready");

    console.log(`[AI-Ingestion] Processed ${pagesProcessed} pages, ${chunksCreated} new chunks, ${chunksSkipped} duplicates skipped`);

    return { success: true, pagesProcessed, chunksCreated, chunksSkipped };
  }

  private parseHtml(html: string, baseUrl: string): { title: string; content: string; links: string[] } {
    let title = "";
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      title = this.decodeHtmlEntities(titleMatch[1].trim());
    }

    // Also try og:title or meta description as fallback for title
    if (!title) {
      const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
                           html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
      if (ogTitleMatch) {
        title = this.decodeHtmlEntities(ogTitleMatch[1].trim());
      }
    }

    // Extract meta description as additional content
    let metaDescription = "";
    const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    if (metaDescMatch) {
      metaDescription = this.decodeHtmlEntities(metaDescMatch[1].trim());
    }

    // Remove scripts, styles, and comments first (these definitely need to go)
    let cleanHtml = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<svg[\s\S]*?<\/svg>/gi, "")
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, "");

    // Strategy 1: Try to find main content areas
    let content = "";
    const mainMatch = cleanHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
                      cleanHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                      cleanHtml.match(/<div[^>]*class="[^"]*(?:content|main|body|article)[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                      cleanHtml.match(/<div[^>]*id="[^"]*(?:content|main|body|article)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    
    if (mainMatch && mainMatch[1]) {
      content = mainMatch[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    // Strategy 2: If main content not found or too short, use body without nav/header/footer
    if (content.length < 100) {
      const bodyMatch = cleanHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      let bodyContent = bodyMatch ? bodyMatch[1] : cleanHtml;
      
      bodyContent = bodyContent
        .replace(/<nav[\s\S]*?<\/nav>/gi, "")
        .replace(/<header[\s\S]*?<\/header>/gi, "")
        .replace(/<footer[\s\S]*?<\/footer>/gi, "")
        .replace(/<aside[\s\S]*?<\/aside>/gi, "");

      content = bodyContent
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    // Strategy 3: If still empty, extract ALL text from the entire HTML (most aggressive)
    if (content.length < 50) {
      content = cleanHtml
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    content = this.decodeHtmlEntities(content);

    // Add meta description to content if we have it and content is short
    if (metaDescription && content.length < 200) {
      content = metaDescription + " " + content;
    }

    // If content is still empty, log for debugging
    if (content.length < 50) {
      console.log(`[AI-Ingestion] Very short content (${content.length} chars). This site may require JavaScript rendering.`);
      console.log(`[AI-Ingestion] Raw HTML sample: ${html.substring(0, 1000)}`);
    }

    // Extract links
    const links: string[] = [];
    const hrefRegex = /<a[^>]+href=["']([^"']+)["']/gi;
    let match;
    while ((match = hrefRegex.exec(html)) !== null) {
      try {
        const absoluteUrl = new URL(match[1], baseUrl).href;
        if (absoluteUrl.startsWith("http")) {
          links.push(absoluteUrl);
        }
      } catch {}
    }

    return { title, content, links };
  }

  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
  }

  private async fetchWithJinaReader(url: string): Promise<{ title: string; content: string; links: string[] }> {
    const jinaUrl = `https://r.jina.ai/${url}`;
    console.log(`[AI-Ingestion] Using Jina Reader: ${jinaUrl}`);
    
    const response = await fetch(jinaUrl, {
      headers: {
        "Accept": "text/plain",
        "User-Agent": "Mozilla/5.0 (compatible; CurbeKBBot/1.0)",
      },
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      throw new Error(`Jina Reader HTTP ${response.status}`);
    }

    const text = await response.text();
    console.log(`[AI-Ingestion] Jina Reader returned ${text.length} chars`);

    let title = "";
    let content = text;
    const links: string[] = [];

    const titleMatch = text.match(/^Title:\s*(.+)$/m);
    if (titleMatch) {
      title = titleMatch[1].trim();
      content = text.replace(/^Title:\s*.+$/m, "").trim();
    }

    const urlSourceMatch = text.match(/^URL Source:\s*(.+)$/m);
    if (urlSourceMatch) {
      content = content.replace(/^URL Source:\s*.+$/m, "").trim();
    }

    const markdownHeader = text.match(/^Markdown Content:\s*$/m);
    if (markdownHeader) {
      const markdownIndex = text.indexOf("Markdown Content:");
      if (markdownIndex !== -1) {
        content = text.substring(markdownIndex + "Markdown Content:".length).trim();
      }
    }

    content = content
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/#{1,6}\s*/g, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
      .replace(/^[-*+]\s+/gm, "")
      .replace(/^\d+\.\s+/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    while ((match = linkRegex.exec(text)) !== null) {
      try {
        const absoluteUrl = new URL(match[2], url).href;
        if (absoluteUrl.startsWith("http")) {
          links.push(absoluteUrl);
        }
      } catch {}
    }

    return { title, content, links };
  }

  private chunkText(text: string): string[] {
    const chunks: string[] = [];
    const words = text.split(/\s+/);
    
    let currentChunk: string[] = [];
    let currentLength = 0;

    for (const word of words) {
      if (currentLength + word.length + 1 > MAX_CHUNK_SIZE && currentChunk.length > 0) {
        chunks.push(currentChunk.join(" "));
        
        const overlapWords = Math.ceil(CHUNK_OVERLAP / 10);
        currentChunk = currentChunk.slice(-overlapWords);
        currentLength = currentChunk.join(" ").length;
      }
      
      currentChunk.push(word);
      currentLength += word.length + 1;
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(" "));
    }

    return chunks;
  }
}

export const aiIngestionService = new AiIngestionService();
