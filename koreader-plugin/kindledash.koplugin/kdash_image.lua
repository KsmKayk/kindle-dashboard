--[[--
A tab that shows a PNG the server renders to the size of this area
(/api/kindle/dashboard.png, work.png, servers.png): downloads it on an
interval and keeps the last good image when the server is unreachable.
--]]

local Blitbuffer = require("ffi/blitbuffer")
local ImageWidget = require("ui/widget/imagewidget")
local TextBoxWidget = require("ui/widget/textboxwidget")
local UIManager = require("ui/uimanager")
local lfs = require("libs/libkoreader-lfs")
local logger = require("logger")
local T = require("ffi/util").template
local _ = require("gettext")

local Api = require("kdash_api")
local Ui = require("kdash_ui")

-- Every Nth image update flashes the screen to clear e-ink ghosting
local FULL_REFRESH_EVERY = 10
-- Let the tab switch paint before the (blocking) download starts
local START_DELAY = 0.3

local ImageView = {}
ImageView.__index = ImageView

-- `opts`: path (server route), file (cache file name), interval (seconds)
function ImageView.new(args, opts)
    local self = setmetatable({}, ImageView)
    self.hub = args.hub
    self.api = args.api
    self.width = args.width
    self.height = args.height
    self.path = opts.path
    self.interval = opts.interval or 60
    self.image_file = args.cache_dir .. "/" .. opts.file
    -- Show the image from the last session right away, until a fresh one arrives
    self.has_image = lfs.attributes(self.image_file, "mode") == "file"
    self.error = nil
    self.updates = 0
    self.running = false
    self.fetch_cb = function() self:fetch() end
    return self
end

function ImageView:start()
    self.running = true
    UIManager:unschedule(self.fetch_cb)
    UIManager:scheduleIn(START_DELAY, self.fetch_cb)
end

function ImageView:stop()
    self.running = false
    UIManager:unschedule(self.fetch_cb)
end

function ImageView:fetch()
    if not self.running then return end
    local path = Api.withQuery(self.path, { w = self.width, h = self.height })
    local ok, err = self.api:download(path, self.image_file)
    if ok then
        self.has_image = true
        self.error = nil
        self.updates = self.updates + 1
        local mode = self.updates % FULL_REFRESH_EVERY == 0 and "full" or "ui"
        self.hub:setContent(self, self:build(), mode)
    else
        logger.warn("kindledash:", self.path, "download failed:", err)
        self.error = err
        -- Keep showing the last image; only a first-load failure needs a message
        if not self.has_image then self.hub:setContent(self, self:build(), "ui") end
    end
    UIManager:scheduleIn(self.interval, self.fetch_cb)
end

function ImageView:message(text)
    return Ui.region(self.width, self.height, TextBoxWidget:new{
        text = text,
        face = Ui.serif(16),
        width = self.width - 80,
        alignment = "center",
        fgcolor = Blitbuffer.COLOR_DARK_GRAY,
    })
end

function ImageView:build()
    if self.has_image then
        return Ui.region(self.width, self.height, ImageWidget:new{
            file = self.image_file,
            file_do_cache = false, -- same path, new content on every update
            width = self.width,
            height = self.height,
            scale_factor = 0, -- fit, keeping the aspect ratio (1:1 when sizes match)
        })
    end
    if self.error then
        return self:message(T(_("Could not reach the server:\n%1\n\nRetrying every %2 s."), self.error, self.interval))
    end
    return self:message(_("Loading…"))
end

return ImageView
