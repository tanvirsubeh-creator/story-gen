exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { prompt } = JSON.parse(event.body);

    if (!process.env.ANTHROPIC_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "API Key missing in Netlify settings!" })
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
        model: "claude-3-5-sonnet-20240620", // Switched to a more stable model
        max_tokens: 1000,
        system: "You are a viral story writer. Return ONLY a valid JSON object with keys 'title', 'body', and 'views'.",
        messages: [
          { role: "user", content: prompt }
        ]
      })
    });

    const data = await response.json();

    // Catch API-specific errors (like invalid keys or bad formatting)
    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `Anthropic says: ${data.error?.message || "Invalid Request"}` })
      };
    }

    // Extract the text from the response
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
