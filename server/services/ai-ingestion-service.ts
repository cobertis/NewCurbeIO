import { aiDeskService } from "./ai-desk-service";
import { aiOpenAIService } from "./ai-openai-service";
import crypto from "crypto";

const MAX_CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;

export interface IngestionResult {
  success: boolean;
  pagesProcessed: number;
  chunksCreated: number;
  error?: string;
}

export class AiIngestionService {
  async syncSource(companyId: string, sourceId: string): Promise<IngestionResult> {
    const source = await aiDeskService.getKbSource(companyId, sourceId);
    if (!source) {
      return { success: false, pagesProcessed: 0, chunksCreated: 0, error: "Source not found" };
    }

    await aiDeskService.updateKbSourceStatus(companyId, sourceId, "syncing");

    try {
      if (source.type === "url" && source.url) {
        return await this.processUrl(companyId, sourceId, source.url, source.config as any);
      }
      
      return { success: false, pagesProcessed: 0, chunksCreated: 0, error: "Unsupported source type" };
    } catch (error: any) {
      const errorMsg = error.message || String(error);
      await aiDeskService.updateKbSourceStatus(companyId, sourceId, "failed", errorMsg);
      return { success: false, pagesProcessed: 0, chunksCreated: 0, error: errorMsg };
    }
  }

  private async processUrl(
    companyId: string,
    sourceId: string,
    url: string,
    config?: { maxPages?: number; sameDomainOnly?: boolean }
  ): Promise<IngestionResult> {
    const maxPages = config?.maxPages ?? 10;
    const sameDomainOnly = config?.sameDomainOnly ?? true;
    
    const visited = new Set<string>();
    const queue: string[] = [url];
    let pagesProcessed = 0;
    let chunksCreated = 0;

    const baseUrl = new URL(url);
    const baseDomain = baseUrl.hostname;

    while (queue.length > 0 && pagesProcessed < maxPages) {
      const currentUrl = queue.shift()!;
      if (visited.has(currentUrl)) continue;
      visited.add(currentUrl);

      try {
        const response = await fetch(currentUrl, {
          headers: { "User-Agent": "CurbeKBBot/1.0" },
          signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) continue;
        
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("text/html")) continue;

        const html = await response.text();
        const { title, content, links } = this.parseHtml(html, currentUrl);

        if (!content || content.length < 100) continue;

        const contentHash = crypto.createHash("sha256").update(content).digest("hex");
        
        const existingDoc = await aiDeskService.getDocumentByHash(companyId, sourceId, contentHash);
        if (existingDoc) {
          pagesProcessed++;
          continue;
        }

        const doc = await aiDeskService.createDocument({
          companyId,
          sourceId,
          title: title || currentUrl,
          url: currentUrl,
          contentHash,
          meta: { fetchedAt: new Date().toISOString() },
        });

        const chunks = this.chunkText(content);
        
        const { embeddings } = await aiOpenAIService.createEmbeddings(chunks);

        const chunkRecords = chunks.map((text, index) => ({
          companyId,
          documentId: doc.id,
          chunkIndex: index,
          content: text,
          embedding: JSON.stringify(embeddings[index] || []),
          meta: { url: currentUrl },
        }));

        await aiDeskService.createChunks(chunkRecords);
        chunksCreated += chunks.length;
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
      } catch (e) {
        console.error(`[AI-Ingestion] Error processing ${currentUrl}:`, e);
      }
    }

    await aiDeskService.updateSourceCounts(companyId, sourceId);
    await aiDeskService.updateKbSourceStatus(companyId, sourceId, "ready");

    return { success: true, pagesProcessed, chunksCreated };
  }

  private parseHtml(html: string, baseUrl: string): { title: string; content: string; links: string[] } {
    let title = "";
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      title = this.decodeHtmlEntities(titleMatch[1].trim());
    }

    let content = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<aside[\s\S]*?<\/aside>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    content = this.decodeHtmlEntities(content);

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
