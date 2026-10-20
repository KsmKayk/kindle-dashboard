import type { SpotifyPlayback, SpotifyTrackInfo, LyricsData, LyricLine } from '@/types'
import {
  INK, INK_MUTED, PAPER, PAPER_LIGHT,
  escapeHtml, proxyImg, formatTime, sectionHeader, renderWinrateBar, renderNav, renderKindleDocument, withToken,
} from './kindle-render'

export const DEFAULT_REFRESH_SECONDS = 5
const MIN_REFRESH_SECONDS = 2
const MAX_REFRESH_SECONDS = 600
// While paused nothing moves, so reload less often
const PAUSED_REFRESH_SECONDS = 30
// Synced lines shown on each side of the current one
const LYRICS_CONTEXT = 4

const LABEL_FONT = `font-family:'Helvetica Neue',Arial,sans-serif;`

// The ?r= query parameter (seconds between reloads), clamped to a sane range
export function parseRefreshSeconds(value: string | null): number {
  const n = parseInt(value ?? '', 10)
  if (!Number.isFinite(n)) return DEFAULT_REFRESH_SECONDS
  return Math.min(MAX_REFRESH_SECONDS, Math.max(MIN_REFRESH_SECONDS, n))
}

// Reload when the track ends rather than waiting a full interval past it
export function refreshSecondsFor(playback: SpotifyPlayback | null, interval: number): number {
  const track = playback?.track
  if (!playback?.isPlaying || !track) return Math.max(interval, PAUSED_REFRESH_SECONDS)
  const untilEnd = Math.ceil((track.durationMs - track.progressMs) / 1000) + 1
  return Math.max(MIN_REFRESH_SECONDS, Math.min(interval, untilEnd))
}

// Index of the line being sung, or -1 before the first line starts
function currentLineIndex(lines: LyricLine[], seconds: number): number {
  let idx = -1
  for (let i = 0; i < lines.length && lines[i].time <= seconds; i++) idx = i
  return idx
}

function renderTrack(track: SpotifyTrackInfo, isPlaying: boolean): string {
  const pct = track.durationMs > 0 ? (track.progressMs / track.durationMs) * 100 : 0
  const cover = track.coverUrl
    ? `<img src="${proxyImg(track.coverUrl)}" alt="${escapeHtml(track.album)}" width="170" height="170" style="display:block;width:170px;height:170px;" onerror="this.style.display='none'">`
    : `<div style="width:170px;height:170px;display:flex;align-items:center;justify-content:center;text-align:center;font-family:Georgia,serif;font-size:22px;font-weight:bold;white-space:pre-line;">${escapeHtml(track.fallback)}</div>`

  return `<div style="background:${PAPER_LIGHT};border:1px solid ${INK};border-radius:10px;box-sizing:border-box;padding:12px;display:flex;gap:16px;margin-bottom:12px;overflow:hidden;">
  <div style="width:170px;height:170px;border-radius:6px;overflow:hidden;border:1px solid ${INK};flex-shrink:0;">${cover}</div>
  <div style="flex:1;min-width:0;display:flex;flex-direction:column;">
    <div style="${LABEL_FONT}font-size:9px;font-weight:bold;letter-spacing:2.2px;color:${INK_MUTED};">${isPlaying ? 'NOW PLAYING' : 'PAUSED'}</div>
    <div style="font-family:Georgia,serif;font-size:24px;font-weight:bold;line-height:1.15;letter-spacing:-0.4px;margin-top:6px;max-height:83px;overflow:hidden;">${escapeHtml(track.title)}</div>
    <div style="font-family:Georgia,serif;font-size:15px;font-style:italic;margin-top:6px;max-height:38px;overflow:hidden;">${escapeHtml(track.artist)}</div>
    <div style="font-family:Georgia,serif;font-size:12px;color:${INK_MUTED};margin-top:3px;white-space:nowrap;overflow:hidden;">${escapeHtml(track.album)}</div>
    <div style="flex:1;"></div>
    ${renderWinrateBar(pct)}
    <div style="display:flex;justify-content:space-between;margin-top:4px;${LABEL_FONT}font-size:10px;letter-spacing:1px;color:${INK_MUTED};">
      <span>${formatTime(track.progressMs)}</span>
      <span>${formatTime(track.durationMs)}</span>
    </div>
  </div>
</div>`
}

// Each button is a tiny form: a tap posts the command and the server redirects
// back to this page, so the controls need no JavaScript.
function controlButton(action: string, label: string, primary: boolean, refresh: number, token: string | null): string {
  const colors = primary ? `background:${INK};color:${PAPER};` : `background:${PAPER_LIGHT};color:${INK};`
  // The token goes in the action URL (not a field): src/proxy.ts checks it before the route reads the body
  return `<form method="post" action="${withToken('/kindle/spotify/control', token)}" style="margin:0;flex:${primary ? 2 : 1};">
  <input type="hidden" name="action" value="${action}">
  <input type="hidden" name="r" value="${refresh}">
  <button type="submit" style="${colors}width:100%;height:56px;border:1px solid ${INK};border-radius:10px;${LABEL_FONT}font-size:14px;font-weight:bold;letter-spacing:2px;">${label}</button>
</form>`
}

function renderControls(isPlaying: boolean, refresh: number, token: string | null): string {
  return `<div style="display:flex;gap:10px;margin-bottom:12px;">
  ${controlButton('previous', '&laquo; PREV', false, refresh, token)}
  ${isPlaying ? controlButton('pause', 'PAUSE', true, refresh, token) : controlButton('play', 'PLAY', true, refresh, token)}
  ${controlButton('next', 'NEXT &raquo;', false, refresh, token)}
</div>`
}

const lyricsBox = `border:1px dashed ${INK};border-radius:10px;box-sizing:border-box;height:430px;overflow:hidden;padding:0 20px;display:flex;flex-direction:column;justify-content:center;text-align:center;font-family:Georgia,serif;`

function renderLyrics(lyrics: LyricsData | null, progressMs: number): string {
  if (lyrics && lyrics.synced.length > 0) {
    const idx = currentLineIndex(lyrics.synced, progressMs / 1000)
    const centre = Math.max(0, idx)
    const start = Math.max(0, centre - LYRICS_CONTEXT)
    const lines = lyrics.synced
      .slice(start, centre + LYRICS_CONTEXT + 1)
      .map((line, offset) => {
        const i = start + offset
        const style = i === idx
          ? `font-size:24px;font-weight:bold;color:${INK};`
          : `font-size:17px;color:${i < idx ? INK_MUTED : INK};`
        return `<div style="${style}line-height:1.25;padding:5px 0;">${escapeHtml(line.text)}</div>`
      })
    return `<div style="${lyricsBox}">${lines.join('')}</div>`
  }

  if (lyrics && lyrics.plain.length > 0) {
    // Unsynced: show the start of the lyrics, centred when they fit
    const lines = lyrics.plain.map((line) => `<div>${escapeHtml(line)}</div>`).join('')
    return `<div style="${lyricsBox}justify-content:flex-start;padding-top:14px;font-size:13px;line-height:1.45;">${lines}</div>`
  }

  return `<div style="${lyricsBox}font-size:14px;font-style:italic;color:${INK_MUTED};">No lyrics available</div>`
}

export function renderKindleSpotifyPage(
  playback: SpotifyPlayback | null,
  lyrics: LyricsData | null,
  interval: number,
  error: string | null = null,
  token: string | null = null
): string {
  const track = playback?.track ?? null
  const isPlaying = Boolean(playback?.isPlaying && track)

  const errorLine = error
    ? `<div style="${LABEL_FONT}font-size:11px;font-weight:bold;letter-spacing:0.5px;margin:-4px 0 10px;">&#9888; ${escapeHtml(error.slice(0, 140))}</div>`
    : ''

  const content = track
    ? `${renderTrack(track, isPlaying)}
${renderControls(isPlaying, interval, token)}
${errorLine}
${renderLyrics(lyrics, track.progressMs)}`
    : `<p style="font-size:14px;font-style:italic;color:${INK_MUTED};">Nothing played yet. Start a track on Spotify.</p>
${errorLine}`

  return renderKindleDocument(
    'AutumnFaun Spotify',
    refreshSecondsFor(playback, interval),
    `${renderNav('spotify', null, token)}
${sectionHeader('SPOTIFY', isPlaying ? 'now playing' : track ? 'paused' : 'idle')}
${content}`
  )
}
