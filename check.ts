import fs from 'fs';
import dotenv from "dotenv";
dotenv.config({ override: true });
console.log("Length:", process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : "undefined");
console.log("Starts with 10:", process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 10) : "none");
