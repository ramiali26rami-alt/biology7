import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: 'dummy-key' });
console.log("ai.models:", Object.getOwnPropertyNames(Object.getPrototypeOf(ai.models)));
console.log("ai.models.generateContent:", typeof ai.models.generateContent);
