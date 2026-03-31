const axios = require('axios');

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { prompt } = JSON.parse(event.body);

    // Using an AI API (Example: Anthropic Claude)
    // Ensure you have your API key set in Netlify Environment Variables
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: "claude-3-haiku-20240307",
        max_tokens: 1000,
        messages: [
          { role: "user", content: prompt }
        ],
        // System instruction to ensure the AI returns ONLY the JSON object your frontend expects
        system: "You are a viral story writer. Return ONLY a valid JSON object with the keys: 'title', 'body', and 'views'. 'views' should be a realistic viral number like '2.4M'."
      },
      {
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY, // Set this in Netlify UI
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
      }
    );

    // Extract the text content from the AI response
    const content = response.data.content[0].text;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: [{ text: content }] // Matches your frontend's data.content[0].text logic
      }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to generate story" }),
    };
  }
};
