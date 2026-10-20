--[[--
Spotify tab: cover, track, progress, playback buttons and synced lyrics.

Polls /api/spotify every few seconds; between polls a local clock advances the
lyrics, and each line change refreshes only the lyrics box (no full-screen flash).
--]]

local Blitbuffer = require("ffi/blitbuffer")
local Button = require("ui/widget/button")
local Device = require("device")
local FrameContainer = require("ui/widget/container/framecontainer")
local HorizontalGroup = require("ui/widget/horizontalgroup")
local HorizontalSpan = require("ui/widget/horizontalspan")
local ImageWidget = require("ui/widget/imagewidget")
local ProgressWidget = require("ui/widget/progresswidget")
local Size = require("ui/size")
local TextBoxWidget = require("ui/widget/textboxwidget")
local TextWidget = require("ui/widget/textwidget")
local UIManager = require("ui/uimanager")
local VerticalGroup = require("ui/widget/verticalgroup")
local VerticalSpan = require("ui/widget/verticalspan")
local socket = require("socket")
local T = require("ffi/util").template
local _ = require("gettext")

local Api = require("kdash_api")
local Lyrics = require("kdash_lyrics")
local Ui = require("kdash_ui")

local Screen = Device.screen
local S = function(px) return Screen:scaleBySize(px) end

local POLL_SECONDS = 5
-- Spotify applies a command asynchronously; poll again after this delay
local CONTROL_SETTLE_SECONDS = 0.8
-- Let the tab switch paint before the (blocking) first poll
local START_DELAY = 0.3

-- Line changes use a non-flashing partial refresh; every Nth one flashes the
-- lyrics box to clear the ghosting those leave on e-ink
local LYRICS_FLASH_EVERY = 15

local COVER_SIZE = 170
local PADDING = 18
local LINE_GAP = 10

local SpotifyView = {}
SpotifyView.__index = SpotifyView

function SpotifyView.new(args)
    local self = setmetatable({}, SpotifyView)
    self.hub = args.hub
    self.api = args.api
    self.width = args.width
    self.height = args.height
    self.cover_file = args.cache_dir .. "/cover.png"
    self.playback = nil
    self.loaded = false -- first poll answered
    self.offline = nil
    self.lyrics = nil
    self.lyrics_loaded = false
    self.cover_ok = false
    self.clock = nil
    self.line_idx = nil
    self.control_error = nil
    self.lyrics_updates = 0
    self.running = false
    self.poll_cb = function() self:poll() end
    self.tick_cb = function() self:tick() end
    return self
end

local function trackOf(playback)
    local track = playback and playback.track
    if type(track) == "table" then return track end
end

local function text(value)
    if type(value) == "string" or type(value) == "number" then return tostring(value) end
    return ""
end

function SpotifyView:start()
    self.running = true
    UIManager:unschedule(self.poll_cb)
    UIManager:scheduleIn(START_DELAY, self.poll_cb)
    self:scheduleTick()
end

function SpotifyView:stop()
    self.running = false
    UIManager:unschedule(self.poll_cb)
    UIManager:unschedule(self.tick_cb)
end

function SpotifyView:schedulePoll(seconds)
    UIManager:unschedule(self.poll_cb)
    if self.running then UIManager:scheduleIn(seconds, self.poll_cb) end
end

function SpotifyView:positionMs()
    if not self.clock then return 0 end
    return Lyrics.position(self.clock, socket.gettime())
end

function SpotifyView:syncedLines()
    local lyrics = self.lyrics
    if type(lyrics) == "table" and type(lyrics.synced) == "table" and #lyrics.synced > 0 then
        return lyrics.synced
    end
end

function SpotifyView:plainLines()
    local lyrics = self.lyrics
    if type(lyrics) == "table" and type(lyrics.plain) == "table" and #lyrics.plain > 0 then
        return lyrics.plain
    end
end

-- Data ------------------------------------------------------------------------

function SpotifyView:poll()
    if not self.running then return end
    local data, err = self.api:getJSON("/api/spotify")
    if data then
        self.offline = nil
        self:apply(data)
    elseif not self.playback then
        self.offline = tostring(err)
        self:render("ui")
    end
    self:schedulePoll(POLL_SECONDS)
end

function SpotifyView:apply(data)
    local prev_track = trackOf(self.playback)
    local was_playing = self.playback ~= nil and self.playback.isPlaying == true
    local first = not self.loaded
    self.loaded = true
    self.playback = data
    local track = trackOf(data)
    local now = socket.gettime()

    if (track and track.id) ~= (prev_track and prev_track.id) then
        self.lyrics, self.lyrics_loaded, self.cover_ok = nil, false, false
        self.control_error = nil
        self.clock = Lyrics.resync(nil, data, now)
        if track then
            self:loadCover(track)
            self:loadLyrics(track)
        end
        self:render("flashui") -- new cover: flash to avoid ghosting
    else
        self.clock = Lyrics.resync(self.clock, data, now) or self.clock
        local lyrics_arrived = false
        if track and not self.lyrics_loaded then
            self:loadLyrics(track) -- the last lookup failed; retry
            lyrics_arrived = self.lyrics_loaded
        end
        if first or was_playing ~= (data.isPlaying == true) then
            self:render("ui")
        else
            self:renderProgress()
            if lyrics_arrived then self:renderLyrics() end
        end
    end
    self:scheduleTick()
end

function SpotifyView:loadCover(track)
    if type(track.coverUrl) ~= "string" then return end
    self.cover_ok = self.api:download(Api.withQuery("/api/image-proxy", { url = track.coverUrl }), self.cover_file) == true
end

function SpotifyView:loadLyrics(track)
    local path = Api.withQuery("/api/spotify/lyrics", {
        title = text(track.title),
        artist = text(track.artist),
        album = text(track.album),
        durationMs = tonumber(track.durationMs) or 0,
    })
    local data, code = self.api:getJSON(path)
    -- 200 with null means the track has no lyrics; anything else is retried next poll
    if code == 200 then
        self.lyrics = data
        self.lyrics_loaded = true
    end
end

function SpotifyView:control(action)
    if not self.playback then return end
    self.control_error = nil
    if (action == "play" or action == "pause") and self.clock then
        -- Optimistic: flip the button and the clock now, the next poll confirms it
        self.playback.isPlaying = action == "play"
        self.clock = Lyrics.setPlaying(self.clock, action == "play", socket.gettime())
        self:render("ui")
        UIManager:forceRePaint()
    end
    local body, code = self.api:postJSON("/api/spotify/control", { action = action })
    if code ~= 200 then
        self.control_error = (type(body) == "table" and type(body.error) == "string") and body.error
            or T(_("Playback control failed (%1)"), tostring(code))
        self:render("ui")
    end
    self:schedulePoll(CONTROL_SETTLE_SECONDS)
    self:scheduleTick()
end

-- Lyrics clock ------------------------------------------------------------------

function SpotifyView:scheduleTick()
    UIManager:unschedule(self.tick_cb)
    if not self.running or not self.clock or not self.clock.playing then return end
    local lines = self:syncedLines()
    if not lines then return end
    local wait = Lyrics.secondsToNextLine(lines, self:positionMs() / 1000)
    if wait then UIManager:scheduleIn(math.max(0.05, wait + 0.05), self.tick_cb) end
end

function SpotifyView:tick()
    if not self.running then return end
    local lines = self:syncedLines()
    if lines and Lyrics.currentIndex(lines, self:positionMs() / 1000) ~= self.line_idx then
        self:renderLyrics()
    end
    self:scheduleTick()
end

-- Rendering -----------------------------------------------------------------------

function SpotifyView:render(mode)
    self.hub:setContent(self, self:build(), mode)
end

function SpotifyView:renderLyrics()
    if not self.lyrics_region then return end
    Ui.setRegionChild(self.lyrics_region, self:buildLyrics())
    self.lyrics_updates = self.lyrics_updates + 1
    local mode = self.lyrics_updates % LYRICS_FLASH_EVERY == 0 and "flashui" or "ui"
    self.hub:refreshRegion(self, self.lyrics_region, mode)
end

function SpotifyView:renderProgress()
    if not self.progress_region then return end
    Ui.setRegionChild(self.progress_region, self:buildProgress())
    self.hub:refreshRegion(self, self.progress_region, "ui")
end

function SpotifyView:message(msg)
    self.lyrics_region, self.progress_region = nil, nil
    return Ui.region(self.width, self.height, TextBoxWidget:new{
        text = msg,
        face = Ui.serif(16),
        width = self.width - S(80),
        alignment = "center",
        fgcolor = Blitbuffer.COLOR_DARK_GRAY,
    })
end

-- TextBoxWidget limited to max_h, with an ellipsis when the text is longer
local function clampedTextBox(args, max_h)
    local widget = TextBoxWidget:new(args)
    if widget:getSize().h <= max_h then return widget end
    widget:free()
    args.height = max_h
    args.height_adjust = true
    args.height_overflow_show_ellipsis = true
    return TextBoxWidget:new(args)
end

function SpotifyView:buildHeader(track, playing, inner_w)
    local cover_size = S(COVER_SIZE)
    local cover
    if self.cover_ok then
        cover = ImageWidget:new{
            file = self.cover_file,
            file_do_cache = false, -- same path for every track
            width = cover_size,
            height = cover_size,
            scale_factor = 0,
        }
    else
        cover = TextBoxWidget:new{
            text = text(track.fallback),
            face = Ui.serif(18),
            bold = true,
            width = cover_size - S(16),
            alignment = "center",
        }
    end

    local info_w = inner_w - cover_size - S(16)
    local info = VerticalGroup:new{
        align = "left",
        TextWidget:new{
            text = playing and _("NOW PLAYING") or _("PAUSED"),
            face = Ui.sans(11),
            bold = true,
            fgcolor = Blitbuffer.COLOR_DARK_GRAY,
        },
        VerticalSpan:new{ width = S(4) },
        clampedTextBox({ text = text(track.title), face = Ui.serif(22), bold = true, width = info_w }, S(92)),
        VerticalSpan:new{ width = S(6) },
        clampedTextBox({ text = text(track.artist), face = Ui.serifItalic(15), width = info_w }, S(44)),
        TextWidget:new{
            text = text(track.album),
            face = Ui.serif(12),
            fgcolor = Blitbuffer.COLOR_DARK_GRAY,
            max_width = info_w,
        },
    }

    return HorizontalGroup:new{
        align = "top",
        Ui.region(cover_size, cover_size, cover, Size.border.default),
        HorizontalSpan:new{ width = S(16) },
        info,
    }
end

function SpotifyView:buildProgress()
    local w = self.inner_w
    local track = trackOf(self.playback) or {}
    local duration = tonumber(track.durationMs) or 0
    local position = self:positionMs()
    local elapsed = TextWidget:new{ text = Lyrics.formatTime(position), face = Ui.sans(12) }
    local total = TextWidget:new{ text = Lyrics.formatTime(duration), face = Ui.sans(12) }
    return VerticalGroup:new{
        align = "left",
        ProgressWidget:new{
            width = w,
            height = S(10),
            margin_h = 0,
            margin_v = 0,
            percentage = duration > 0 and math.min(1, position / duration) or 0,
        },
        HorizontalGroup:new{
            elapsed,
            HorizontalSpan:new{ width = math.max(0, w - elapsed:getSize().w - total:getSize().w) },
            total,
        },
    }
end

function SpotifyView:buildControls(playing, inner_w)
    local gap = S(10)
    local button_w = math.floor((inner_w - 2 * gap) / 3)
    local function button(label, action)
        return Button:new{
            text = label,
            width = button_w,
            height = S(60),
            radius = Size.radius.button,
            text_font_size = 18,
            callback = function() self:control(action) end,
        }
    end
    return HorizontalGroup:new{
        button(_("« Prev"), "previous"),
        HorizontalSpan:new{ width = gap },
        playing and button(_("Pause"), "pause") or button(_("Play"), "play"),
        HorizontalSpan:new{ width = gap },
        button(_("Next »"), "next"),
    }
end

function SpotifyView:buildLyrics()
    local w, h = self.lyrics_w, self.lyrics_h
    local text_w = w - S(32)
    local lines = self:syncedLines()

    if lines then
        local idx = Lyrics.currentIndex(lines, self:positionMs() / 1000)
        self.line_idx = idx
        local function line(i)
            local current = i == idx
            return TextBoxWidget:new{
                text = text(lines[i].text),
                face = Ui.serif(current and 22 or 16),
                bold = current,
                width = text_w,
                alignment = "center",
                fgcolor = i < idx and Blitbuffer.COLOR_DARK_GRAY or Blitbuffer.COLOR_BLACK,
            }
        end

        -- Start from the current line and add neighbours on both sides while they fit
        local centre = math.max(idx, 1)
        local items = { line(centre) }
        local used = items[1]:getSize().h
        local limit = h - S(16)
        local before, after = centre - 1, centre + 1
        local grew = true
        while grew do
            grew = false
            if after <= #lines then
                local widget = line(after)
                local need = widget:getSize().h + S(LINE_GAP)
                if used + need <= limit then
                    table.insert(items, widget)
                    used, after, grew = used + need, after + 1, true
                else
                    widget:free()
                    after = #lines + 1
                end
            end
            if before >= 1 then
                local widget = line(before)
                local need = widget:getSize().h + S(LINE_GAP)
                if used + need <= limit then
                    table.insert(items, 1, widget)
                    used, before, grew = used + need, before - 1, true
                else
                    widget:free()
                    before = 0
                end
            end
        end

        local spaced = {}
        for i, widget in ipairs(items) do
            if i > 1 then table.insert(spaced, VerticalSpan:new{ width = S(LINE_GAP) }) end
            table.insert(spaced, widget)
        end
        return VerticalGroup:new{ align = "center", unpack(spaced) }
    end

    self.line_idx = nil
    local plain = self:plainLines()
    if plain then
        return TextBoxWidget:new{
            text = table.concat(plain, "\n"),
            face = Ui.serif(14),
            width = text_w,
            height = h - S(20),
            alignment = "center",
            height_overflow_show_ellipsis = true,
        }
    end
    return TextWidget:new{
        text = self.lyrics_loaded and _("No lyrics available") or _("Loading lyrics…"),
        face = Ui.serifItalic(15),
        fgcolor = Blitbuffer.COLOR_DARK_GRAY,
    }
end

function SpotifyView:build()
    local track = trackOf(self.playback)
    if not track then
        if self.offline then
            return self:message(T(_("Could not reach the server:\n%1\n\nRetrying every %2 s."), self.offline, POLL_SECONDS))
        end
        return self:message(self.loaded and _("Nothing played yet.\nStart a track on Spotify.") or _("Loading…"))
    end

    local playing = self.playback.isPlaying == true
    local pad = S(PADDING)
    local inner_w = self.width - 2 * pad
    self.inner_w = inner_w

    local children = {
        self:buildHeader(track, playing, inner_w),
        VerticalSpan:new{ width = S(12) },
    }
    self.progress_region = Ui.region(inner_w, S(34), self:buildProgress())
    table.insert(children, self.progress_region)
    table.insert(children, VerticalSpan:new{ width = S(10) })
    table.insert(children, self:buildControls(playing, inner_w))
    table.insert(children, VerticalSpan:new{ width = S(12) })
    if self.control_error then
        table.insert(children, TextBoxWidget:new{ text = "! " .. self.control_error, face = Ui.sans(13), bold = true, width = inner_w })
        table.insert(children, VerticalSpan:new{ width = S(8) })
    end

    -- The lyrics box takes the remaining height
    local used = 0
    for _i, child in ipairs(children) do used = used + child:getSize().h end
    local border = Size.border.default
    self.lyrics_w = inner_w - 2 * border
    self.lyrics_h = math.max(S(60), self.height - 2 * pad - used - 2 * border)
    self.lyrics_region = Ui.region(self.lyrics_w, self.lyrics_h, self:buildLyrics(), border)
    table.insert(children, self.lyrics_region)

    return Ui.region(self.width, self.height, FrameContainer:new{
        bordersize = 0,
        padding = pad,
        margin = 0,
        VerticalGroup:new{ align = "left", unpack(children) },
    })
end

return SpotifyView
