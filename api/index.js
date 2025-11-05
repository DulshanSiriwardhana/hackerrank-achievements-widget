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
  const padding = 30;
  
  // Header
  const headerHeight = 70;
  let currentY = headerHeight + padding;
  
  // Badges section (only if badges exist)
  const badgesPerRow = 4;
  const badgeSize = 100;
  const badgeGap = 30;
  const badgeRows = Math.ceil(badges.length / badgesPerRow);
  const badgesSectionHeight = badges.length > 0 ? (badgeRows * (badgeSize + badgeGap) + 80) : 0;
  
  // Certificates section (only if certificates exist)
  const certCardWidth = 170;
  const certCardHeight = 120;
  const certGap = 20;
  const certsPerRow = 4;
  const certRows = Math.ceil(certificates.length / certsPerRow);
  const certsSectionHeight = certificates.length > 0 ? (certRows * (certCardHeight + certGap) + 80) : 0;
  
  const totalHeight = headerHeight + badgesSectionHeight + certsSectionHeight + padding * 2;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>`;
  svg += `\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}">`;
  svg += `\n  <defs>`;
  svg += `\n    <clipPath id="hexClip">`;
  svg += `\n      <path d="M 50 0 L 86.6 25 L 86.6 75 L 50 100 L 13.4 75 L 13.4 25 Z"/>`;
  svg += `\n    </clipPath>`;
  svg += `\n  </defs>`;
  
  svg += `\n  <style>`;
  svg += `\n    .bg { fill: #1C1C1C; }`;
  svg += `\n    .title { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 26px; font-weight: 700; fill: #FFFFFF; }`;
  svg += `\n    .username { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 16px; fill: #A0A0A0; }`;
  svg += `\n    .section-title { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 20px; font-weight: 600; fill: #FFFFFF; }`;
  svg += `\n    .section-icon { fill: #FFFFFF; }`;
  svg += `\n    .hex { fill: #FDB714; }`;
  svg += `\n    .hex-silver { fill: #C0C0C0; }`;
  svg += `\n    .hex-bronze { fill: #CD7F32; }`;
  svg += `\n    .hex-blue { fill: #4A90E2; }`;
  svg += `\n    .cert-card { fill: #39B54A; rx: 8; }`;
  svg += `\n    .cert-card-blue { fill: #2E3A87; }`;
  svg += `\n    .cert-card-purple { fill: #6441A5; }`;
  svg += `\n    .cert-text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; font-weight: 600; fill: #FFFFFF; }`;
  svg += `\n    .cert-label { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; fill: rgba(255,255,255,0.8); }`;
  svg += `\n    .cert-icon { fill: #FFFFFF; }`;
  svg += `\n    .fold { fill: rgba(255,255,255,0.15); }`;
  svg += `\n  </style>`;
  
  // Background
  svg += `\n  <rect width="100%" height="100%" class="bg"/>`;
  
  // Header
  svg += `\n  <text x="${padding}" y="35" class="title">HackerRank Profile</text>`;
  svg += `\n  <text x="${padding}" y="58" class="username">@${escapeHtml(username)}</text>`;
  
  // Badges Section (only if badges exist)
  if (badges.length > 0) {
    svg += `\n  <g>`;
    svg += `\n    <path d="M ${padding} ${currentY - 5} L ${padding + 3} ${currentY - 9} L ${padding + 7} ${currentY - 7} L ${padding + 14} ${currentY - 14} L ${padding + 11} ${currentY - 3} L ${padding + 16} ${currentY} L ${padding + 8} ${currentY} Z" class="section-icon"/>`;
    svg += `\n    <text x="${padding + 25}" y="${currentY}" class="section-title">My Badges</text>`;
    svg += `\n  </g>`;
    currentY += 50;
    
    badges.forEach((b, i) => {
      const col = i % badgesPerRow;
      const row = Math.floor(i / badgesPerRow);
      const x = padding + col * (badgeSize + badgeGap);
      const y = currentY + row * (badgeSize + badgeGap);
      
      // Determine hexagon color based on badge name
      let hexClass = 'hex';
      const title = b.title.toLowerCase();
      if (title.includes('silver') || title.includes('cpp') || title.includes('c++') || title.includes('c language')) {
        hexClass = 'hex-silver';
      } else if (title.includes('bronze') || title.includes('days')) {
        hexClass = 'hex-bronze';
      } else if (title.includes('python')) {
        hexClass = 'hex-blue';
      }
      
      // Hexagon background
      svg += `\n  <g transform="translate(${x}, ${y})">`;
      svg += `\n    <path d="M 50 0 L 86.6 25 L 86.6 75 L 50 100 L 13.4 75 L 13.4 25 Z" class="${hexClass}"/>`;
      
      if (b.image) {
        svg += `\n    <image x="0" y="0" width="100" height="100" href="${escapeHtml(b.image)}" clip-path="url(#hexClip)" preserveAspectRatio="xMidYMid meet"/>`;
      }
      svg += `\n  </g>`;
    });
    
    currentY += badgeRows * (badgeSize + badgeGap) + 40;
  }
  
  // Certificates Section (only if certificates exist)
  if (certificates.length > 0) {
    svg += `\n  <g>`;
    svg += `\n    <rect x="${padding}" y="${currentY - 18}" width="3" height="18" rx="1.5" class="section-icon"/>`;
    svg += `\n    <rect x="${padding + 5}" y="${currentY - 18}" width="3" height="18" rx="1.5" class="section-icon"/>`;
    svg += `\n    <rect x="${padding + 10}" y="${currentY - 18}" width="3" height="18" rx="1.5" class="section-icon"/>`;
    svg += `\n    <text x="${padding + 25}" y="${currentY}" class="section-title">My Certifications</text>`;
    svg += `\n  </g>`;
    currentY += 50;
    
    certificates.slice(0, 12).forEach((c, i) => {
      const col = i % certsPerRow;
      const row = Math.floor(i / certsPerRow);
      const x = padding + col * (certCardWidth + certGap);
      const y = currentY + row * (certCardHeight + certGap);
      
      // Determine card color
      let cardClass = 'cert-card';
      const title = c.title.toLowerCase();
      if (title.includes('frontend') || title.includes('react') || title.includes('angular') || title.includes('software')) {
        cardClass = 'cert-card-blue';
      } else if (title.includes('javascript') || title.includes('problem solving')) {
        cardClass = 'cert-card';
      }
      
      // Certificate card with fold effect
      svg += `\n  <g>`;
      svg += `\n    <rect x="${x}" y="${y}" width="${certCardWidth}" height="${certCardHeight}" class="${cardClass}"/>`;
      svg += `\n    <path d="M ${x + certCardWidth - 20} ${y} L ${x + certCardWidth} ${y} L ${x + certCardWidth} ${y + 20} Z" class="fold"/>`;
      
      // Certificate icon
      svg += `\n    <circle cx="${x + 20}" cy="${y + 25}" r="12" fill="rgba(255,255,255,0.2)"/>`;
      svg += `\n    <path d="M ${x + 17} ${y + 20} L ${x + 17} ${y + 30} M ${x + 23} ${y + 20} L ${x + 23} ${y + 30} M ${x + 14} ${y + 18} L ${x + 26} ${y + 18} M ${x + 14} ${y + 32} L ${x + 26} ${y + 32}" stroke="white" stroke-width="1.5" fill="none"/>`;
      
      // Certificate text
      const certText = c.title.length > 20 ? c.title.substring(0, 18) + '...' : c.title;
      svg += `\n    <text x="${x + 15}" y="${y + 65}" class="cert-text">${escapeHtml(certText)}</text>`;
      svg += `\n    <text x="${x + 15}" y="${y + 90}" class="cert-label">Verified</text>`;
      
      // Arrow/badge indicator
      svg += `\n    <path d="M ${x + certCardWidth - 30} ${y + certCardHeight - 20} L ${x + certCardWidth - 25} ${y + certCardHeight - 15} L ${x + certCardWidth - 20} ${y + certCardHeight - 20}" stroke="rgba(255,255,255,0.5)" stroke-width="2" fill="none" stroke-linecap="round"/>`;
      svg += `\n  </g>`;
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
    const fallback = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="600" height="150"><rect width="100%" height="100%" fill="#1C1C1C"/><text x="30" y="50" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:24px;font-weight:700;fill:#FFFFFF">⚠️ Error Loading Profile</text><text x="30" y="85" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;fill:#E74C3C">${escapeHtml(err.message)}</text><text x="30" y="110" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;fill:#A0A0A0">Please check the username and try again</text></svg>`;
    res.setHeader("Content-Type", "image/svg+xml");
    return res.status(200).send(fallback);
  }
}