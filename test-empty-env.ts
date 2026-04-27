import { GoogleGenAI } from "@google/genai";
process.env.GEMINI_API_KEY = ""; // Force empty
const aiOpts = { httpOptions: { timeout: 300000 } };
try {
  const ai = new GoogleGenAI(aiOpts);
  await ai.models.generateContent({ model: "gemini-2.5-pro", contents: "hello" });
} catch(e: any) {
  console.error("Error generating:", e.message);
}
