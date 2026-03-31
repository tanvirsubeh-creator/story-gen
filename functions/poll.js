exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };

  const renderId = event.queryStringParameters && event.queryStringParameters.id;
  if (!renderId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "No render ID provided" })
    };
  }

  try {
    const SHOTSTACK_KEY = process.env.SHOTSTACK_API_KEY;

    if (!SHOTSTACK_KEY) {
      throw new Error("Missing SHOTSTACK_API_KEY");
    }

    console.log("Polling render ID:", renderId);

    const res = await fetch(`https://api.shotstack.io/v1/render/${renderId}`, {
      headers: { "x-api-key": SHOTSTACK_KEY }
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Shotstack poll error:", errText);
      throw new Error(`Shotstack poll failed: ${res.status} - ${errText}`);
    }

    const data = await res.json();
    console.log("Poll response:", JSON.stringify(data));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: data.response.status,
        url: data.response.url
      })
    };

  } catch (err) {
    console.error("Poll error:", err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
