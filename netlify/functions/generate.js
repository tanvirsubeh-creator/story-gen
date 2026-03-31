exports.handler = async (event) => {
    // 1. Only allow POST requests
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
    }

    try {
        const { prompt } = JSON.parse(event.body);

        // 2. Check for the API Key
        if (!process.env.ANTHROPIC_API_KEY) {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: "API Key missing in Netlify settings." })
            };
        }

        // 3. Call Anthropic API with the correct "user" role structure
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": process.env.ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
                model: "claude-3-haiku-20240307",
                max_tokens: 2000,
                messages: [
                    { "role": "user", "content": prompt }
                ]
            })
        });

        const data = await response.json();

        // 4. Handle API Errors
        if (!response.ok) {
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: data.error?.message || "Anthropic API Error" })
            };
        }

        // 5. Success
        return {
            statusCode: 200,
            body: JSON.stringify(data)
        };

    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Server Error: " + error.message })
        };
    }
};
