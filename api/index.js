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
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });
  if (!res.ok) throw new Error(`Failed to fetch profile (${res.status})`);
  return await res.text();
}

function extractSkillsAndStats(html) {
  const $ = cheerio.load(html);
  const skills = {};
  const stats = { stars: 0, badges: 0, certificates: 0 };
  
  $('text').each((_, el) => {
    const text = $(el).text().toLowerCase();
    if (text.includes('star')) {
      const match = text.match(/(\d+)/);
      if (match) stats.stars = parseInt(match[1]);
    }
  });
  
  return { skills, stats };
}

function parseBadgesAndCertificates(html) {
  const $ = cheerio.load(html);
  const badges = [];
  const certificates = [];
  const skills = new Set();

  $("img").each((_, el) => {
    const alt = $(el).attr("alt") || "";
    const src = $(el).attr("src") || "";
    const title = $(el).attr("title") || "";
    
    if (/badge/i.test(alt) || /badge/i.test(src)) {
      const badgeTitle = title || alt.trim() || "Badge";
      
      let stars = 0;
      const starMatch = badgeTitle.match(/(\d+)\s*star/i);
      if (starMatch) stars = parseInt(starMatch[1]);
      
      badges.push({ 
        title: badgeTitle, 
        image: src,
        stars: stars
      });
      
      const skillMatch = badgeTitle.match(/^(.*?)\s*(?:\d+\s*star|badge)/i);
      if (skillMatch) skills.add(skillMatch[1].trim());
    }
  });

  $("a, div, span").each((_, el) => {
    const text = $(el).text() || "";
    const href = $(el).attr("href") || "";
    const classList = $(el).attr("class") || "";
    
    if (/certificate/i.test(text) || /certificate/i.test(href) || /certificate/i.test(classList)) {
      const certTitle = text.trim();
      if (certTitle && certTitle.length > 3 && certTitle.length < 100) {
        certificates.push({ 
          title: certTitle, 
          url: href,
          verified: true,
          type: certTitle.match(/\((.*?)\)/)?.[1] || 'SKILL'
        });
      }
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

  return { 
    badges: uniq(badges, "title"), 
    certificates: uniq(certificates, "title"),
    skills: Array.from(skills)
  };
}

function buildSvg(username, parsed) {
  const badges = parsed.badges || [];
  const certificates = parsed.certificates || [];
  const skills = parsed.skills || [];
  const width = 900;
  const padding = 40;
  
  const headerHeight = 100;
  let currentY = headerHeight + padding;
  
  const badgesPerRow = 5;
  const badgeSize = 120;
  const badgeGap = 25;
  const badgeRows = Math.ceil(badges.length / badgesPerRow);
  const badgesSectionHeight = badges.length > 0 ? (badgeRows * (badgeSize + badgeGap + 35) + 100) : 0;
  
  const certCardWidth = 200;
  const certCardHeight = 140;
  const certGap = 20;
  const certsPerRow = 4;
  const certRows = Math.ceil(certificates.length / certsPerRow);
  const certsSectionHeight = certificates.length > 0 ? (certRows * (certCardHeight + certGap) + 100) : 0;
  
  const totalHeight = headerHeight + badgesSectionHeight + certsSectionHeight + padding * 2 + 20;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>`;
  svg += `\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${totalHeight}">`;
  svg += `\n  <defs>`;
  svg += `\n    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">`;
  svg += `\n      <stop offset="0%" style="stop-color:#0A0E27;stop-opacity:1"/>`;
  svg += `\n      <stop offset="100%" style="stop-color:#1A1F3A;stop-opacity:1"/>`;
  svg += `\n    </linearGradient>`;
  svg += `\n    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">`;
  svg += `\n      <stop offset="0%" style="stop-color:#39B54A;stop-opacity:1"/>`;
  svg += `\n      <stop offset="100%" style="stop-color:#2ECC71;stop-opacity:1"/>`;
  svg += `\n    </linearGradient>`;
  svg += `\n    <filter id="glow">`;
  svg += `\n      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>`;
  svg += `\n      <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>`;
  svg += `\n    </filter>`;
  svg += `\n    <filter id="shadow">`;
  svg += `\n      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.3"/>`;
  svg += `\n    </filter>`;
  svg += `\n    <clipPath id="hexClip"><path d="M 60 5 L 112 35 L 112 95 L 60 125 L 8 95 L 8 35 Z"/></clipPath>`;
  svg += `\n  </defs>`;
  
  svg += `\n  <style>`;
  svg += `\n    .bg{fill:url(#bgGrad)}`;
  svg += `\n    .header-bar{fill:url(#headerGrad);filter:url(#shadow)}`;
  svg += `\n    .main-title{font:700 32px -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;fill:#FFFFFF;letter-spacing:-0.5px}`;
  svg += `\n    .username{font:600 18px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#FFFFFF;opacity:0.9}`;
  svg += `\n    .stats-text{font:600 14px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#FFFFFF;opacity:0.85}`;
  svg += `\n    .stats-num{font:700 20px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#39B54A}`;
  svg += `\n    .section-title{font:700 24px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#FFFFFF}`;
  svg += `\n    .section-count{font:600 16px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#8B92A7}`;
  svg += `\n    .badge-name{font:600 11px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#FFFFFF;text-anchor:middle}`;
  svg += `\n    .badge-stars{font:700 10px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#FFD700;text-anchor:middle}`;
  svg += `\n    .hex-gold{fill:#FDB714}`;
  svg += `\n    .hex-silver{fill:#C0C0D0}`;
  svg += `\n    .hex-bronze{fill:#E89B6E}`;
  svg += `\n    .hex-blue{fill:#5B9BD5}`;
  svg += `\n    .hex-green{fill:#70AD47}`;
  svg += `\n    .hex-purple{fill:#9B7EBD}`;
  svg += `\n    .cert-green{fill:#39B54A}`;
  svg += `\n    .cert-blue{fill:#2E5CB8}`;
  svg += `\n    .cert-purple{fill:#7952B3}`;
  svg += `\n    .cert-orange{fill:#FF6B35}`;
  svg += `\n    .cert-title{font:600 13px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#FFFFFF}`;
  svg += `\n    .cert-type{font:600 10px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.5px}`;
  svg += `\n    .cert-verified{font:500 11px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:rgba(255,255,255,0.85)}`;
  svg += `\n    .fold{fill:rgba(255,255,255,0.12)}`;
  svg += `\n    .divider{stroke:#2D3B54;stroke-width:1;opacity:0.5}`;
  svg += `\n  </style>`;
  
  svg += `\n  <rect width="100%" height="100%" class="bg"/>`;
  
  svg += `\n  <rect y="0" width="100%" height="6" class="header-bar"/>`;
  
  svg += `\n  <text x="${padding}" y="48" class="main-title">HackerRank Achievements</text>`;
  svg += `\n  <text x="${padding}" y="75" class="username">@${escapeHtml(username)}</text>`;
  
  const statX = width - padding - 320;
  svg += `\n  <g transform="translate(${statX}, 35)">`;
  svg += `\n    <text x="0" y="0" class="stats-text">Total Badges</text>`;
  svg += `\n    <text x="0" y="22" class="stats-num">${badges.length}</text>`;
  svg += `\n  </g>`;
  svg += `\n  <g transform="translate(${statX + 120}, 35)">`;
  svg += `\n    <text x="0" y="0" class="stats-text">Certificates</text>`;
  svg += `\n    <text x="0" y="22" class="stats-num">${certificates.length}</text>`;
  svg += `\n  </g>`;
  svg += `\n  <g transform="translate(${statX + 240}, 35)">`;
  svg += `\n    <text x="0" y="0" class="stats-text">Skills</text>`;
  svg += `\n    <text x="0" y="22" class="stats-num">${skills.length > 0 ? skills.length : badges.length}</text>`;
  svg += `\n  </g>`;
  
  if (badges.length > 0) {
    svg += `\n  <line x1="${padding}" y1="${currentY - 20}" x2="${width - padding}" y2="${currentY - 20}" class="divider"/>`;
    
    svg += `\n  <text x="${padding}" y="${currentY + 10}" class="section-title">🏆 Badges</text>`;
    svg += `\n  <text x="${padding + 130}" y="${currentY + 10}" class="section-count">${badges.length} earned</text>`;
    currentY += 50;
    
    badges.forEach((b, i) => {
      const col = i % badgesPerRow;
      const row = Math.floor(i / badgesPerRow);
      const x = padding + col * (badgeSize + badgeGap) + 60;
      const y = currentY + row * (badgeSize + badgeGap + 35);
      
      let hexClass = 'hex-gold';
      const title = b.title.toLowerCase();
      if (title.includes('sql') || title.includes('database')) hexClass = 'hex-purple';
      else if (title.includes('python')) hexClass = 'hex-blue';
      else if (title.includes('java') && !title.includes('javascript')) hexClass = 'hex-orange';
      else if (title.includes('javascript') || title.includes('react')) hexClass = 'hex-green';
      else if (title.includes('c++') || title.includes('cpp')) hexClass = 'hex-silver';
      else if (title.includes('problem solving')) hexClass = 'hex-gold';
      else if (b.stars >= 4) hexClass = 'hex-gold';
      else if (b.stars >= 3) hexClass = 'hex-silver';
      else if (b.stars >= 1) hexClass = 'hex-bronze';
      
      svg += `\n  <g transform="translate(${x - 60}, ${y})">`;
      svg += `\n    <path d="M 60 5 L 112 35 L 112 95 L 60 125 L 8 95 L 8 35 Z" class="${hexClass}" filter="url(#shadow)"/>`;
      
      if (b.image) {
        svg += `\n    <image x="0" y="0" width="120" height="130" href="${escapeHtml(b.image)}" clip-path="url(#hexClip)" preserveAspectRatio="xMidYMid slice"/>`;
      }
      
      if (b.stars > 0) {
        svg += `\n    <text x="60" y="145" class="badge-stars">${'⭐'.repeat(Math.min(b.stars, 5))}</text>`;
      }
      svg += `\n  </g>`;
      
      const nameParts = b.title.replace(/\d+\s*star/gi, '').trim().split(' ');
      const line1 = nameParts.slice(0, 2).join(' ');
      const line2 = nameParts.slice(2).join(' ');
      
      if (line1) svg += `\n  <text x="${x}" y="${y + 148}" class="badge-name">${escapeHtml(line1.substring(0, 15))}</text>`;
      if (line2) svg += `\n  <text x="${x}" y="${y + 160}" class="badge-name">${escapeHtml(line2.substring(0, 15))}</text>`;
    });
    
    currentY += badgeRows * (badgeSize + badgeGap + 35) + 40;
  }
  
  if (certificates.length > 0) {
    svg += `\n  <line x1="${padding}" y1="${currentY - 20}" x2="${width - padding}" y2="${currentY - 20}" class="divider"/>`;
    
    svg += `\n  <text x="${padding}" y="${currentY + 10}" class="section-title">📜 Certifications</text>`;
    svg += `\n  <text x="${padding + 210}" y="${currentY + 10}" class="section-count">${certificates.length} verified</text>`;
    currentY += 50;
    
    certificates.slice(0, 16).forEach((c, i) => {
      const col = i % certsPerRow;
      const row = Math.floor(i / certsPerRow);
      const x = padding + col * (certCardWidth + certGap);
      const y = currentY + row * (certCardHeight + certGap);
      
      let cardClass = 'cert-green';
      const title = c.title.toLowerCase();
      if (title.includes('frontend') || title.includes('react') || title.includes('angular')) cardClass = 'cert-blue';
      else if (title.includes('software') || title.includes('engineer')) cardClass = 'cert-purple';
      else if (title.includes('sql') || title.includes('database')) cardClass = 'cert-purple';
      else if (title.includes('java') && !title.includes('javascript')) cardClass = 'cert-orange';
      
      svg += `\n  <g filter="url(#shadow)">`;
      svg += `\n    <rect x="${x}" y="${y}" width="${certCardWidth}" height="${certCardHeight}" rx="8" class="${cardClass}"/>`;
      svg += `\n    <path d="M ${x + certCardWidth - 25} ${y} L ${x + certCardWidth} ${y} L ${x + certCardWidth} ${y + 25} Z" class="fold"/>`;
      
      svg += `\n    <circle cx="${x + 25}" cy="${y + 28}" r="16" fill="rgba(255,255,255,0.15)"/>`;
      svg += `\n    <path d="M ${x + 20} ${y + 22} L ${x + 20} ${y + 34} M ${x + 30} ${y + 22} L ${x + 30} ${y + 34}" stroke="white" stroke-width="2" stroke-linecap="round"/>`;
      svg += `\n    <circle cx="${x + 25}" cy="${y + 20}" r="3" fill="white"/>`;
      svg += `\n    <rect x="${x + 17}" y="${y + 36}" width="16" height="2" rx="1" fill="white"/>`;
      
      const certLines = c.title.match(/.{1,22}/g) || [c.title];
      certLines.slice(0, 2).forEach((line, idx) => {
        svg += `\n    <text x="${x + 15}" y="${y + 70 + idx * 18}" class="cert-title">${escapeHtml(line.trim())}</text>`;
      });
      
      svg += `\n    <text x="${x + 15}" y="${y + 112}" class="cert-type">${escapeHtml(c.type)}</text>`;
      
      svg += `\n    <circle cx="${x + 15}" cy="${y + 127}" r="3" fill="rgba(255,255,255,0.9)"/>`;
      svg += `\n    <path d="M ${x + 13} ${y + 127} L ${x + 14.5} ${y + 128.5} L ${x + 17} ${y + 125.5}" stroke="${cardClass === 'cert-green' ? '#0A5C2E' : cardClass === 'cert-blue' ? '#1A3A6E' : '#4A2870'}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`;
      svg += `\n    <text x="${x + 23}" y="${y + 130}" class="cert-verified">Verified</text>`;
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
      return res.send("Missing username parameter");
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
    console.error("Error:", err.message);
    const fallback = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="200"><defs><linearGradient id="errBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#1A1F3A"/><stop offset="100%" style="stop-color:#0A0E27"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#errBg)"/><rect y="0" width="100%" height="6" fill="#E74C3C"/><text x="30" y="70" style="font:700 28px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#FFFFFF">⚠️ Unable to Load Profile</text><text x="30" y="110" style="font:600 16px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#E74C3C">${escapeHtml(err.message)}</text><text x="30" y="145" style="font:500 14px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#8B92A7">Please verify the username and try again</text></svg>`;
    res.setHeader("Content-Type", "image/svg+xml");
    return res.status(200).send(fallback);
  }
}