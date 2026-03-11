import { GoogleGenAI, Type, Modality, VideoGenerationReferenceType } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

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

export async function generateQuest(query: string, level: string, useGrounding: boolean = true, numOptions: number = 4): Promise<Quest> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate a gamified learning quest for a ${level} level student about: ${query}. 
    The quest should be engaging and educational. Use real-world, up-to-date information.
    
    Return a JSON object with:
    - title: A catchy quest name.
    - description: A short story-like intro to the quest.
    - type: One of "QUIZ", "CODING_CHALLENGE", "CONCEPT_MATCH", "STORY_ADVENTURE", "SHORT_ANSWER".
    - difficulty: "Beginner", "Intermediate", or "Advanced".
    - points: Number between 50 and 200.
    - content: 
        - If QUIZ: { questions: [ { question, options[], correctAnswerIndex, explanation }, ... ] } (Exactly 5 questions)
        - If CODING_CHALLENGE: { language, task, starterCode, solution, hints[] }
        - If CONCEPT_MATCH: { pairs: [ { left, right }, ... ] }
        - If STORY_ADVENTURE: { story_parts: [ { text, choices: [ { text, next_part_index, points_reward }, ... ] }, ... ] }
        - If SHORT_ANSWER: { question, placeholder, acceptedAnswers: string[], explanation }
    
    IMPORTANT: The "type" field must match the structure of the "content" field.
    `,
    config: {
      tools: useGrounding ? [{ googleSearch: {} }] : [],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          type: { type: Type.STRING, enum: ["QUIZ", "CODING_CHALLENGE", "CONCEPT_MATCH", "STORY_ADVENTURE", "SHORT_ANSWER"] },
          difficulty: { type: Type.STRING, enum: ["Beginner", "Intermediate", "Advanced"] },
          points: { type: Type.NUMBER },
          content: { 
            type: Type.OBJECT,
            description: "The game content structure depends on the 'type' field."
          }
        },
        required: ["title", "description", "type", "difficulty", "points", "content"]
      }
    }
  });

  const text = response.text || "{}";
  const cleanJson = text.replace(/```json\n?|```/g, "").trim();
  const questData = JSON.parse(cleanJson);
  return {
    ...questData,
    id: Math.random().toString(36).substr(2, 9)
  };
}

export async function generateTopicExplanation(query: string, level: string, useGrounding: boolean = true): Promise<{ explanation: string; imageUrl: string; sources?: any[] }> {
  const ai = getAI();
  
  try {
    // Run both calls in parallel for better performance
    const [textResponse, imageResponse] = await Promise.all([
      ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Explain the topic "${query}" to a ${level} level student in a simple, engaging, and educational way. Use 2-3 short paragraphs. Include recent facts if applicable.`,
        config: {
          tools: useGrounding ? [{ googleSearch: {} }] : []
        }
      }),
      ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [
            {
              text: `A cinematic, high-quality, and vibrant educational illustration representing the concept of ${query}. Modern 3D digital art style, immersive atmosphere, 4K resolution detail.`,
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9"
          },
        },
      })
    ]);

    let imageUrl = "";
    for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        imageUrl = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }

    return {
      explanation: textResponse.text || "No explanation available.",
      imageUrl: imageUrl || "https://picsum.photos/seed/edu/800/450",
      sources: textResponse.candidates?.[0]?.groundingMetadata?.groundingChunks
    };
  } catch (error) {
    console.error("Error in generateTopicExplanation:", error);
    throw error;
  }
}

export async function animateTopicImage(imageUrl: string, prompt: string): Promise<string> {
  const base64Data = imageUrl.split(',')[1];
  const dynamicAi = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY || "" });
  
  let operation = await dynamicAi.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: `Animate this educational scene: ${prompt}. Subtle motion, cinematic lighting.`,
    image: {
      imageBytes: base64Data,
      mimeType: 'image/png',
    },
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9'
    }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await dynamicAi.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("Video generation failed");

  const response = await fetch(downloadLink, {
    method: 'GET',
    headers: {
      'x-goog-api-key': process.env.API_KEY || process.env.GEMINI_API_KEY || "",
    },
  });
  
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function getChatResponse(message: string, history: any[]) {
  const ai = getAI();
  const chat = ai.chats.create({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction: "You are EduBot, a friendly and brilliant AI tutor for students. You explain complex topics simply, use analogies, and encourage curiosity. Keep responses concise and use Markdown.",
      tools: [{ googleSearch: {} }]
    }
  });

  const response = await chat.sendMessage({ message });
  return response.text;
}
