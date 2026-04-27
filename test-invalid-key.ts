import { GoogleGenAI } from "@google/genai";
async function test() {
  const ai = new GoogleGenAI({ apiKey: "invalid_key_123" });
  try {
    await ai.models.generateContent({ model: "gemini-3.1-pro-preview", contents: "hello" });
    console.log("Success");
  } catch (e: any) {
    console.error("Error code:", e.status);
    console.error("Error full:", e);
  }
}
test();
