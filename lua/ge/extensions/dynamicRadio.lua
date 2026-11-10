-- ============================================================================
-- DynamicRadio - Game Engine Lua Extension for BeamNG.drive
-- ============================================================================
-- Este módulo gestiona:
-- 1. Detección del estado del vehículo del jugador (dentro/fuera de coche o caminando).
-- 2. Notificaciones a la interfaz UI para mostrar/ocultar el estéreo.
-- 3. Escaneo y listado de canciones locales en 'music_mp3/'.
-- 4. Escaneo y listado de emisoras de radio simuladas en 'music_radio/'.
-- 5. Extracción inteligente de frecuencias de radio (ej. 103.9 FM, 98.3 FM) y limpieza de títulos.
-- ============================================================================

local M = {}

-- ----------------------------------------------------------------------------
-- VEHICLE STATE DETECTION
-- ----------------------------------------------------------------------------

--- Comprueba si el jugador está actualmente al volante de un vehículo.
-- Retorna false si está a pie (modo caminar) o si no hay vehículo activo.
-- @return boolean
local function checkInVehicle()
  -- Si el jugador está caminando a pie explícitamente, ocultar el estéreo del auto
  if extensions.gameplay_walk and extensions.gameplay_walk.isWalking and extensions.gameplay_walk.isWalking() then
    return false
  end

  -- En cualquier otro caso (conduciendo, cámara libre o configurando apps en el HUD), mantener visible
  return true
end

--- Devuelve el estado actual del vehículo para la interfaz UI.
-- @return table { inVehicle = boolean, vehicleId = number }
function M.getVehicleState()
  local inVeh = checkInVehicle()
  local veh = be:getPlayerVehicle(0)
  return {
    inVehicle = inVeh,
    vehicleId = veh and veh:getId() or -1
  }
end

--- Emite un evento a guihooks para notificar a AngularJS del cambio de vehículo.
local function notifyVehicleState()
  local state = M.getVehicleState()
  guihooks.trigger("DynamicRadioVehicleState", state)
end

-- ----------------------------------------------------------------------------
-- AUDIO SCANNING & CLEANING HELPERS
-- ----------------------------------------------------------------------------

--- Limpia el nombre del archivo para mostrar un título estético en la pantalla LCD.
-- Elimina sufijos técnicos comunes como (128kbit_AAC), [MP3], bitrates y espacios redundantes.
-- @param str string: Nombre del archivo sin extensión
-- @return string: Título limpio
local function cleanDisplayTitle(str)
  if not str then return "" end

  -- Eliminar etiquetas de calidad y codecs: (128kbit_AAC), (320kbps), etc.
  local cleaned = string.gsub(str, "%b()[^%)]*kbit[^%)]*%b()", "")
  cleaned = string.gsub(cleaned, "%b()[^%)]*AAC[^%)]*%b()", "")
  cleaned = string.gsub(cleaned, "%b()[^%)]*kbps[^%)]*%b()", "")
  cleaned = string.gsub(cleaned, "%b()[^%)]*128kbit[^%)]*%)", "")
  cleaned = string.gsub(cleaned, "%b()[^%)]*AAC[^%)]*%)", "")

  -- Eliminar corchetes como [MP3] o [MP3] HQ
  cleaned = string.gsub(cleaned, "%b[][^%]]*MP3[^%]]*%b]", "")
  cleaned = string.gsub(cleaned, "%b[][^%]]*MP3[^%]]*%]", "")

  -- Eliminar sufijo "HQ" suelto si quedó
  cleaned = string.gsub(cleaned, "%s+HQ%s*$", "")

  -- Eliminar numeración inicial de pistas (ej: "01 - ", "02. ")
  cleaned = string.gsub(cleaned, "^%d+[%s_%-.]*", "")

  -- Limpiar espacios y guiones al inicio o final
  cleaned = string.gsub(cleaned, "^[%s_%-–]+", "")
  cleaned = string.gsub(cleaned, "[%s_%-–]+$", "")
  cleaned = string.gsub(cleaned, "%s+", " ")

  if cleaned == "" then
    return str
  end
  return cleaned
end

--- Escanea los directorios especificados buscando archivos de audio soportados.
-- Formatos soportados nativamente por el reproductor HTML5/CEF: .mp3, .ogg, .wav, .flac
-- @param searchDirs table: Lista de rutas virtuales para buscar
-- @param isRadio boolean: Si true, activa extracción de frecuencia FM
-- @return table: Lista de pistas encontradas con ruta, título y metadata
local function scanAudioDir(searchDirs, isRadio)
  local exts = {"*.mp3", "*.ogg", "*.wav", "*.flac"}
  local list = {}
  local seen = {}

  for _, dir in ipairs(searchDirs) do
    if FS:directoryExists(dir) then
      for _, pattern in ipairs(exts) do
        local files = FS:findFilesByPattern(dir, pattern, 1, true, false)
        if files then
          for _, filepath in ipairs(files) do
            if not seen[filepath] then
              seen[filepath] = true
              local filename = string.match(filepath, "[^/]+$") or filepath
              local rawName = string.gsub(filename, "%.[^.]+$", "")
              local cleanTitle = cleanDisplayTitle(rawName)

              local frequency = nil
              local freqNumeric = 0
              if isRadio then
                -- 1. Intentar extraer frecuencia con sufijo FM explícito (ej: "103.9 FM" o "103.9FM")
                local freqExplicit = string.match(rawName, "(%d%d?%d?%.?%d*%s*[Ff][Mm])")
                if freqExplicit then
                  frequency = string.upper(freqExplicit)
                  if not string.match(frequency, "%s") then
                    frequency = string.gsub(frequency, "FM", " FM")
                  end
                  -- Limpiar la frecuencia del título para que la pantalla LCD quede elegante
                  cleanTitle = string.gsub(cleanTitle, "%d%d?%d?%.?%d*%s*[Ff][Mm]%s*[%-–—:]*%s*", "")
                  cleanTitle = string.gsub(cleanTitle, "^[%s_%-–—:]+", "")
                  cleanTitle = string.gsub(cleanTitle, "[%s_%-–—:]+$", "")
                else
                  -- 2. Intentar buscar un número decimal típico de dial FM (ej: "CSR 103.9" -> 103.9 FM)
                  local freqNum = string.match(rawName, "(%d%d?%d?%.%d+)")
                  if freqNum then
                    frequency = freqNum .. " FM"
                  end
                end

                -- Extraer valor numérico para ordenar las estaciones por dial (ej: 89.9 < 102.9)
                if frequency then
                  local numStr = string.match(frequency, "(%d%d?%d?%.?%d*)")
                  freqNumeric = tonumber(numStr) or 0
                end
              end

              if cleanTitle == "" then cleanTitle = rawName end

              table.insert(list, {
                path = filepath,
                filename = filename,
                title = cleanTitle,
                frequency = frequency,
                freqNum = freqNumeric
              })
            end
          end
        end
      end
    end
  end

  return list
end

-- ----------------------------------------------------------------------------
-- PUBLIC API (Consumida por AngularJS via bngApi.engineLua)
-- ----------------------------------------------------------------------------

--- Obtiene la lista de canciones personales desde 'music_mp3/'.
-- @return table: Array de canciones disponibles
function M.getMp3List()
  local searchDirs = {
    "/mods/unpacked/DynamicRadio/music_mp3/",
    "/mods/DynamicRadio/music_mp3/",
    "/mods/unpacked/DynamicRadio/music/",
    "/mods/DynamicRadio/music/"
  }
  local list = scanAudioDir(searchDirs, false)
  table.sort(list, function(a, b)
    return (a.title or ""):lower() < (b.title or ""):lower()
  end)
  return list
end

--- Obtiene la lista de emisiones de radio desde 'music_radio/'.
-- Asigna frecuencias de dial por defecto si la estación no tiene una definida en el nombre.
-- @return table: Array de estaciones disponibles con frecuencia FM
function M.getRadioList()
  local searchDirs = {
    "/mods/unpacked/DynamicRadio/music_radio/",
    "/mods/DynamicRadio/music_radio/"
  }
  local list = scanAudioDir(searchDirs, true)

  -- Frecuencias de dial FM simuladas para estaciones sin frecuencia en el nombre
  local defaultFrequencies = {
    "88.9 FM", "91.5 FM", "94.7 FM", "98.3 FM",
    "101.1 FM", "102.7 FM", "103.9 FM", "105.5 FM", "107.1 FM"
  }

  for i, item in ipairs(list) do
    if not item.frequency or item.frequency == "" then
      local fIdx = ((i - 1) % #defaultFrequencies) + 1
      item.frequency = defaultFrequencies[fIdx]
      local numStr = string.match(item.frequency, "(%d%d?%d?%.?%d*)")
      item.freqNum = tonumber(numStr) or 0
    end
  end

  -- Ordenar las emisoras numéricamente por su dial FM (de menor a mayor MHz)
  table.sort(list, function(a, b)
    if (a.freqNum or 0) ~= (b.freqNum or 0) then
      return (a.freqNum or 0) < (b.freqNum or 0)
    end
    return (a.title or "") < (b.title or "")
  end)

  return list
end

-- Aliases para retrocompatibilidad
function M.getMusicList()
  return M.getMp3List()
end

function M.getStations()
  return M.getRadioList()
end

-- ----------------------------------------------------------------------------
-- BEAMNG ENGINE HOOKS (Detección de eventos del juego)
-- ----------------------------------------------------------------------------

M.onVehicleSwitched = function(oid, nid, player)
  notifyVehicleState()
end

M.onCameraChanged = function()
  notifyVehicleState()
end

M.onVehicleResetted = function(vehicleID)
  notifyVehicleState()
end

M.onExtensionLoaded = function()
  log("I", "dynamicRadio", "DynamicRadio Local Extension Loaded successfully.")
end

-- Registro global en el entorno GE Lua
rawset(_G, "dynamicRadio", M)
if extensions then
  extensions.dynamicRadio = M
end

return M
