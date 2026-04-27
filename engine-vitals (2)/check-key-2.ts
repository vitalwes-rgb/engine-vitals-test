import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

async function test() {
  console.log("Raw key:", process.env.GEMINI_API_KEY);
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const res = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: "hello"
    });
    console.log("OK:", res.text);
  } catch (e: any) {
    console.error("FAIL:", e.message, JSON.stringify(e));
  }
}
test();
