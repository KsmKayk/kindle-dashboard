--[[--
Pure helpers for the Spotify view: which lyric line is being sung, and a local
playback clock that advances between polls. No KOReader dependencies.
--]]

local Lyrics = {}

-- The polled position arrives with network lag: only re-sync the local clock
-- when it drifts further than this from Spotify's.
Lyrics.RESYNC_DRIFT_MS = 1500

-- 1-based index of the line being sung, or 0 before the first line starts.
-- `lines` is the server's synced list: { { time = seconds, text = "..." }, ... }
function Lyrics.currentIndex(lines, seconds)
    local idx = 0
    for i, line in ipairs(lines) do
        if line.time <= seconds then
            idx = i
        else
            break
        end
    end
    return idx
end

-- Seconds until the next line starts, or nil after the last one.
function Lyrics.secondsToNextLine(lines, seconds)
    local next_line = lines[Lyrics.currentIndex(lines, seconds) + 1]
    if not next_line then return nil end
    return next_line.time - seconds
end

-- Position in ms of the clock at `now` (seconds).
function Lyrics.position(clock, now)
    if not clock.playing then return clock.position_ms end
    local ms = clock.position_ms + (now - clock.at) * 1000
    if clock.duration_ms > 0 and ms > clock.duration_ms then return clock.duration_ms end
    return ms
end

-- New clock from a /api/spotify payload, or nil when the current one is still
-- in sync (same track, same play state, small drift).
function Lyrics.resync(clock, playback, now)
    local track = playback and playback.track
    local track_id = track and track.id or nil
    local playing = playback and playback.isPlaying == true or false
    local polled_ms = track and tonumber(track.progressMs) or 0
    if clock and clock.track_id == track_id and clock.playing == playing
        and math.abs(Lyrics.position(clock, now) - polled_ms) <= Lyrics.RESYNC_DRIFT_MS then
        return nil
    end
    return {
        track_id = track_id,
        position_ms = polled_ms,
        at = now,
        playing = playing,
        duration_ms = track and tonumber(track.durationMs) or 0,
    }
end

-- Same clock, paused or resumed at its current position (optimistic play/pause)
function Lyrics.setPlaying(clock, playing, now)
    return {
        track_id = clock.track_id,
        position_ms = Lyrics.position(clock, now),
        at = now,
        playing = playing,
        duration_ms = clock.duration_ms,
    }
end

function Lyrics.formatTime(ms)
    local s = math.floor((ms or 0) / 1000)
    return string.format("%d:%02d", math.floor(s / 60), s % 60)
end

return Lyrics
