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

    const audioUrl      = body.audioUrl;
    const title         = body.title;
    const script        = body.script;
    const genreColor    = body.genreColor || "#ff4500";
    const wordTimings   = body.wordTimings || [];
    const audioDuration = body.audioDuration || 60;

    if (!audioUrl || !title || !script) {
      throw new Error("Missing required fields: audioUrl, title, script");
    }

    console.log("Rendering: " + title + " | Words: " + wordTimings.length + " | Duration: " + audioDuration + "s");

    const totalDuration = audioDuration + 1;

    // Escape HTML special chars
    function esc(str) {
      return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // Reddit-style title card HTML (shows for first 3 seconds)
    const redditCardHtml = `<html><head><style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body {
        width:540px; height:960px;
        background:transparent;
        display:flex; align-items:center; justify-content:center;
        font-family:'IBM Plex Sans','Noto Sans',Arial,sans-serif;
      }
      .card {
        background:#ffffff;
        border:1px solid #edeff1;
        border-radius:12px;
        padding:20px;
        width:480px;
        box-shadow:0 4px 24px rgba(0,0,0,0.5);
      }
      .subreddit-row {
        display:flex; align-items:center; gap:8px; margin-bottom:12px;
      }
      .avatar {
        width:28px; height:28px; border-radius:50%;
        background:${genreColor};
        display:flex; align-items:center; justify-content:center;
        font-size:12px; font-weight:bold; color:white;
      }
      .sub-name { font-size:13px; font-weight:700; color:#1c1c1c; }
      .posted-by { font-size:12px; color:#878a8c; }
      .title-text {
        font-size:18px; font-weight:700; color:#1c1c1c;
        line-height:1.4; margin-bottom:14px;
      }
      .vote-row { display:flex; align-items:center; gap:14px; }
      .upvote-btn {
        display:flex; align-items:center; gap:5px;
        background:#f6f7f8; border-radius:20px; padding:5px 12px;
        font-size:13px; font-weight:700; color:${genreColor};
      }
      .comments { font-size:13px; color:#878a8c; }
    </style></head><body>
      <div class="card">
        <div class="subreddit-row">
          <div class="avatar">r/</div>
          <div>
            <div class="sub-name">r/AskReddit</div>
            <div class="posted-by">Posted by u/storytime_ai</div>
          </div>
        </div>
        <div class="title-text">${esc(title)}</div>
        <div class="vote-row">
          <div class="upvote-btn"><span>▲</span> 47.2k</div>
          <div class="comments">💬 3.1k comments</div>
        </div>
      </div>
    </body></html>`;

    // Reddit card clip (first 3 seconds)
    var clips = [{
      asset: {
        type: "html",
        html: redditCardHtml,
        width: 540,
        height: 960
      },
      position: "center",
      start: 0,
      length: 3,
      transition: { in: "fade", out: "fade" }
    }];

    // Helper to build a transparent word HTML clip
    function wordHtml(word) {
      return `<html><head><style>
        * { margin:0; padding:0; }
        body {
          width:540px; height:960px;
          background:transparent;
          display:flex; align-items:center; justify-content:center;
          font-family:'IBM Plex Sans',Arial,sans-serif;
        }
        .word {
          font-size:52px; font-weight:800; color:#ffffff;
          text-align:center;
          text-shadow:0 2px 12px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,1);
          padding:0 24px; line-height:1.2;
        }
      </style></head><body><div class="word">${esc(word)}</div></body></html>`;
    }

    // Word-by-word clips using exact timestamps from ElevenLabs
    if (wordTimings.length > 0) {
      for (var i = 0; i < wordTimings.length; i++) {
        var wt = wordTimings[i];
        var start = parseFloat((wt.start + 3).toFixed(3)); // offset by 3s card duration
        var length = parseFloat((wt.end - wt.start + 0.05).toFixed(3));
        if (length < 0.1) length = 0.1;
        clips.push({
          asset: {
            type: "html",
            html: wordHtml(wt.word),
            width: 540,
            height: 960
          },
          position: "center",
          start: start,
          length: length
        });
      }
    } else {
      // Fallback: estimated timing if no wordTimings
      var words = script.split(/\s+/).filter(Boolean);
      var wordDuration = parseFloat((audioDuration / words.length).toFixed(3));
      for (var j = 0; j < words.length; j++) {
        clips.push({
          asset: {
            type: "html",
            html: wordHtml(words[j]),
            width: 540,
            height: 960
          },
          position: "center",
          start: parseFloat((3 + j * wordDuration).toFixed(3)),
          length: parseFloat((wordDuration + 0.05).toFixed(3))
        });
      }
    }

    // Minecraft parkour background
    var bgClip = {
      asset: {
        type: "video",
        src: "https://res.cloudinary.com/dzcvfc1nc/video/upload/v1775000828/v24044gl0000d1mgkrfog65sk4j7nmog_esryqw.mp4",
        volume: 0
      },
      start: 0,
      length: totalDuration,
      fit: "cover"
    };

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
            { clips: clips },
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
