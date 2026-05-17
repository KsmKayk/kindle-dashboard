import type { SteamData, LeagueData, SpotifyPlayback } from '@/types'

const INK = '#1a1612'
const PAPER = '#e8e3d8'
const PAPER_DARK = '#d8d2c4'
const WIN_GREEN = '#2a5c2a'
const LOSS_RED = '#8b1a1a'

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function proxyImg(url: string, baseUrl: string): string {
  return `${baseUrl}/api/image-proxy?url=${encodeURIComponent(url)}`
}

function sectionHeader(label: string, meta: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
  <tr>
    <td style="font-size:11px;font-weight:bold;letter-spacing:2px;border-bottom:1px solid ${INK};padding-bottom:4px;">${label}</td>
    <td style="font-size:11px;border-bottom:1px solid ${INK};padding-bottom:4px;text-align:right;font-weight:normal;">${meta}</td>
  </tr>
</table>`
}

function renderSteam(data: SteamData | null, baseUrl: string): string {
  if (!data) {
    return `<div style="margin-bottom:10px;">
      ${sectionHeader('STEAM', 'unavailable')}
      <p style="font-size:12px;color:#666;">Steam data unavailable</p>
    </div>`
  }

  const status = `${escapeHtml(data.personaname)} &middot; ${data.isOnline ? 'online' : 'offline'}`

  const nowPlaying = data.nowPlaying
    ? `<div style="font-size:12px;margin-bottom:8px;padding:6px 8px;background:${PAPER_DARK};border-radius:6px;border:1px solid ${INK};">
        <strong>NOW PLAYING:</strong> ${escapeHtml(data.nowPlaying.name)}
      </div>`
    : ''

  const allCards = [...data.topGames.slice(0, 3)]
  const totalCard = `<div style="text-align:center;padding:10px 0;">
    <div style="font-size:28px;font-weight:bold;">${data.totalGames}</div>
    <div style="font-size:10px;letter-spacing:1px;">TOTAL GAMES</div>
  </div>`

  const cells: string[] = allCards.map((g) => `
    <div style="background:${PAPER_DARK};border:1px solid ${INK};border-radius:10px;overflow:hidden;">
      <img src="${proxyImg(g.coverImg, baseUrl)}" width="100%" height="66" style="display:block;width:100%;height:66px;object-fit:cover;" onerror="this.style.display='none'">
      <div style="padding:4px 6px;">
        <div style="font-size:11px;white-space:nowrap;overflow:hidden;">${escapeHtml(g.name)}</div>
        <div style="font-size:11px;color:#555;">${g.hours}h</div>
      </div>
    </div>`)
  cells.push(`<div style="background:${PAPER_DARK};border:1px solid ${INK};border-radius:10px;">${totalCard}</div>`)

  const gameRows: string[] = []
  for (let i = 0; i < cells.length; i += 2) {
    const left = cells[i] ?? '<div></div>'
    const right = cells[i + 1] ?? '<div></div>'
    gameRows.push(`<tr>
      <td width="50%" style="padding-right:4px;padding-bottom:8px;vertical-align:top;">${left}</td>
      <td width="50%" style="padding-left:4px;padding-bottom:8px;vertical-align:top;">${right}</td>
    </tr>`)
  }

  return `<div style="margin-bottom:10px;">
    ${sectionHeader('STEAM', status)}
    ${nowPlaying}
    <table width="100%" cellpadding="0" cellspacing="0">${gameRows.join('')}</table>
  </div>`
}

function renderLeague(data: LeagueData | null, baseUrl: string): string {
  const year = new Date().getFullYear()

  if (!data) {
    return `<div style="margin-bottom:10px;">
      ${sectionHeader('LEAGUE OF LEGENDS', `All Game Modes &middot; ${year}`)}
      <p style="font-size:12px;color:#666;">League data unavailable</p>
    </div>`
  }

  const profile = `<div style="background:${PAPER_DARK};border:1px solid ${INK};border-radius:10px;padding:8px 10px;margin-bottom:8px;">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:10px;vertical-align:top;">
        <img src="${proxyImg(data.profile.iconUrl, baseUrl)}" width="50" height="50" style="border-radius:6px;border:1px solid ${INK};display:block;" onerror="this.style.display='none'">
      </td>
      <td style="vertical-align:middle;">
        <div style="font-size:15px;font-weight:bold;">${escapeHtml(data.profile.name)}<span style="font-size:12px;font-weight:normal;color:#555;"> ${escapeHtml(data.profile.tag)}</span></div>
        <div style="font-size:12px;color:#555;">Level ${data.profile.level}</div>
      </td>
    </tr></table>
  </div>`

  const matchCells = data.matches.slice(0, 4).map((m) => {
    const color = m.win ? WIN_GREEN : LOSS_RED
    const result = m.win ? 'WIN' : 'LOSS'
    return `<div style="background:${PAPER_DARK};border:1px solid ${INK};border-radius:10px;padding:8px;">
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:8px;vertical-align:top;">
          <img src="${proxyImg(m.championImg, baseUrl)}" width="42" height="42" style="border-radius:6px;border:1px solid ${INK};display:block;" onerror="this.style.display='none'">
        </td>
        <td style="vertical-align:middle;">
          <div style="font-size:12px;font-weight:bold;">${escapeHtml(m.champion)}</div>
          <div style="font-size:11px;color:#555;">${escapeHtml(m.queueType)}</div>
          <div style="font-size:11px;"><span style="color:${color};font-weight:bold;">${result}</span> &middot; ${m.kills}/${m.deaths}/${m.assists}</div>
        </td>
      </tr></table>
    </div>`
  })

  const matchRows: string[] = []
  for (let i = 0; i < matchCells.length; i += 2) {
    const left = matchCells[i] ?? '<div></div>'
    const right = matchCells[i + 1] ?? '<div></div>'
    matchRows.push(`<tr>
      <td width="50%" style="padding-right:4px;padding-bottom:8px;vertical-align:top;">${left}</td>
      <td width="50%" style="padding-left:4px;padding-bottom:8px;vertical-align:top;">${right}</td>
    </tr>`)
  }

  const champRows = data.topChamps.map((c, i) => `
    <div style="padding:6px 8px;background:${PAPER_DARK};border:1px solid ${INK};border-radius:8px;margin-bottom:6px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle;">
          <span style="font-size:11px;font-weight:bold;margin-right:6px;">#${i + 1}</span>
          <img src="${proxyImg(c.championImg, baseUrl)}" width="28" height="28" style="vertical-align:middle;border-radius:4px;border:1px solid ${INK};margin-right:6px;" onerror="this.style.display='none'">
          <span style="font-size:12px;">${escapeHtml(c.name)}</span>
        </td>
        <td style="text-align:right;font-size:11px;color:#555;vertical-align:middle;">
          ${c.games} games &middot; ${c.winrate}% WR
        </td>
      </tr></table>
    </div>`).join('')

  return `<div style="margin-bottom:10px;">
    ${sectionHeader('LEAGUE OF LEGENDS', `All Game Modes &middot; ${year}`)}
    ${profile}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">${matchRows.join('')}</table>
    ${champRows}
  </div>`
}

function renderSpotify(data: SpotifyPlayback | null): string {
  if (!data?.isPlaying || !data.track) return ''
  return `<div style="font-size:12px;padding:6px 8px;background:${PAPER_DARK};border:1px solid ${INK};border-radius:8px;margin-bottom:8px;">
    &#9835; <strong>${escapeHtml(data.track.title)}</strong> &middot; ${escapeHtml(data.track.artist)}
  </div>`
}

export function renderKindlePage(
  steam: SteamData | null,
  league: LeagueData | null,
  spotify: SpotifyPlayback | null,
  baseUrl: string
): string {
  const steamRate = parseInt(process.env.STEAM_UPDATE_RATE ?? '60', 10)
  const leagueRate = parseInt(process.env.LEAGUE_UPDATE_RATE ?? '600', 10)
  const refreshSeconds = Math.min(steamRate, leagueRate)
  const updatedAt = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=600, initial-scale=1, user-scalable=no">
<meta http-equiv="refresh" content="${refreshSeconds}">
<title>Dashboard</title>
</head>
<body style="background:${PAPER};color:${INK};font-family:Georgia,'Times New Roman',serif;margin:0;padding:20px 22px 16px;width:556px;box-sizing:border-box;">
${renderSteam(steam, baseUrl)}
${renderLeague(league, baseUrl)}
${renderSpotify(spotify)}
<div style="text-align:right;font-size:10px;color:#888;margin-top:4px;">Updated ${updatedAt} &middot; auto-refresh ${refreshSeconds}s</div>
</body>
</html>`
}
