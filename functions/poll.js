exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };

  const renderId = event.queryStringParameters?.id;
  if (!renderId) return { statusCode: 400, headers, body: JSON.stringify({ error: "No ID" }) };

  try {
    const res = await fetch(`https://api.shotstack.io/stage/render/${renderId}`, {
      headers: { "x-api-key": process.env.SHOTSTACK_API_KEY },
    });
    const data = await res.json();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: data?.response?.status,
        url: data?.response?.url
      }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
