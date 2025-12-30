import { AiOpenAIService } from "./ai-openai-service";

const aiService = new AiOpenAIService();

interface CampaignAssistInput {
  smsUseCase: string;
  companyName?: string;
  brandVertical?: string;
  numberType?: string;
}

interface CampaignAssistOutput {
  messageAudience: string;
  messageContent: string;
  estimatedVolume: string;
  sampleMessages: string[];
  optInDescription: string;
  optInEvidence: string;
}

const VALID_VOLUMES = [
  "1-500",
  "501-1000",
  "1001-5000",
  "5001-10000",
  "10001-50000",
  "50001-100000",
  "100001+"
];

export async function generateCampaignContent(input: CampaignAssistInput): Promise<CampaignAssistOutput> {
  const systemPrompt = `You are an expert in A2P (Application-to-Person) SMS campaign compliance and carrier approval processes.
Your task is to generate optimized campaign content that will maximize the chances of approval for toll-free and 10DLC verification.

IMPORTANT RULES:
1. NEVER include SHAFT content (Sex, Hate, Alcohol, Firearms, Tobacco)
2. Always include opt-out language in sample messages like "Reply STOP to opt out"
3. Be specific and professional - vague descriptions get rejected
4. Focus on legitimate business use cases
5. Emphasize consent and opt-in processes
6. Sample messages should be realistic examples the business would actually send

You must respond with valid JSON matching this exact structure:
{
  "messageAudience": "Who receives messages and why (2-3 sentences, specific)",
  "messageContent": "Description of message content types (2-3 sentences, detailed)",
  "estimatedVolume": "Must be exactly one of: 1-500, 501-1000, 1001-5000, 5001-10000, 10001-50000, 50001-100000, 100001+",
  "sampleMessages": ["Array of 2-3 realistic SMS examples with opt-out language"],
  "optInDescription": "How users consent to receive messages (2-3 sentences)",
  "optInEvidence": "Documentation or proof of consent process (links, forms, etc.)"
}`;

  const userPrompt = `Generate A2P campaign content for approval with these details:
- SMS Use Case: ${input.smsUseCase}
- Company Name: ${input.companyName || "Business"}
- Industry/Vertical: ${input.brandVertical || "General Business"}
- Number Type: ${input.numberType || "toll-free"}

Generate professional, specific content that carriers will approve. Make sample messages realistic and include the company name where appropriate.`;

  try {
    const response = await aiService.chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ], {
      temperature: 0.7,
      maxTokens: 1500
    });

    const content = response.content;
    if (!content) {
      throw new Error("No content returned from AI");
    }

    // Extract JSON from the response (handle potential markdown code blocks)
    let jsonContent = content.trim();
    if (jsonContent.startsWith("```json")) {
      jsonContent = jsonContent.slice(7);
    } else if (jsonContent.startsWith("```")) {
      jsonContent = jsonContent.slice(3);
    }
    if (jsonContent.endsWith("```")) {
      jsonContent = jsonContent.slice(0, -3);
    }
    jsonContent = jsonContent.trim();

    const parsed = JSON.parse(jsonContent);
    
    // Validate and normalize the estimated volume
    if (!VALID_VOLUMES.includes(parsed.estimatedVolume)) {
      parsed.estimatedVolume = "1001-5000"; // Default to mid-range
    }

    // Ensure sample messages is an array
    if (!Array.isArray(parsed.sampleMessages)) {
      parsed.sampleMessages = [parsed.sampleMessages || ""];
    }

    // Ensure at least 2 sample messages
    while (parsed.sampleMessages.length < 2) {
      parsed.sampleMessages.push(`Thank you for choosing ${input.companyName || "our company"}. Reply STOP to opt out.`);
    }

    return {
      messageAudience: parsed.messageAudience || "",
      messageContent: parsed.messageContent || "",
      estimatedVolume: parsed.estimatedVolume,
      sampleMessages: parsed.sampleMessages,
      optInDescription: parsed.optInDescription || "",
      optInEvidence: parsed.optInEvidence || ""
    };
  } catch (error) {
    console.error("[Campaign Assist] Error generating content:", error);
    throw error;
  }
}
