--[[--
Tab order and tab bar geometry. Pure Lua, so it is testable without KOReader.
--]]

local Tabs = {}

Tabs.ORDER = { "dashboard", "spotify", "work", "servers" }

-- The tab `step` places away from `name` (-1 = left, 1 = right), or nil past the ends
function Tabs.neighbour(name, step)
    for i, tab in ipairs(Tabs.ORDER) do
        if tab == name then return Tabs.ORDER[i + step] end
    end
    return nil
end

-- Width of each tab so the tabs, a gap after each one and the close button fill the bar
function Tabs.width(bar_width, padding, gap, close_width)
    local count = #Tabs.ORDER
    return math.max(1, math.floor((bar_width - 2 * padding - count * gap - close_width) / count))
end

return Tabs
