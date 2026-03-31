exports.handler = async (event) => {
  // 1. Only allow POST requests from your frontend
  if (event.httpMethod !== "POST") {
    return { 
      statusCode: 405, 
      body: JSON.stringify({ error: "Method Not Allowed" }) 
    };
  }

  try {
    const { prompt } = JSON.parse(event.body);

    // 2. Call the AI API (Anthropic Claude)
    // IMPORTANT: Go to Netlify Settings -> Env Variables and add ANTHROPIC_API_KEY
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
        system: "You are a viral story writer. Return ONLY a valid JSON object with the keys: 'title', 'body', and 'views'. Do not include any conversational text."
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "AI API Error");
    }

    const data = await response.json();
    
    // 3. Format the response to match your index.html expectations
    // Your frontend uses: data.content[0].text
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: [
          { text: data.content[0].text }
        ]
      }),
    };

  } catch (error) {
    console.error("Function Error:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
