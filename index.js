const express = require("express");
const https = require("https");

const app = express();

const symbols = ["AAPL","MSFT","GOOGL","AMZN","META"];

const UPDATE_URL = "https://dpwl.atwebpages.com/share/api_update.php?secret=update_secret";
const INDEX_URL  = "https://dpwl.atwebpages.com/share/update_index.php?key=my_secure_key_123";

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json"
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error("Invalid JSON"));
          }
        });
      }
    ).on("error", (err) => reject(err));
  });
}

function hitUrl(url) {
  return new Promise((resolve) => {
    https.get(url, () => resolve(true)).on("error", () => resolve(false));
  });
}

async function fetchFromYahooChart(symbol) {
  // v8 chart API (reliable)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1m`;
  const json = await getJson(url);

  const result = json.chart?.result?.[0];
  if (!result) throw new Error("No chart result");

  const meta = result.meta || {};
  const quote = result.indicators?.quote?.[0] || {};

  const price = meta.regularMarketPrice ?? (quote.close?.slice(-1)[0]);
  const open  = meta.regularMarketOpen ?? (quote.open?.[0]);
  const high  = meta.regularMarketDayHigh ?? Math.max(...(quote.high || [price]));
  const low   = meta.regularMarketDayLow  ?? Math.min(...(quote.low  || [price]));

  if (!price) throw new Error("No price");

  return { price, open: open || price, high: high || price, low: low || price };
}

app.get("/", (req, res) => {
  res.send("Worker running");
});

app.get("/run", async (req, res) => {
  const results = [];

  for (const symbol of symbols) {
    try {
      const { price, open, high, low } = await fetchFromYahooChart(symbol);

      const url =
        `${UPDATE_URL}&symbol=${symbol}&price=${price}&open=${open}&high=${high}&low=${low}`;

      await hitUrl(url);

      results.push({ symbol, success: true, source: "yahoo-chart", price });
    } catch (e) {
      results.push({ symbol, success: false, error: String(e.message || e) });
    }
  }

  await hitUrl(INDEX_URL);

  res.json({
    success: true,
    message: "Worker completed",
    results,
    time: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server started"));
