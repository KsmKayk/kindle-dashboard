-- Tests for kdash_tabs.lua (tab order, tab width). Run from koreader-plugin/: lua spec/tabs_test.lua
package.path = "kindledash.koplugin/?.lua;" .. package.path
local Tabs = require("kdash_tabs")

local function check(name, cond)
    if not cond then error("FAIL: " .. name, 2) end
end

check("four tabs in order", table.concat(Tabs.ORDER, ",") == "dashboard,spotify,work,servers")
check("right of dashboard", Tabs.neighbour("dashboard", 1) == "spotify")
check("left of work", Tabs.neighbour("work", -1) == "spotify")
check("nothing left of the first", Tabs.neighbour("dashboard", -1) == nil)
check("nothing right of the last", Tabs.neighbour("servers", 1) == nil)
check("unknown tab", Tabs.neighbour("nope", 1) == nil)
-- 600 px bar: 12 px padding each side, 8 px after each tab, 90 px close button
check("tab width fills the bar", Tabs.width(600, 12, 8, 90) == 113)
print("tabs checks passed")
