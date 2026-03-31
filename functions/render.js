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

    if (!SHOTSTACK_KEY) {
      throw new Error("Missing SHOTSTACK_API_KEY");
    }

    // Parse body sent from frontend
    let body;
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      throw new Error("Invalid request body — must be JSON");
    }

    const { audioUrl, title, script, genreColor, genreBg } = body;

    if (!audioUrl || !title || !script) {
      throw new Error("Missing required fields: audioUrl, title, script");
    }

    console.log("Rendering:", title, "| Audio:", audioUrl);

    // ─────────────────────────────────────────
    // Build word-by-word subtitle clips
    // ─────────────────────────────────────────
    const WORDS_PER_SECOND = 2.5;
    const WORDS_PER_SCREEN = 4;

    const words = script.split(/\s+/).filter(Boolean);
    const clipDuration = WORDS_PER_SCREEN / WORDS_PER_SECOND;
    const totalDuration = Math.ceil(words.length / WORDS_PER_SECOND) + 2;

    console.log(`Words: ${words.length}, Duration: ${totalDuration}s`);

    const subtitleClips = [];
    for (let i = 0; i < words.length; i += WORDS_PER_SCREEN) {
      const chunk = words.slice(i, i + WORDS_PER_SCREEN).join(" ");
      const startTime = parseFloat((i / WORDS_PER_SECOND).toFixed(2));

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

    // Title card for first 2.5 seconds
    const titleClip = {
      asset: {
        type: "title",
        text: title,
        style: "future",
        color: genreColor || "#ffffff",
        size: "large"
      },
      start: 0,
      length: 2.5,
      transition: { in: "fade", out: "fade" }
    };

    // ─────────────────────────────────────────
    // Submit to Shotstack
    // ─────────────────────────────────────────
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
            {
              // Top layer: title card + subtitles
              clips: [titleClip, ...subtitleClips]
            },
            {
              // Bottom layer: background video
              clips: [
                {
                  asset: {
                    type: "video",
                    src: genreBg || "https://videos.pexels.com/video-files/854173/854173-hd_1920_1080_25fps.mp4",
                    volume: 0
                  },
                  start: 0,
                  length: totalDuration,
                  fit: "cover",
                  filter: "blur"
                }
              ]
            }
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
      throw new Error(`Shotstack failed: ${shotstackRes.status} - ${e}`);
    }

    const shotstackData = await shotstackRes.json();
    console.log("Shotstack response:", JSON.stringify(shotstackData));

    if (!shotstackData.response || !shotstackData.response.id) {
      throw new Error("No render ID returned: " + JSON.stringify(shotstackData));
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        renderId: shotstackData.response.id
      })
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
