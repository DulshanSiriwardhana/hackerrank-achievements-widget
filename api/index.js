const fetch = require("node-fetch");
const cheerio = require("cheerio");

const cache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 10;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function fetchProfileHtml(username) {
  const url = `https://www.hackerrank.com/${encodeURIComponent(username)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; hr-widget/1.0)"
    }
  });
  if (!res.ok) throw new Error(`Failed to fetch profile (${res.status})`);
  return await res.text();
}

function parseBadgesAndCertificates(html) {
  const $ = cheerio.load(html);
  const badges = [];
  const certificates = [];

  $("img").each((_, el) => {
    const alt = $(el).attr("alt") || "";
    const src = $(el).attr("src") || "";
    if (/badge/i.test(alt) || /badge/i.test(src)) {
      badges.push({ title: alt.trim() || "Badge", image: src });
    }
  });

  $("a").each((_, el) => {
    const text = $(el).text() || "";
    const href = $(el).attr("href") || "";
    if (/certificate/i.test(text) || /certificates?/i.test(href)) {
      certificates.push({ title: text.trim() || "Certificate", url: href });
    }
  });

  const uniq = (arr, key) => {
    const seen = new Set();
    return arr.filter((x) => {
      const k = (x[key] || "").toLowerCase();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };

  return { badges: uniq(badges, "title"), certificates: uniq(certificates, "title") };
}

function buildSvg(username, parsed) {
  const badges = parsed.badges || [];
  const certificates = parsed.certificates || [];
  const width = 720;
  const padding = 20;
  const lineHeight = 22;
  const titleHeight = 36;
  const badgeRows = Math.max(1, Math.ceil(badges.length / 6));
  const badgeAreaHeight = badgeRows * 40;
  const certAreaHeight = Math.max(40, certificates.length * lineHeight);
  const height = padding * 2 + titleHeight + badgeAreaHeight + 10 + certAreaHeight;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>`;
  svg += `\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`;
  svg += `\n  <style>text{font-family:system-ui,Roboto;fill:#222;} .title{font-weight:700;font-size:18px;} .muted{fill:#666;font-size:13px;}</style>`;
  svg += `\n  <rect rx="8" width="100%" height="100%" fill="#fff" stroke="#e6e6e6"/>`;
  svg += `\n  <text x="${padding}" y="${padding + 18}" class="title">HackerRank — ${escapeHtml(username)}</text>`;

  let by = padding + titleHeight;
  const badgeSize = 32;
  const gap = 10;
  badges.forEach((b, i) => {
    const col = i % 6;
    const row = Math.floor(i / 6);
    const x = padding + col * (badgeSize + gap);
    const y = by + row * (badgeSize + gap);
    if (b.image) {
      svg += `\n  <image x="${x}" y="${y}" width="${badgeSize}" height="${badgeSize}" href="${escapeHtml(
        b.image
      )}" />`;
    }
  });

  const certY = by + badgeAreaHeight + 20;
  svg += `\n  <text x="${padding}" y="${certY - 6}" class="muted">Certificates</text>`;
  if (certificates.length === 0) {
    svg += `\n  <text x="${padding}" y="${certY + 16}" class="muted">No publicly listed certificates found</text>`;
  } else {
    certificates.slice(0, 10).forEach((c, i) => {
      const y = certY + i * lineHeight + 16;
      svg += `\n  <text x="${padding}" y="${y}">${escapeHtml(c.title)}</text>`;
    });
  }

  svg += `\n</svg>`;
  return svg;
}

export default async function handler(req, res) {
  try {
    const username = req.query.username || "";
    if (!username) {
      res.status(400);
      res.setHeader("Content-Type", "text/plain");
      return res.send("Missing username parameter. Use ?username=YOUR_USERNAME");
    }

    const cacheKey = username.toLowerCase();
    const now = Date.now();
    const cached = cache.get(cacheKey);
    if (cached && now - cached.ts < CACHE_TTL_MS) {
      res.setHeader("Content-Type", "image/svg+xml");
      res.setHeader("Cache-Control", "public, max-age=600");
      return res.status(200).send(cached.svg);
    }

    const html = await fetchProfileHtml(username);
    const parsed = parseBadgesAndCertificates(html);
    const svg = buildSvg(username, parsed);
    cache.set(cacheKey, { ts: now, svg });

    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=600");
    return res.status(200).send(svg);
  } catch (err) {
    console.error("hr-widget error:", err.message);
    const fallback = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="480" height="80"><rect rx="8" width="100%" height="100%" fill="#fff" stroke="#eee"/><text x="16" y="28" style="font-family:system-ui,Roboto;fill:#333;font-weight:700">HackerRank — widget</text><text x="16" y="52" style="font-family:system-ui,Roboto;fill:#666;font-size:12px">Error: ${escapeHtml(
      err.message
    )}</text></svg>`;
    res.setHeader("Content-Type", "image/svg+xml");
    return res.status(200).send(fallback);
  }
}