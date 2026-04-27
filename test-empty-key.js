import { GoogleGenAI } from "@google/genai";
async function run() {
  try {
    const ai = new GoogleGenAI({ apiKey: "" });
    await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: "Hello"
    });
  } catch (e) {
    console.error(e?.message);
  }
}
run();
