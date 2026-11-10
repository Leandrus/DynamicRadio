-- ============================================================================
-- DynamicRadio Mod - Game Initialization Script (modScript.lua)
-- ============================================================================
-- Se ejecuta automáticamente cuando BeamNG.drive inicializa el mod.
-- Carga y registra la extensión Lua del motor del juego (GE Lua).
-- ============================================================================

-- Evitar que BeamNG descargue la extensión automáticamente al reiniciar escenarios
setExtensionUnloadMode('dynamicRadio', 'manual')

-- Cargar la extensión dynamicRadio.lua desde el sistema de archivos virtual (VFS)
local src = readFile("lua/ge/extensions/dynamicRadio.lua") or readFile("/mods/unpacked/DynamicRadio/lua/ge/extensions/dynamicRadio.lua")
if src then
  local fn = loadstring(src)
  if fn then
    local ok, m = pcall(fn)
    if ok and m then
      rawset(_G, "dynamicRadio", m)
      if extensions then
        extensions.dynamicRadio = m
      end
    end
  end
end

log('I', 'dynamicRadio', 'DynamicRadio modScript initialized successfully.')
