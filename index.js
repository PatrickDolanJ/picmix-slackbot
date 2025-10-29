const { App } = require("@slack/bolt");
const axios = require("axios");
const cheerio = require("cheerio");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: false,
});

// Your existing image extraction function (fixed version)
async function extractPicmixImage(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const body = response.data;
    const $ = cheerio.load(body);

    let imageUrl = null;
    let altText = "Picmix Image";
    const selectors = ["#pPic img"];

    for (const selector of selectors) {
      const img = $(selector).first();
      console.log("Checking selector:", selector);
      if (img.length) {
        imageUrl = img.attr("src");
        altText = img.attr("alt") || altText;
        break;
      }
    }

    console.log("Found image url: " + imageUrl);
    return { imageUrl, altText };
  } catch (error) {
    console.error("Error extracting image:", error);
    return null;
  }
}

// Handle app_mention events (optional, for testing)
app.event("app_mention", async ({ event, say }) => {
  await say(`I'm alive! 👋`);
});

// Handle message events
app.event("message", async ({ event, client }) => {
  try {
    console.log("🔍 Received message event:", event.text);

    // Skip bot messages and message subtypes
    if (event.subtype || event.bot_id) {
      console.log("⏩ Skipping bot message or subtype");
      return;
    }

    if (!event.text) {
      console.log("⏩ No text in message");
      return;
    }

    console.log("📝 Message text:", event.text);

    const picmixRegex = /https?:\/\/(?:www\.)?picmix\.com\/[^\s]+/gi;
    const matches = event.text.match(picmixRegex);

    console.log("🔎 Found matches:", matches);

    if (!matches || matches.length === 0) return;

    for (const url of matches) {
      console.log(`\n🖼️ PROCESSING: ${url}`);

      const result = await extractPicmixImage(url);

      // Handle case where extractPicmixImage returns null
      if (!result) {
        console.log("❌ No result from image extraction");
        await client.chat.postMessage({
          channel: event.channel,
          thread_ts: event.ts,
          text: `❌ Couldn't extract an image from: ${url}`,
        });
        continue;
      }

      const { imageUrl, altText } = result;
      console.log("🎯 Image URL:", imageUrl);

      if (imageUrl) {
        console.log("🖼️ Posting image in thread...");

        // Fixed: Use event.channel instead of message.channel
        // and added thread_ts to reply in thread
        await client.chat.postMessage({
          channel: event.channel,
          text: `Image from Picmix: ${altText}`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*${altText}*`,
              },
            },
            {
              type: "image",
              image_url: imageUrl,
              alt_text: altText,
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `*Source:* ${url}`,
                },
              ],
            },
          ],
        });
      } else {
        console.log("❌ No image found");
        await client.chat.postMessage({
          channel: event.channel,
          thread_ts: event.ts,
          text: `❌ Couldn't extract an image from: ${url}`,
        });
      }
    }
  } catch (error) {
    console.error("💥 Error processing message:", error);
  }
});

// Start the Express server
(async () => {
  const port = process.env.PORT || 3000;
  await app.start(port);
  console.log(`⚡️ Slack Picmix bot is running on port ${port}`);

  // Get the actual Replit URL
  const replUrl = process.env.REPLIT_DB_URL
    ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
    : `http://localhost:${port}`;

  console.log(
    `📝 Set your Event Subscriptions Request URL to: ${replUrl}/slack/events`,
  );
})();
