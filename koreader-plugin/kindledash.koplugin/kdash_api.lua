--[[--
Minimal HTTP client for the kindle-dashboard server.
Requests are blocking (LuaSocket), so timeouts are kept short.
--]]

local JSON = require("json")
local http = require("socket.http")
local logger = require("logger")
local ltn12 = require("ltn12")
local socket = require("socket")
local socketutil = require("socketutil")

local BLOCK_TIMEOUT = 5
local TOTAL_TIMEOUT = 15

local Api = {}
Api.__index = Api

function Api.new(base_url)
    return setmetatable({ base_url = (base_url or ""):gsub("/+$", "") }, Api)
end

function Api.urlEncode(value)
    return (tostring(value):gsub("[^%w%-_%.~]", function(c)
        return string.format("%%%02X", string.byte(c))
    end))
end

-- Builds "path?k=v&..." from a table of params (keys sorted for stable URLs).
function Api.withQuery(path, params)
    local keys = {}
    for k in pairs(params) do table.insert(keys, k) end
    table.sort(keys)
    local parts = {}
    for _, k in ipairs(keys) do
        table.insert(parts, Api.urlEncode(k) .. "=" .. Api.urlEncode(params[k]))
    end
    if #parts == 0 then return path end
    return path .. "?" .. table.concat(parts, "&")
end

-- Returns status code (number) and body, or nil and an error message.
function Api:request(method, path, body, sink)
    local chunks = {}
    local headers = { ["Accept"] = "application/json, image/png, */*" }
    local source
    if body ~= nil then
        local encoded = JSON.encode(body)
        headers["Content-Type"] = "application/json"
        headers["Content-Length"] = tostring(#encoded)
        source = ltn12.source.string(encoded)
    end

    socketutil:set_timeout(BLOCK_TIMEOUT, TOTAL_TIMEOUT)
    local code, resp_headers, status = socket.skip(1, http.request{
        url = self.base_url .. path,
        method = method,
        headers = headers,
        source = source,
        sink = sink or ltn12.sink.table(chunks),
    })
    socketutil:reset_timeout()

    if resp_headers == nil then
        logger.warn("kindledash:", method, path, "network error:", status or code)
        return nil, tostring(status or code)
    end
    return code, table.concat(chunks)
end

local function decode(text)
    if text == nil or text == "" then return nil end
    local ok, value = pcall(JSON.decode, text)
    if ok and type(value) == "table" then return value end
    return nil
end

-- GET a JSON document. Returns (table or nil, status code or error message).
-- A JSON `null` body comes back as nil with code 200.
function Api:getJSON(path)
    local code, body = self:request("GET", path)
    if code ~= 200 then return nil, code or body end
    return decode(body), code
end

-- POST JSON. Returns (decoded body or nil, status code or error message).
function Api:postJSON(path, payload)
    local code, body = self:request("POST", path, payload)
    if not code then return nil, body end
    return decode(body), code
end

-- Downloads to `path` through a temp file, so a failed download never
-- replaces a good file. Returns true, or false and an error message.
function Api:download(path, dest)
    local tmp = dest .. ".part"
    local handle = io.open(tmp, "wb")
    if not handle then return false, "cannot write " .. tmp end
    local code, err = self:request("GET", path, nil, ltn12.sink.file(handle))
    if code ~= 200 then
        os.remove(tmp)
        return false, code and ("HTTP " .. tostring(code)) or err
    end
    os.remove(dest)
    local ok, rename_err = os.rename(tmp, dest)
    if not ok then return false, rename_err end
    return true
end

return Api
