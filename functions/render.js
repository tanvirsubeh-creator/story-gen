exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const SHOTSTACK_KEY = process.env.SHOTSTACK_API_KEY;
    if (!SHOTSTACK_KEY) throw new Error("Missing SHOTSTACK_API_KEY");

    let body;
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      throw new Error("Invalid request body");
    }

    const audioUrl   = body.audioUrl;
    const title      = body.title;
    const script     = body.script;
    const genreColor = body.genreColor || "#ffffff";
    const genreBg    = body.genreBg;

    if (!audioUrl || !title || !script) {
      throw new Error("Missing required fields: audioUrl, title, script");
    }

    console.log("Rendering: " + title + " | Audio: " + audioUrl);

    const WORDS_PER_SECOND = 2.5;
    const WORDS_PER_SCREEN = 4;

    const words = script.split(/\s+/).filter(Boolean);
    const clipDuration = WORDS_PER_SCREEN / WORDS_PER_SECOND;
    const totalDuration = Math.ceil(words.length / WORDS_PER_SECOND) + 2;

    console.log("Words: " + words.length + ", Duration: " + totalDuration + "s");

    const subtitleClips = [];
    for (var i = 0; i < words.length; i += WORDS_PER_SCREEN) {
      var chunk = words.slice(i, i + WORDS_PER_SCREEN).join(" ");
      var startTime = parseFloat((i / WORDS_PER_SECOND).toFixed(2));
      subtitleClips.push({
        asset: {
          type: "title",
          text: chunk,
          style: "future",
          color: "#ffffff",
          size: "medium",
          background: "rgba(0,0,0,0.55)",
          position: "bottom"
        },
        position: "bottom",
        offset: { y: 0.1 },
        start: startTime,
        length: parseFloat((clipDuration + 0.1).toFixed(2)),
        transition: { in: "fade", out: "fade" }
      });
    }

    var titleClip = {
      asset: {
        type: "title",
        text: title,
        style: "future",
        color: genreColor,
        size: "large"
      },
      start: 0,
      length: 2.5,
      transition: { in: "fade", out: "fade" }
    };

    var bgClip = {
      asset: {
        type: "html",
        html: "<div style=\"width:1080px;height:1920px;background:linear-gradient(135deg,#0a0a0f,#1a0a2e,#0a0a0f)\"></div>",
        width: 1080,
        height: 1920
      },
      start: 0,
      length: totalDuration
    };

    if (genreBg) {
      bgClip = {
        asset: {
          type: "video",
          src: genreBg,
          volume: 0
        },
        start: 0,
        length: totalDuration,
        fit: "cover",
        filter: "blur"
      };
    }

    console.log("Calling Shotstack...");
    const shotstackRes = await fetch("https://api.shotstack.io/stage/render", {
      method: "POST",
      headers: {
        "x-api-key": SHOTSTACK_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        timeline: {
          soundtrack: {
            src: audioUrl,
            effect: "fadeOut",
            volume: 1
          },
          tracks: [
            { clips: [titleClip].concat(subtitleClips) },
            { clips: [bgClip] }
          ]
        },
        output: {
          format: "mp4",
          resolution: "sd",
          aspectRatio: "9:16",
          fps: 25
        }
      })
    });

    if (!shotstackRes.ok) {
      const e = await shotstackRes.text();
      throw new Error("Shotstack failed: " + shotstackRes.status + " - " + e);
    }

    const shotstackData = await shotstackRes.json();
    console.log("Shotstack response: " + JSON.stringify(shotstackData));

    if (!shotstackData.response || !shotstackData.response.id) {
      throw new Error("No render ID returned: " + JSON.stringify(shotstackData));
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ renderId: shotstackData.response.id })
    };

  } catch (err) {
    console.error("render error:", err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
