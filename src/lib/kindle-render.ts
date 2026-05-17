import type { SteamData, SteamNowPlaying, SteamTopGame, LeagueData, MatchResult, ChampionStat, SpotifyPlayback } from '@/types'

const INK = '#1a1612'
const INK_MUTED = '#7a7268'
const PAPER = '#e8e3d8'
const PAPER_LIGHT = '#f1ede2'
const PAPER_DARK = '#d8d2c4'
const PAPER_DARKER = '#c4bdac'

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Relative URL so browsers resolve it against the current page host.
// Absolute URLs break in Docker/reverse-proxy where request.url reflects
// the internal address (localhost) rather than the LAN IP the client used.
function proxyImg(url: string): string {
  return `/api/image-proxy?url=${encodeURIComponent(url)}`
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function sectionHeader(label: string, meta: string): string {
  return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
  <span style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;font-weight:bold;letter-spacing:2.5px;color:${INK};white-space:nowrap;">${label}</span>
  <div style="flex:1;height:1px;background:${INK};"></div>
  <span style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:9px;letter-spacing:1.5px;color:${INK_MUTED};white-space:nowrap;">${meta}</span>
</div>`
}

function renderNowPlaying(game: SteamNowPlaying | null): string {
  const cardBase = `background:${PAPER_LIGHT};border:1px solid ${INK};border-radius:10px;box-sizing:border-box;padding:9px;height:70px;margin-bottom:10px;overflow:hidden;`

  if (!game) {
    return `<div style="${cardBase}display:flex;align-items:center;">
  <span style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;color:${INK_MUTED};letter-spacing:1.5px;">NOT PLAYING</span>
</div>`
  }

  return `<div style="${cardBase}">
  <table cellpadding="0" cellspacing="0" width="100%"><tr>
    <td style="width:52px;padding-right:12px;vertical-align:middle;">
      <div style="width:52px;height:52px;border-radius:6px;overflow:hidden;border:1px solid ${INK};">
        <img src="${proxyImg(game.headerImg)}" alt="${escapeHtml(game.name)}" width="52" height="52" style="display:block;width:52px;height:52px;" onerror="this.style.display='none'">
      </div>
    </td>
    <td style="vertical-align:middle;">
      <table cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:8px;font-weight:bold;letter-spacing:2.2px;color:${INK_MUTED};">NOW PLAYING</td>
          <td style="text-align:right;font-family:'Helvetica Neue',Arial,sans-serif;font-size:8px;font-weight:bold;letter-spacing:1.5px;color:${INK};">&#8226; LIVE</td>
        </tr>
        <tr>
          <td colspan="2" style="font-size:18px;font-weight:bold;font-family:Georgia,serif;letter-spacing:-0.3px;padding-top:3px;white-space:nowrap;overflow:hidden;">${escapeHtml(game.name)}</td>
        </tr>
      </table>
    </td>
  </tr></table>
</div>`
}

function renderGameCard(game: SteamTopGame): string {
  return `<div style="background:${PAPER_LIGHT};border:1px solid ${INK};border-radius:10px;box-sizing:border-box;padding:10px;height:86px;overflow:hidden;">
  <table cellpadding="0" cellspacing="0" width="100%" height="66">
    <tr>
      <td rowspan="2" style="width:66px;padding-right:10px;vertical-align:top;">
        <div style="width:66px;height:66px;border-radius:6px;overflow:hidden;border:1px solid ${INK};">
          <img src="${proxyImg(game.coverImg)}" alt="${escapeHtml(game.name)}" width="66" height="66" style="display:block;width:66px;height:66px;" onerror="this.style.display='none'">
        </div>
      </td>
      <td style="vertical-align:top;padding-top:2px;">
        <div style="font-size:12px;font-weight:bold;font-family:Georgia,serif;color:${INK};line-height:1.2;letter-spacing:-0.1px;overflow:hidden;">${escapeHtml(game.name)}</div>
      </td>
    </tr>
    <tr>
      <td style="vertical-align:bottom;padding-bottom:2px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:8px;letter-spacing:1.5px;color:${INK_MUTED};">PLAYED</td>
          <td style="text-align:right;font-size:18px;font-weight:bold;font-family:Georgia,serif;color:${INK};letter-spacing:-0.5px;">${game.hours}<span style="font-size:11px;font-weight:normal;">h</span></td>
        </tr></table>
      </td>
    </tr>
  </table>
</div>`
}

function renderTotalGamesCard(total: number): string {
  return `<div style="background:${INK};color:${PAPER};border:1px solid ${INK};border-radius:10px;box-sizing:border-box;padding:10px;height:86px;display:flex;align-items:center;gap:12px;overflow:hidden;">
  <div style="font-family:Georgia,serif;font-size:48px;font-weight:bold;line-height:1;letter-spacing:-2px;">${total}</div>
  <div style="flex:1;border-left:1px solid ${PAPER};padding-left:12px;">
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:9px;letter-spacing:2px;opacity:0.75;margin-bottom:2px;">TOTAL</div>
    <div style="font-family:Georgia,serif;font-size:13px;font-weight:bold;line-height:1.1;letter-spacing:-0.2px;">Games<br>Owned</div>
  </div>
</div>`
}

function renderSteam(data: SteamData | null): string {
  if (!data) {
    return `<div style="margin-bottom:10px;">
  ${sectionHeader('STEAM', 'unavailable')}
  <p style="font-size:12px;color:${INK_MUTED};">Steam data unavailable</p>
</div>`
  }

  const meta = `${escapeHtml(data.personaname)} &middot; ${data.isOnline ? 'online' : 'offline'}`

  const cells: string[] = [
    ...data.topGames.slice(0, 3).map((g) => renderGameCard(g)),
    renderTotalGamesCard(data.totalGames),
  ]

  const rows: string[] = []
  for (let i = 0; i < cells.length; i += 2) {
    rows.push(`<tr>
  <td width="50%" style="padding-right:4px;padding-bottom:8px;vertical-align:top;">${cells[i]}</td>
  <td width="50%" style="padding-left:4px;padding-bottom:8px;vertical-align:top;">${cells[i + 1] ?? '<div></div>'}</td>
</tr>`)
  }

  return `<div style="margin-bottom:10px;">
  ${sectionHeader('STEAM', meta)}
  ${renderNowPlaying(data.nowPlaying)}
  <table width="100%" cellpadding="0" cellspacing="0">${rows.join('')}</table>
</div>`
}

function renderProfileBanner(profile: LeagueData['profile']): string {
  return `<div style="background:${PAPER_LIGHT};border:1px solid ${INK};border-radius:10px;box-sizing:border-box;display:flex;align-items:center;padding:12px;gap:14px;height:68px;margin-bottom:8px;overflow:hidden;">
  <div style="width:44px;height:44px;border-radius:9999px;border:1px solid ${INK};overflow:hidden;flex-shrink:0;">
    <img src="${proxyImg(profile.iconUrl)}" alt="${escapeHtml(profile.name)}" width="44" height="44" style="display:block;width:44px;height:44px;" onerror="this.style.display='none'">
  </div>
  <div style="flex:1;min-width:0;">
    <div style="font-size:18px;font-weight:bold;font-family:Georgia,serif;letter-spacing:-0.3px;line-height:1.1;">${escapeHtml(profile.name)}<span style="color:${INK_MUTED};font-weight:normal;font-size:13px;">${escapeHtml(profile.tag)}</span></div>
    <div style="font-size:9px;letter-spacing:2px;font-family:'Helvetica Neue',Arial,sans-serif;color:${INK_MUTED};margin-top:3px;">SUMMONER LEVEL</div>
  </div>
  <div style="text-align:right;">
    <div style="font-size:28px;font-weight:bold;font-family:Georgia,serif;line-height:1;letter-spacing:-1px;">${profile.level}</div>
  </div>
</div>`
}

function renderMatchCard(match: MatchResult): string {
  const bg = match.win ? PAPER_LIGHT : PAPER_DARK
  const badgeBg = match.win ? INK : 'transparent'
  const badgeColor = match.win ? PAPER : INK
  const badgeBorder = match.win ? 'none' : `1px solid ${INK}`

  return `<div style="background:${bg};border:1px solid ${INK};border-radius:10px;box-sizing:border-box;padding:8px;height:60px;display:flex;align-items:center;gap:10px;overflow:hidden;">
  <div style="width:40px;height:40px;border-radius:9999px;overflow:hidden;border:1px solid ${INK};flex-shrink:0;">
    <img src="${proxyImg(match.championImg)}" alt="${escapeHtml(match.champion)}" width="40" height="40" style="display:block;width:40px;height:40px;" onerror="this.style.display='none'">
  </div>
  <div style="flex:1;min-width:0;">
    <div style="font-size:8px;letter-spacing:1.2px;font-family:'Helvetica Neue',Arial,sans-serif;color:${INK_MUTED};">${escapeHtml(match.queueType.toUpperCase())}</div>
    <div style="font-size:14px;font-weight:bold;font-family:Georgia,serif;line-height:1.1;letter-spacing:-0.2px;margin-top:1px;">${match.kills}<span style="color:${INK_MUTED};margin:0 2px;">/</span>${match.deaths}<span style="color:${INK_MUTED};margin:0 2px;">/</span>${match.assists}</div>
  </div>
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;font-weight:bold;letter-spacing:1px;padding:3px 8px;border-radius:9999px;background:${badgeBg};color:${badgeColor};border:${badgeBorder};flex-shrink:0;">${match.win ? 'W' : 'L'}</div>
</div>`
}

function renderWinrateBar(value: number): string {
  const pct = Math.min(100, Math.max(0, value))
  return `<div style="width:100%;height:4px;background:${PAPER_DARKER};border-radius:2px;overflow:hidden;border:1px solid ${INK};box-sizing:border-box;">
  <div style="width:${pct}%;height:100%;background:${INK};"></div>
</div>`
}

function renderChampionRow(champ: ChampionStat, rank: number): string {
  const rankBg = rank === 1 ? INK : 'transparent'
  const rankColor = rank === 1 ? PAPER : INK

  return `<div style="background:${PAPER_LIGHT};border:1px solid ${INK};border-radius:10px;box-sizing:border-box;padding:7px;height:50px;display:flex;align-items:center;gap:10px;margin-bottom:6px;overflow:hidden;">
  <div style="width:20px;height:20px;border-radius:9999px;border:1px solid ${INK};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;font-family:Georgia,serif;background:${rankBg};color:${rankColor};flex-shrink:0;">${rank}</div>
  <div style="width:34px;height:34px;border-radius:9999px;overflow:hidden;border:1px solid ${INK};flex-shrink:0;">
    <img src="${proxyImg(champ.championImg)}" alt="${escapeHtml(champ.name)}" width="34" height="34" style="display:block;width:34px;height:34px;" onerror="this.style.display='none'">
  </div>
  <div style="flex:1;min-width:0;">
    <div style="font-size:14px;font-weight:bold;font-family:Georgia,serif;line-height:1;letter-spacing:-0.2px;">${escapeHtml(champ.name)}</div>
    <div style="font-size:9px;letter-spacing:0.5px;font-family:'Helvetica Neue',Arial,sans-serif;color:${INK_MUTED};margin-top:2px;">${champ.games} games played</div>
  </div>
  <div style="width:140px;display:flex;align-items:center;gap:8px;">
    <div style="flex:1;">${renderWinrateBar(champ.winrate)}</div>
    <span style="font-size:13px;font-weight:bold;font-family:Georgia,serif;letter-spacing:-0.3px;min-width:32px;text-align:right;">${champ.winrate}%</span>
  </div>
</div>`
}

function renderLeague(data: LeagueData | null): string {
  const year = new Date().getFullYear()

  if (!data) {
    return `<div style="margin-bottom:10px;">
  ${sectionHeader('LEAGUE OF LEGENDS', `All Game Modes &middot; ${year}`)}
  <p style="font-size:12px;color:${INK_MUTED};">League data unavailable</p>
</div>`
  }

  const matchCells = data.matches.slice(0, 4).map((m) => renderMatchCard(m))
  const matchRows: string[] = []
  for (let i = 0; i < matchCells.length; i += 2) {
    matchRows.push(`<tr>
  <td width="50%" style="padding-right:4px;padding-bottom:8px;vertical-align:top;">${matchCells[i]}</td>
  <td width="50%" style="padding-left:4px;padding-bottom:8px;vertical-align:top;">${matchCells[i + 1] ?? '<div></div>'}</td>
</tr>`)
  }

  const champRows = data.topChamps.map((c, i) => renderChampionRow(c, i + 1)).join('')

  return `<div style="margin-bottom:10px;">
  ${sectionHeader('LEAGUE OF LEGENDS', `All Game Modes &middot; ${year}`)}
  ${renderProfileBanner(data.profile)}
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:2px;">${matchRows.join('')}</table>
  ${champRows}
</div>`
}

function renderSpotify(data: SpotifyPlayback | null): string {
  if (!data?.isPlaying || !data.track) return ''
  const track = data.track
  const pct = track.durationMs > 0 ? Math.min(100, Math.max(0, (track.progressMs / track.durationMs) * 100)) : 0

  const coverImg = track.coverUrl
    ? `<img src="${proxyImg(track.coverUrl)}" alt="${escapeHtml(track.title)}" width="44" height="44" style="display:block;width:44px;height:44px;" onerror="this.style.display='none'">`
    : ''

  return `<div style="margin-bottom:8px;">
  ${sectionHeader('SPOTIFY', 'now playing')}
  <div style="background:${PAPER_LIGHT};border:1px solid ${INK};border-radius:10px;box-sizing:border-box;padding:9px 10px;display:flex;align-items:center;gap:12px;overflow:hidden;">
    <div style="width:44px;height:44px;border-radius:6px;overflow:hidden;border:1px solid ${INK};flex-shrink:0;">${coverImg}</div>
    <div style="flex:1;min-width:0;">
      <div style="font-size:14px;font-weight:bold;font-family:Georgia,serif;letter-spacing:-0.2px;overflow:hidden;white-space:nowrap;">${escapeHtml(track.title)}</div>
      <div style="font-size:11px;font-family:Georgia,serif;font-style:italic;color:${INK};margin-top:1px;overflow:hidden;white-space:nowrap;">${escapeHtml(track.artist)}</div>
      <div style="margin-top:5px;">${renderWinrateBar(pct)}</div>
      <div style="display:flex;justify-content:space-between;margin-top:3px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:9px;letter-spacing:1px;color:${INK_MUTED};">
        <span>${formatTime(track.progressMs)}</span>
        <span>${formatTime(track.durationMs)}</span>
      </div>
    </div>
  </div>
</div>`
}

function renderFooter(): string {
  return `<div style="display:flex;align-items:center;justify-content:center;gap:10px;padding-top:10px;">
  <div style="flex:1;height:1px;background:${INK};opacity:0.3;max-width:140px;"></div>
  <div style="font-family:Georgia,serif;font-size:11px;letter-spacing:3px;color:${INK};font-weight:normal;font-style:italic;">AutumnFaun Dashboard</div>
  <div style="flex:1;height:1px;background:${INK};opacity:0.3;max-width:140px;"></div>
</div>`
}

// baseUrl is kept in the signature for backward compatibility with the route
// handler, but images use relative URLs so they always resolve correctly
// regardless of how the server is accessed (LAN IP, localhost, Docker, etc.).
export function renderKindlePage(
  steam: SteamData | null,
  league: LeagueData | null,
  spotify: SpotifyPlayback | null,
  _baseUrl: string
): string {
  const steamRate = parseInt(process.env.STEAM_UPDATE_RATE ?? '60', 10)
  const leagueRate = parseInt(process.env.LEAGUE_UPDATE_RATE ?? '600', 10)
  const refreshSeconds = Math.min(steamRate, leagueRate)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=600, initial-scale=1, user-scalable=no">
<meta http-equiv="refresh" content="${refreshSeconds}">
<title>AutumnFaun Dashboard</title>
</head>
<body style="background:${PAPER};color:${INK};font-family:Georgia,'Times New Roman',serif;margin:0;padding:20px 22px 16px;width:556px;box-sizing:border-box;">
${renderSteam(steam)}
${renderLeague(league)}
${renderSpotify(spotify)}
${renderFooter()}
</body>
</html>`
}
