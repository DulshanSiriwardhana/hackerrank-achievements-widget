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
  const width = 800;
  const padding = 24;
  const sectionGap = 30;
  
  // Header
  const headerHeight = 60;
  
  // Badges section
  const badgesPerRow = 5;
  const badgeSize = 50;
  const badgeGap = 20;
  const badgeRows = Math.ceil(badges.length / badgesPerRow);
  const badgesHeight = badges.length > 0 ? (badgeRows * (badgeSize + badgeGap) + 50) : 80;
  
  // Certificates section
  const certLineHeight = 32;
  const certsHeight = certificates.length > 0 
    ? (certificates.length * certLineHeight + 50) 
    : 80;
  
  const totalHeight = headerHeight + badgesHeight + certsHeight + padding * 2;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>`;
  svg += `\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}">`;
  svg += `\n  <defs>`;
  svg += `\n    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">`;
  svg += `\n      <stop offset="0%" style="stop-color:#00EA64;stop-opacity:1" />`;
  svg += `\n      <stop offset="100%" style="stop-color:#00C853;stop-opacity:1" />`;
  svg += `\n    </linearGradient>`;
  svg += `\n    <filter id="shadow">`;
  svg += `\n      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.1"/>`;
  svg += `\n    </filter>`;
  svg += `\n  </defs>`;
  
  svg += `\n  <style>`;
  svg += `\n    .bg { fill: #FAFAFA; }`;
  svg += `\n    .card { fill: white; filter: url(#shadow); }`;
  svg += `\n    .header-bg { fill: url(#headerGrad); }`;
  svg += `\n    .title { font-family: 'Segoe UI', Arial, sans-serif; font-size: 24px; font-weight: 700; fill: white; }`;
  svg += `\n    .subtitle { font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px; fill: rgba(255,255,255,0.9); }`;
  svg += `\n    .section-title { font-family: 'Segoe UI', Arial, sans-serif; font-size: 16px; font-weight: 600; fill: #2C3E50; }`;
  svg += `\n    .cert-text { font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px; fill: #34495E; }`;
  svg += `\n    .cert-icon { fill: #00EA64; }`;
  svg += `\n    .no-data { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; fill: #95A5A6; font-style: italic; }`;
  svg += `\n    .badge-bg { fill: #F8F9FA; stroke: #E9ECEF; stroke-width: 2; }`;
  svg += `\n  </style>`;
  
  // Background
  svg += `\n  <rect width="100%" height="100%" class="bg"/>`;
  svg += `\n  <rect width="100%" height="100%" rx="12" class="card"/>`;
  
  // Header with gradient
  svg += `\n  <rect width="100%" height="${headerHeight}" rx="12" class="header-bg"/>`;
  svg += `\n  <rect y="${headerHeight - 12}" width="100%" height="12" class="header-bg"/>`;
  
  svg += `\n  <text x="${padding}" y="32" class="title">HackerRank Profile</text>`;
  svg += `\n  <text x="${padding}" y="50" class="subtitle">@${escapeHtml(username)}</text>`;
  
  let currentY = headerHeight + padding + 10;
  
  // Badges Section
  svg += `\n  <text x="${padding}" y="${currentY}" class="section-title">🏆 Badges ${badges.length > 0 ? `(${badges.length})` : ''}</text>`;
  currentY += 30;
  
  if (badges.length === 0) {
    svg += `\n  <text x="${padding}" y="${currentY}" class="no-data">No badges found</text>`;
    currentY += 40;
  } else {
    badges.forEach((b, i) => {
      const col = i % badgesPerRow;
      const row = Math.floor(i / badgesPerRow);
      const x = padding + col * (badgeSize + badgeGap + 70);
      const y = currentY + row * (badgeSize + badgeGap);
      
      // Badge background
      svg += `\n  <rect x="${x}" y="${y}" width="${badgeSize}" height="${badgeSize}" rx="8" class="badge-bg"/>`;
      
      if (b.image) {
        svg += `\n  <image x="${x + 5}" y="${y + 5}" width="${badgeSize - 10}" height="${badgeSize - 10}" href="${escapeHtml(b.image)}" />`;
      }
    });
    currentY += badgeRows * (badgeSize + badgeGap) + 10;
  }
  
  currentY += sectionGap;
  
  // Certificates Section
  svg += `\n  <text x="${padding}" y="${currentY}" class="section-title">📜 Certificates ${certificates.length > 0 ? `(${certificates.length})` : ''}</text>`;
  currentY += 30;
  
  if (certificates.length === 0) {
    svg += `\n  <text x="${padding}" y="${currentY}" class="no-data">No certificates found</text>`;
  } else {
    certificates.slice(0, 15).forEach((c, i) => {
      const y = currentY + i * certLineHeight;
      
      // Certificate icon (checkmark circle)
      svg += `\n  <circle cx="${padding + 8}" cy="${y - 5}" r="7" class="cert-icon"/>`;
      svg += `\n  <path d="M ${padding + 5} ${y - 5} L ${padding + 7} ${y - 3} L ${padding + 11} ${y - 8}" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
      
      // Certificate text
      const certText = c.title.length > 70 ? c.title.substring(0, 70) + '...' : c.title;
      svg += `\n  <text x="${padding + 24}" y="${y}" class="cert-text">${escapeHtml(certText)}</text>`;
    });
    
    if (certificates.length > 15) {
      currentY += certificates.slice(0, 15).length * certLineHeight + 10;
      svg += `\n  <text x="${padding}" y="${currentY}" class="no-data">+ ${certificates.length - 15} more certificates</text>`;
    }
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
    const fallback = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="600" height="120"><defs><linearGradient id="errorGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" style="stop-color:#E74C3C;stop-opacity:1"/><stop offset="100%" style="stop-color:#C0392B;stop-opacity:1"/></linearGradient></defs><rect width="100%" height="100%" fill="#FAFAFA"/><rect width="100%" height="100%" rx="12" fill="white" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"/><rect width="100%" height="50" rx="12" fill="url(#errorGrad)"/><rect y="38" width="100%" height="12" fill="url(#errorGrad)"/><text x="20" y="32" style="font-family:'Segoe UI',Arial,sans-serif;font-size:20px;font-weight:700;fill:white">⚠️ Error Loading Profile</text><text x="20" y="85" style="font-family:'Segoe UI',Arial,sans-serif;font-size:14px;fill:#E74C3C">${escapeHtml(err.message)}</text><text x="20" y="105" style="font-family:'Segoe UI',Arial,sans-serif;font-size:12px;fill:#95A5A6">Please check the username and try again</text></svg>`;
    res.setHeader("Content-Type", "image/svg+xml");
    return res.status(200).send(fallback);
  }
}