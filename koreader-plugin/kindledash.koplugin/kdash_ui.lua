--[[--
Layout helpers shared by the hub and the views.
--]]

local Blitbuffer = require("ffi/blitbuffer")
local CenterContainer = require("ui/widget/container/centercontainer")
local Font = require("ui/font")
local FrameContainer = require("ui/widget/container/framecontainer")
local Geom = require("ui/geometry")

local Ui = {}

-- KOReader ships Noto Serif (the reader's default font); the sans faces come from its fontmap
function Ui.serif(size) return Font:getFace("NotoSerif-Regular.ttf", size) end
function Ui.serifItalic(size) return Font:getFace("NotoSerif-Italic.ttf", size) end
function Ui.sans(size) return Font:getFace("cfont", size) end

-- A fixed-size, white area with `child` centred in it. The outer FrameContainer
-- records where it was painted (its dimen), so the area can be refreshed on its
-- own; swap the child with Ui.setRegionChild. (FrameContainer alone sizes itself
-- to its content and ignores width/height, hence the CenterContainer.)
function Ui.region(w, h, child, bordersize)
    return FrameContainer:new{
        bordersize = bordersize or 0, padding = 0, margin = 0,
        background = Blitbuffer.COLOR_WHITE,
        CenterContainer:new{ dimen = Geom:new{ w = w, h = h }, child },
    }
end

function Ui.setRegionChild(region, child)
    local holder = region[1]
    local old = holder[1]
    holder[1] = child
    if old and old ~= child and old.free then old:free() end
end

return Ui
