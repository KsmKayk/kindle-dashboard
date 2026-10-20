--[[--
Kindle Dashboard: Steam, League of Legends and Spotify from a kindle-dashboard
server (https://github.com/KsmKayk/kindle-dashboard), full screen in KOReader.

@module koplugin.KindleDash
--]]

local DataStorage = require("datastorage")
local Dispatcher = require("dispatcher")
local InputDialog = require("ui/widget/inputdialog")
local NetworkMgr = require("ui/network/manager")
local UIManager = require("ui/uimanager")
local WidgetContainer = require("ui/widget/container/widgetcontainer")
local util = require("util")
local T = require("ffi/util").template
local _ = require("gettext")

-- Plugin modules must be required while the plugin loads (its folder is only on
-- package.path then), hence at the top of this file.
local Api = require("kdash_api")
local Hub = require("kdash_hub")

local DEFAULT_DASHBOARD_INTERVAL = 60
local MIN_DASHBOARD_INTERVAL = 15

local KindleDash = WidgetContainer:extend{
    name = "kindledash",
    is_doc_only = false,
}

function KindleDash:init()
    Dispatcher:registerAction("kindledash_open", {
        category = "none", event = "KindleDashOpen", title = _("Kindle Dashboard"), general = true,
    })
    Dispatcher:registerAction("kindledash_open_spotify", {
        category = "none", event = "KindleDashOpenSpotify", title = _("Kindle Dashboard: Spotify"), general = true,
    })
    self.ui.menu:registerToMainMenu(self)
end

-- The kindle-dashboard server, e.g. https://dashboard.example.com (nil until set)
function KindleDash:serverUrl()
    return G_reader_settings:readSetting("kindledash_server_url")
end

function KindleDash:dashboardInterval()
    return G_reader_settings:readSetting("kindledash_dashboard_interval") or DEFAULT_DASHBOARD_INTERVAL
end

function KindleDash:open(view)
    if self.hub then return end
    if not self:serverUrl() then
        -- First use: ask for the server, then open
        self:editServer(nil, function() self:open(view) end)
        return
    end
    NetworkMgr:runWhenOnline(function()
        if self.hub then return end
        local cache_dir = DataStorage:getDataDir() .. "/cache/kindledash"
        util.makePath(cache_dir)
        self.hub = Hub:new{
            api = Api.new(self:serverUrl()),
            settings = { dashboard_interval = self:dashboardInterval() },
            cache_dir = cache_dir,
            initial_view = view or "dashboard",
            on_close = function() self.hub = nil end,
        }
        UIManager:show(self.hub)
    end)
end

function KindleDash:onKindleDashOpen()
    self:open("dashboard")
    return true
end

function KindleDash:onKindleDashOpenSpotify()
    self:open("spotify")
    return true
end

function KindleDash:editSetting(title, value, input_type, on_save, touchmenu_instance)
    local dialog
    dialog = InputDialog:new{
        title = title,
        input = tostring(value),
        input_type = input_type,
        buttons = {{
            {
                text = _("Cancel"),
                id = "close",
                callback = function() UIManager:close(dialog) end,
            },
            {
                text = _("Save"),
                is_enter_default = true,
                callback = function()
                    on_save(dialog:getInputText())
                    UIManager:close(dialog)
                    if touchmenu_instance then touchmenu_instance:updateItems() end
                end,
            },
        }},
    }
    UIManager:show(dialog)
    dialog:onShowKeyboard()
end

function KindleDash:editServer(touchmenu_instance, after_save)
    self:editSetting(_("Kindle Dashboard server URL"), self:serverUrl() or "https://", "text", function(value)
        value = util.trim(value):gsub("/+$", "")
        if value == "" or value == "https:" or value == "http:" then
            G_reader_settings:delSetting("kindledash_server_url")
        else
            G_reader_settings:saveSetting("kindledash_server_url", value)
            if after_save then UIManager:nextTick(after_save) end
        end
    end, touchmenu_instance)
end

function KindleDash:addToMainMenu(menu_items)
    menu_items.kindledash = {
        text = _("Kindle Dashboard"),
        sorting_hint = "tools",
        sub_item_table = {
            {
                text = _("Open dashboard"),
                callback = function() self:open("dashboard") end,
            },
            {
                text = _("Open Spotify player"),
                callback = function() self:open("spotify") end,
                separator = true,
            },
            {
                text_func = function() return T(_("Server: %1"), self:serverUrl() or _("not set")) end,
                keep_menu_open = true,
                callback = function(touchmenu_instance) self:editServer(touchmenu_instance) end,
            },
            {
                text_func = function() return T(_("Dashboard refresh: %1 s"), self:dashboardInterval()) end,
                keep_menu_open = true,
                callback = function(touchmenu_instance)
                    self:editSetting(_("Dashboard refresh (seconds)"), self:dashboardInterval(), "number", function(value)
                        local seconds = math.max(MIN_DASHBOARD_INTERVAL, tonumber(value) or DEFAULT_DASHBOARD_INTERVAL)
                        G_reader_settings:saveSetting("kindledash_dashboard_interval", math.floor(seconds))
                    end, touchmenu_instance)
                end,
            },
        },
    }
end

return KindleDash
