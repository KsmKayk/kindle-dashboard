-- Tests for the pure parts of kdash_api.lua (URL building), with KOReader's
-- networking modules stubbed. Run from koreader-plugin/: lua spec/api_test.lua
package.path = "kindledash.koplugin/?.lua;" .. package.path
for _, name in ipairs({ "json", "socket.http", "logger", "ltn12", "socket", "socketutil" }) do
    package.preload[name] = function() return {} end
end
local Api = require("kdash_api")

local function check(name, cond)
    if not cond then error("FAIL: " .. name, 2) end
end

check("encodes reserved characters", Api.urlEncode("AC/DC & Me?") == "AC%2FDC%20%26%20Me%3F")
check("encodes UTF-8 bytes", Api.urlEncode("ç") == "%C3%A7")
check("keeps unreserved characters", Api.urlEncode("a-b_c.d~1") == "a-b_c.d~1")
check("sorted query", Api.withQuery("/x", { w = 600, h = 744 }) == "/x?h=744&w=600")
check("no params", Api.withQuery("/x", {}) == "/x")
check("trims trailing slash", Api.new("https://host/").base_url == "https://host")
print("api checks passed")
