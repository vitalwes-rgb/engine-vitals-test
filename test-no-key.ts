import { GoogleGenAI } from "@google/genai";
console.log("process.env.GEMINI_API_KEY length:", process.env.GEMINI_API_KEY?.length);
const aiOpts = {};
aiOpts.httpOptions = { timeout: 300000 };
const ai = new GoogleGenAI(aiOpts);
ai.models.generateContent({ model: "gemini-2.5-pro", contents: "hello" })
  .then(res => console.log(res.text))
  .catch(e => console.error("Error:", e.message));
