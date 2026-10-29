--[[--
Full-screen window of the plugin: a tab bar (Dashboard / Spotify / Work / Servers / Close) and
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

local ImageView = require("kdash_image")
local Tabs = require("kdash_tabs")
local Ui = require("kdash_ui")
local SpotifyView = require("kdash_spotify")

local Screen = Device.screen

local BAR_HEIGHT = 56
local TAB_GAP = 8
local CLOSE_WIDTH = 90
local BAR_PADDING = 12

local TAB_LABELS = {
    dashboard = _("Dashboard"),
    spotify = _("Spotify"),
    work = _("Work"),
    servers = _("Servers"),
}
for _i, name in ipairs(Tabs.ORDER) do
    assert(TAB_LABELS[name], "kdash_hub: no label for tab " .. name)
end

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
    -- `dashboard_interval` is a historical name: it now drives every image tab
    local interval = self.settings.dashboard_interval
    local function image(name)
        return ImageView.new(view_args, { path = "/api/kindle/" .. name .. ".png", file = name .. ".png", interval = interval })
    end
    self.views = {
        dashboard = image("dashboard"),
        spotify = SpotifyView.new(view_args),
        work = image("work"),
        servers = image("servers"),
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
        width = self.tab_width,
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
    local gap = Screen:scaleBySize(TAB_GAP)
    local close_width = Screen:scaleBySize(CLOSE_WIDTH)
    self.tab_width = Tabs.width(self.width, pad, gap, close_width)

    local row = HorizontalGroup:new{
        align = "center",
        VerticalSpan:new{ width = self.bar_height },
        HorizontalSpan:new{ width = pad },
    }
    for _i, name in ipairs(Tabs.ORDER) do
        table.insert(row, self:tab(TAB_LABELS[name], name))
        table.insert(row, HorizontalSpan:new{ width = gap })
    end
    table.insert(row, Button:new{
        text = _("Close"),
        width = close_width,
        height = Screen:scaleBySize(BAR_HEIGHT - 16),
        radius = Size.radius.button,
        text_font_size = 16,
        callback = function() self:onClose() end,
    })

    local bar = FrameContainer:new{
        bordersize = 0, padding = 0, margin = 0,
        width = self.width, height = self.bar_height,
        background = Blitbuffer.COLOR_WHITE,
        row,
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

-- Swipe left = next tab, swipe right = previous tab
function Hub:onSwipe(_arg, ges)
    local step = (ges.direction == "west" and 1) or (ges.direction == "east" and -1) or nil
    if not step then return end
    local target = Tabs.neighbour(self.active_name, step)
    if target then self:switchTo(target) end
    return true
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
