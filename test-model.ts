import { GoogleGenAI } from "@google/genai";
async function test() {
  try {
    const ai = new GoogleGenAI();
    await ai.models.generateContent({ model: "gemini-3.1-pro-preview", contents: "hello" });
    console.log("Success with 3.1");
  } catch (e: any) {
    console.error("Error with 3.1:", e.message);
  }
}
test();
