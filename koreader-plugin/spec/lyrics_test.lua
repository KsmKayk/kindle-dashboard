-- Tests for kdash_lyrics.lua (pure Lua, no KOReader needed).
-- Run from koreader-plugin/: lua spec/lyrics_test.lua
package.path = "kindledash.koplugin/?.lua;" .. package.path
local Lyrics = require("kdash_lyrics")

local lines = { { time = 5, text = "a" }, { time = 10, text = "b" }, { time = 15, text = "c" } }
local passed = 0
local function check(name, cond)
    if not cond then error("FAIL: " .. name, 2) end
    passed = passed + 1
end

check("before the first line", Lyrics.currentIndex(lines, 1) == 0)
check("on a line start", Lyrics.currentIndex(lines, 10) == 2)
check("between lines", Lyrics.currentIndex(lines, 12.5) == 2)
check("after the last line", Lyrics.currentIndex(lines, 99) == 3)
check("empty lyrics", Lyrics.currentIndex({}, 3) == 0)

check("time to next line", Lyrics.secondsToNextLine(lines, 12) == 3)
check("time to first line", Lyrics.secondsToNextLine(lines, 0) == 5)
check("no line after the last", Lyrics.secondsToNextLine(lines, 20) == nil)

local playback = { isPlaying = true, track = { id = "t1", progressMs = 10000, durationMs = 60000 } }
local clock = Lyrics.resync(nil, playback, 100)
check("new clock from first poll", clock and clock.position_ms == 10000 and clock.playing)
check("clock advances while playing", Lyrics.position(clock, 102.5) == 12500)
check("clock stops at the end", Lyrics.position(clock, 1000) == 60000)

playback.track.progressMs = 12800
check("small drift keeps the clock", Lyrics.resync(clock, playback, 102.5) == nil)
playback.track.progressMs = 20000
check("large drift resyncs", Lyrics.resync(clock, playback, 102.5).position_ms == 20000)
playback.track.progressMs = 12500
playback.isPlaying = false
check("pause resyncs", Lyrics.resync(clock, playback, 102.5).playing == false)
playback.isPlaying = true
playback.track.id = "t2"
check("new track resyncs", Lyrics.resync(clock, playback, 102.5).track_id == "t2")
check("nothing playing", Lyrics.resync(nil, { isPlaying = false }, 1).track_id == nil)

local paused = Lyrics.setPlaying(clock, false, 103)
check("pause freezes position", paused.position_ms == 13000 and Lyrics.position(paused, 200) == 13000)
check("resume continues", Lyrics.position(Lyrics.setPlaying(paused, true, 200), 201) == 14000)

check("format time", Lyrics.formatTime(125400) == "2:05")
check("format nil", Lyrics.formatTime(nil) == "0:00")

print(string.format("%d checks passed", passed))
