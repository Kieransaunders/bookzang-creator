#!/usr/bin/env node
/**
 * Test script to verify Kimi API key is working
 * Run: node scripts/test-kimi-api.js
 */

const https = require("https");

const API_KEY = process.env.KIMI_API_KEY;

if (!API_KEY) {
  console.error("❌ KIMI_API_KEY not found in environment");
  console.error("Add it to .env.local and source it, or set it directly:");
  console.error("  export KIMI_API_KEY=your_key_here");
  process.exit(1);
}

console.log("Testing Kimi API key...");
console.log("Key:", API_KEY.slice(0, 8) + "...");

const testData = JSON.stringify({
  model: "kimi-k2-0710-preview",
  messages: [
    {
      role: "system",
      content:
        'You are a helpful assistant. Reply with "PONG" when user says "PING".',
    },
    {
      role: "user",
      content: "PING",
    },
  ],
  max_tokens: 10,
  temperature: 0,
});

const options = {
  hostname: "api.moonshot.cn",
  path: "/v1/chat/completions",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${API_KEY}`,
    "Content-Length": testData.length,
  },
};

const req = https.request(options, (res) => {
  let data = "";

  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    try {
      const response = JSON.parse(data);

      if (res.statusCode === 200 && response.choices?.[0]?.message?.content) {
        const content = response.choices[0].message.content.trim();
        console.log("✅ API key is working!");
        console.log("   Response:", content);
        console.log("   Model:", response.model);
        console.log("   Usage:", JSON.stringify(response.usage));
        process.exit(0);
      } else {
        console.error("❌ API returned error:");
        console.error("   Status:", res.statusCode);
        console.error("   Response:", JSON.stringify(response, null, 2));
        process.exit(1);
      }
    } catch (e) {
      console.error("❌ Failed to parse response:");
      console.error("   Status:", res.statusCode);
      console.error("   Raw:", data);
      process.exit(1);
    }
  });
});

req.on("error", (e) => {
  console.error("❌ Request failed:", e.message);
  process.exit(1);
});

req.write(testData);
req.end();
