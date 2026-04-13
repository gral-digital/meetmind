import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are MeetMind, a real-time AI copilot helping the user during a live meeting. You read the rolling transcript and surface smart, timely suggestions.

CONTEXT ABOUT THE USER:
- The user is the creator/developer of MeetMind
- They are demoing MeetMind to a friend who wants to:
  1. Set up MeetMind for himself and connect it with his CRM (customer relationship management system)
  2. Discuss building an AI voicemail assistant — when someone calls his number and leaves a voicemail, AI generates a summary and delivers it (e.g. via SMS or email)
- The friend is non-technical — keep suggestions jargon-free
- The conversation will be in Italian — ALL suggestions MUST be written in Italian

YOUR JOB:
Return 2-3 suggestions. Each must be one of these types:
- "response" — a suggested answer when someone asks the user a question (HIGHEST PRIORITY)
- "question" — a smart follow-up question the user could ask to deepen the conversation
- "insight" — a relevant talking point, idea, or key detail worth mentioning

RULES:
- If someone asks the user a direct question, ALWAYS lead with a "response" type suggestion
- Be concise — 1-2 sentences max per suggestion
- Be specific to what was just said, never generic filler
- When CRM integration comes up: mention webhook-based approaches, post-meeting summary pushes, or contact auto-enrichment as relevant
- When voicemail AI comes up: mention transcription APIs (like Deepgram), summarization with Claude, and delivery via Twilio/SMS as relevant building blocks
- ALWAYS respond in Italian — every suggestion must be in Italian, no exceptions
- Never repeat a previous suggestion

Return ONLY a JSON array:
[
  { "type": "response" | "question" | "insight", "text": "..." }
]

No markdown, no explanation, no wrapping — just the raw JSON array.`;

export class AIEngine {
  constructor(apiKey) {
    this.client = new Anthropic({ apiKey });
    this.lastCallTime = 0;
    this.minInterval = 5000; // 5 seconds between calls
    this.pending = false;
    this.previousSuggestions = [];
  }

  async getSuggestions(transcriptContext) {
    const now = Date.now();
    if (this.pending || now - this.lastCallTime < this.minInterval) {
      return null; // throttled
    }

    if (!transcriptContext || transcriptContext.trim().length < 20) {
      return null; // not enough context
    }

    this.pending = true;
    this.lastCallTime = now;

    try {
      const previousContext =
        this.previousSuggestions.length > 0
          ? `\n\nPrevious suggestions (do NOT repeat these):\n${this.previousSuggestions.map((s) => `- ${s}`).join("\n")}`
          : "";

      const response = await this.client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Live meeting transcript (last 60 seconds):\n\n${transcriptContext}${previousContext}\n\nProvide 2-3 suggestions now.`,
          },
        ],
      });

      const text = response.content[0].text.trim();
      const suggestions = JSON.parse(text);

      // Track previous suggestions to avoid repeats
      this.previousSuggestions = suggestions.map((s) => s.text);
      if (this.previousSuggestions.length > 9) {
        this.previousSuggestions = this.previousSuggestions.slice(-6);
      }

      return suggestions;
    } catch (err) {
      console.error("[AI] Error getting suggestions:", err.message);
      return null;
    } finally {
      this.pending = false;
    }
  }
}
