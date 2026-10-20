--[[--
Full-screen window of the plugin: a tab bar (Dashboard / Spotify / Close) and
the active view below it. Views build their widgets and ask the hub to swap
them in and refresh only the part of the screen that changed.
--]]

local Blitbuffer = require("ffi/blitbuffer")
local Button = require("ui/widget/button")
local Device = require("device")
local FrameContainer = require("ui/widget/container/framecontainer")
local Geom = require("ui/geometry")
local GestureRange = require("ui/gesturerange")
local HorizontalGroup = require("ui/widget/horizontalgroup")
local HorizontalSpan = require("ui/widget/horizontalspan")
local InputContainer = require("ui/widget/container/inputcontainer")
local LineWidget = require("ui/widget/linewidget")
local Size = require("ui/size")
local UIManager = require("ui/uimanager")
local VerticalGroup = require("ui/widget/verticalgroup")
local VerticalSpan = require("ui/widget/verticalspan")
local _ = require("gettext")

local DashboardView = require("kdash_dashboard")
local Ui = require("kdash_ui")
local SpotifyView = require("kdash_spotify")

local Screen = Device.screen

local BAR_HEIGHT = 56
local TAB_WIDTH = 150
local CLOSE_WIDTH = 100
local BAR_PADDING = 12

local Hub = InputContainer:extend{
    name = "kindledash_hub",
    covers_fullscreen = true, -- hint for UIManager:_repaint()
    api = nil,
    settings = nil, -- { dashboard_interval = seconds }
    cache_dir = nil,
    initial_view = "dashboard",
    on_close = nil,
}

function Hub:init()
    self.width = Screen:getWidth()
    self.height = Screen:getHeight()
    self.dimen = Geom:new{ x = 0, y = 0, w = self.width, h = self.height }
    self.bar_height = Screen:scaleBySize(BAR_HEIGHT)
    local content_height = self.height - self.bar_height - Size.line.medium

    if Device:isTouchDevice() then
        self.ges_events.Swipe = { GestureRange:new{ ges = "swipe", range = self.dimen } }
    end

    local view_args = { hub = self, api = self.api, width = self.width, height = content_height, cache_dir = self.cache_dir }
    self.views = {
        dashboard = DashboardView.new(view_args, self.settings.dashboard_interval),
        spotify = SpotifyView.new(view_args),
    }

    -- Fixed-size area the views draw into; its dimen is the content region to refresh
    self.content = Ui.region(self.width, content_height, VerticalSpan:new{ width = 0 })
    self.active_name = self.initial_view
    self:layout()
end

function Hub:tab(label, name)
    local active = self.active_name == name
    return Button:new{
        text = label,
        width = Screen:scaleBySize(TAB_WIDTH),
        height = Screen:scaleBySize(BAR_HEIGHT - 16),
        radius = Size.radius.button,
        bordersize = active and Size.border.thick or Size.border.button,
        background = active and Blitbuffer.COLOR_LIGHT_GRAY or nil,
        text_font_size = 16,
        callback = function() self:switchTo(name) end,
    }
end

function Hub:layout()
    local pad = Screen:scaleBySize(BAR_PADDING)
    local fixed = 2 * pad + 2 * Screen:scaleBySize(TAB_WIDTH) + Screen:scaleBySize(8) + Screen:scaleBySize(CLOSE_WIDTH)
    local bar = FrameContainer:new{
        bordersize = 0, padding = 0, margin = 0,
        width = self.width, height = self.bar_height,
        background = Blitbuffer.COLOR_WHITE,
        HorizontalGroup:new{
            align = "center",
            VerticalSpan:new{ width = self.bar_height },
            HorizontalSpan:new{ width = pad },
            self:tab(_("Dashboard"), "dashboard"),
            HorizontalSpan:new{ width = Screen:scaleBySize(8) },
            self:tab(_("Spotify"), "spotify"),
            HorizontalSpan:new{ width = math.max(0, self.width - fixed) },
            Button:new{
                text = _("Close"),
                width = Screen:scaleBySize(CLOSE_WIDTH),
                height = Screen:scaleBySize(BAR_HEIGHT - 16),
                radius = Size.radius.button,
                text_font_size = 16,
                callback = function() self:onClose() end,
            },
        },
    }
    self[1] = FrameContainer:new{
        bordersize = 0, padding = 0, margin = 0,
        background = Blitbuffer.COLOR_WHITE,
        VerticalGroup:new{
            align = "left",
            bar,
            LineWidget:new{ dimen = Geom:new{ w = self.width, h = Size.line.medium } },
            self.content,
        },
    }
end

function Hub:activeView()
    return self.views[self.active_name]
end

function Hub:isActive(view)
    return self:activeView() == view
end

-- Puts a view's widget tree on screen. `mode` is a KOReader refresh type;
-- the refresh covers the content area only.
function Hub:setContent(view, widget, mode)
    if not self:isActive(view) then
        widget:free()
        return
    end
    Ui.setRegionChild(self.content, widget)
    UIManager:setDirty(self, function() return mode or "ui", self.content.dimen end)
end

-- Refreshes part of the active view (a container already on screen).
function Hub:refreshRegion(view, region_widget, mode)
    if not self:isActive(view) then return end
    UIManager:setDirty(self, function() return mode or "ui", region_widget.dimen end)
end

function Hub:switchTo(name)
    if name == self.active_name or not self.views[name] then return end
    self:activeView():stop()
    self.active_name = name
    self:layout()
    local view = self:activeView()
    self:setContent(view, view:build())
    -- Whole screen with a flash: clears ghosting left by the previous view
    UIManager:setDirty(self, "flashui")
    view:start()
end

function Hub:onSwipe(_arg, ges)
    if ges.direction == "west" then
        self:switchTo("spotify")
        return true
    elseif ges.direction == "east" then
        self:switchTo("dashboard")
        return true
    end
end

function Hub:onShow()
    local view = self:activeView()
    self:setContent(view, view:build())
    UIManager:setDirty(self, "full")
    view:start()
    return true
end

function Hub:onClose()
    UIManager:close(self, "full")
    return true
end

function Hub:onCloseWidget()
    for _name, view in pairs(self.views) do view:stop() end
    if self.on_close then self.on_close() end
end

return Hub
