import Groq from "groq-sdk";

const groq = new Groq({ 
  apiKey: "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",
  dangerouslyAllowBrowser: true 
});

export enum QuestType {
  QUIZ = "QUIZ",
  CODING_CHALLENGE = "CODING_CHALLENGE",
  CONCEPT_MATCH = "CONCEPT_MATCH",
  STORY_ADVENTURE = "STORY_ADVENTURE",
  SHORT_ANSWER = "SHORT_ANSWER"
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  type: QuestType;
  content: any;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  points: number;
}

export async function fetchWikipediaExtract(query: string): Promise<{ extract: string; imageUrl: string }> {
  try {
    const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
    if (!response.ok) {
        throw new Error('Wikipedia page not found');
    }
    const data = await response.json();
    return {
      extract: data.extract || "No description available.",
      imageUrl: data.thumbnail?.source || "https://picsum.photos/seed/edu/800/450"
    };
  } catch (error) {
    console.error("Wikipedia fetch error:", error);
    return {
        extract: "Information could not be retrieved from Wikipedia at this time.",
        imageUrl: "https://picsum.photos/seed/edu/800/450"
    }
  }
}

export async function generateQuest(query: string, level: string, useGrounding: boolean = true, numOptions: number = 4): Promise<Quest> {
    try {
        const response = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are an educational AI. Create a 5-question multiple choice quiz about the topic provided by the user. 
                    Format your response strictly as a JSON object matching this structure:
                    {
                        "questions": [
                            {
                                "question": "Question text",
                                "options": ["Option A", "Option B", "Option C", "Option D"],
                                "correctAnswerIndex": 0,
                                "explanation": "Explanation for the correct answer"
                            }
                        ]
                    }`
                },
                { role: "user", content: `Topic: ${query}` }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.5,
            response_format: { type: "json_object" }
        });

        const questContent = JSON.parse(response.choices[0]?.message?.content || "{}");
        const questions = questContent.questions || [];

        if (questions.length === 0) {
            return createFallbackQuest(query);
        }

        return {
            id: Math.random().toString(36).substr(2, 9),
            title: `Mastery: ${query}`,
            description: `Test your knowledge on ${query} and related concepts.`,
            type: QuestType.QUIZ,
            difficulty: "Intermediate",
            points: 250,
            content: questions
        };
    } catch (error) {
        console.error("Groq generateQuest error:", error);
        return createFallbackQuest(query);
    }
}

function createFallbackQuest(query: string): Quest {
  return {
      id: Math.random().toString(36).substr(2, 9),
      title: `Explore ${query}`,
      description: `Learn about ${query} through this quick challenge!`,
      type: QuestType.QUIZ,
      difficulty: "Beginner",
      points: 100,
      content: [
          {
              question: `Are you ready to learn about ${query}?`,
              options: ["Yes", "Maybe", "No", "Always"],
              correctAnswerIndex: 0,
              explanation: "Get started!"
          }
      ]
  }
}

export async function generateTopicExplanation(query: string, level: string, useGrounding: boolean = true): Promise<{ explanation: string; imageUrl: string; sources?: any[] }> {
    try {
        const response = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "Provide a concise, engaging summary of the requested topic in markdown format, suitable for a learner."
                },
                { role: "user", content: `Explain the topic: ${query}` }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.5
        });

        const explanation = response.choices[0]?.message?.content || "Information could not be retrieved.";
        const { imageUrl } = await fetchWikipediaExtract(query);

        return {
            explanation,
            imageUrl: imageUrl || "https://picsum.photos/seed/edu/800/450",
            sources: []
        };
    } catch (error) {
        console.error("Groq explain error:", error);
        return {
            explanation: "Information could not be retrieved at this time.",
            imageUrl: "https://picsum.photos/seed/edu/800/450"
        };
    }
}

export async function animateTopicImage(imageUrl: string, prompt: string): Promise<string> {
    return imageUrl;
}

export async function getChatResponse(message: string, history: any[]) {
    try {
        const messages = [
            { role: "system", content: "You are a helpful and encouraging educational tutor. Keep answers informative, friendly, and concise." },
            ...history.map(h => ({ role: h.role === "user" ? "user" : "assistant", content: h.content })),
            { role: "user", content: message }
        ];

        const response = await groq.chat.completions.create({
            messages: messages as any,
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
        });

        return response.choices[0]?.message?.content || "I'm not sure about that. Could you ask me about a specific topic?";
    } catch (e) {
        console.error("Groq chat error:", e);
        return "Sorry, I am having trouble connecting to the AI brain right now.";
    }
}
