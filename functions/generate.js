exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { prompt } = JSON.parse(event.body);

    if (!process.env.ANTHROPIC_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "API Key missing in Netlify settings." })
      };
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20251001",
        max_tokens: 1000,
        messages: [
          { 
            role: "user", 
            content: `You are a viral story writer. ${prompt} 
            Return ONLY a valid JSON object with the keys: "title", "body", and "views". 
            Do not include any other text.` 
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      // This will now show the EXACT reason (e.g., "invalid_request_error")
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `Anthropic Error: ${data.error?.type || 'Unknown'} - ${data.error?.message || ''}` })
      };
    }

    const content = data.content[0].text;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: [{ text: content }]
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `System Error: ${error.message}` }),
    };
  }
};
