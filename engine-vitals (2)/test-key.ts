import { GoogleGenAI } from "@google/genai";

async function test() {
  const key = process.env.GEMINI_API_KEY?.replace(/['"]/g, '').trim();
  console.log("Using key:", key);
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const res = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: "hello"
    });
    console.log("Success!");
  } catch (e) {
    console.error("Failed:", e);
  }
}
test();
