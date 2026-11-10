# 📻 Dynamic Radio & Car Stereo for BeamNG.drive

[![BeamNG Version](https://img.shields.io/badge/BeamNG.drive-v0.30%2B-orange.svg)](https://beamng.com)
[![Mod Version](https://img.shields.io/badge/version-2.0.0-blue.svg)]()
[![Platform](https://img.shields.io/badge/platform-Windows%20x64-lightgrey.svg)]()
[![License](https://img.shields.io/badge/license-MIT-green.svg)]()

**Dynamic Radio** es un estéreo para tablero HUD (estilo 1-DIN compacto) diseñado para **BeamNG.drive**. Ofrece una experiencia inmersiva y fluida de reproducción de audio local y estaciones de radio simuladas con dial FM, superando todas las limitaciones del sandbox de red del juego con 0ms de latencia y cero consumo de ancho de banda.

---

## 🌟 Características Principales

- **Diseño Compacto 1-DIN para Tablero:** Interfaz minimalista de 320x105 px que encaja perfectamente en cualquier HUD sin tapar la visión del conductor.
- **Pantalla LCD Digital Retroiluminada:** Muestra el título de la canción/emisora, dial FM, reloj digital en tiempo real, barras animadas de ecualizador y porcentaje de volumen.
- **Modo Dual (`SRC`):**
  - **`MP3 DISC`:** Reproduce tu colección personal de canciones con soporte para orden aleatorio (**`🔀`**).
  - **`FM RADIO`:** Simula sintonización de radio real con diales FM ordenados numéricamente (ej. *89.9 FM*, *91.5 FM*, *102.9 FM*).
- **Detección Automática de Vehículo & Autoreproducción Inteligente:**
  - Se muestra únicamente cuando el jugador está conduciendo un vehículo.
  - Se oculta y pausa automáticamente cuando el jugador baja a pie (modo caminar).
  - **Autoreproducción aleatoria al cambiar de auto:** Siempre que te subes a un auto diferente o cambias de vehículo, el estéreo se enciende y reproduce automáticamente seleccionando al azar entre el modo **`FM RADIO`** o **`MP3 DISC`**, y escogiendo una pista o emisora aleatoria.
  - Si bajas a pie y vuelves a subir al mismo auto, reanuda la canción exactamente donde estaba.
  - **Modo Taxi Inmersivo (Sin Control del Pasajero):** Cuando subes a un taxi (viajes en taxi de Carrera / RLS Overhaul o configuraciones de vehículo Taxi), la reproducción se bloquea exclusivamente en **`FM RADIO`** (sintonizando una emisora real al azar) y todos los controles de la interfaz quedan deshabilitados con el distintivo **`TAXI RADIO`**, simulando que el control de la radio pertenece exclusivamente al conductor del taxi.
- **Conversor y Estandarizador Integrado (`_convertir_a_mp3.bat`):**
  - Script incluido en las carpetas de música para convertir automáticamente con un solo clic cualquier formato de audio (`.m4a`, `.aac`, `.opus`, `.ogg`, `.flac`, `.wav`, `.wma`) a MP3 de alta fidelidad (VBR q2).
  - Elimina los archivos temporales y estandariza los nombres de archivo al formato limpio `Artista - Canción.mp3`.
- **Rendimiento y Privacidad 100% Local:** Cero conexiones a internet, cero problemas de buffering o cortafuegos, compatible con el VFS nativo de BeamNG.

---

## 📁 Estructura del Mod

```
DynamicRadio/
├── .gitignore                                # Filtros de git para repositorios limpios
├── mod_info.json                             # Manifiesto y metadatos del mod
├── README.md                                 # Documentación
├── lua/
│   └── ge/extensions/
│       └── dynamicRadio.lua                 # Backend GE Lua: Detección de vehículo y escáner
├── scripts/
│   └── dynamicRadio/
│       └── modScript.lua                    # Inicialización y montaje VFS
├── ui/modules/apps/DynamicRadio/
│   ├── app.json                             # Metadatos de la UI App
│   ├── app.html                             # Plantilla visual y estilos CSS 1-DIN
│   ├── app.js                               # Controlador AngularJS y motor HTML5 Audio
│   └── app.png                              # Icono de la app en BeamNG
├── music_mp3/                               # Directorio de música personal
│   ├── _convertir_a_mp3.bat                 # Conversor y formateador automático
│   └── LEEME_INSTRUCCIONES.txt
└── music_radio/                             # Directorio de emisoras simuladas
    ├── _convertir_a_mp3.bat                 # Conversor y formateador de diales
    └── LEEME_INSTRUCCIONES.txt
```

---

## 🚀 Instalación

1. Clona o descarga este repositorio.
2. Copia la carpeta `DynamicRadio` en el directorio de mods desempaquetados de BeamNG.drive:
   ```
   %LOCALAPPDATA%\BeamNG.drive\current\mods\unpacked\DynamicRadio
   ```
   *(O compáctalo en un archivo `.zip` y colócalo dentro de `mods/`)*.
3. Abre el juego, ve a cualquier mapa y presiona **Esc** > **UI Apps** > **Añadir App**.
4. Busca y selecciona **Dynamic Radio**.

---

## 🎵 Cómo Agregar Música y Emisoras

### 1. Canciones personales (`music_mp3/`)
1. Pega tus canciones favoritas dentro de `music_mp3/`.
2. Si tienes archivos `.m4a`, `.aac`, `.opus`, `.flac`, `.ogg` o `.wav`, haz doble clic en:
   ```
   music_mp3/_convertir_a_mp3.bat
   ```
3. El script convertirá todo a MP3 de alta fidelidad, eliminará los archivos viejos y limpiará los nombres de archivo automáticamente.

### 2. Emisoras de radio (`music_radio/`)
1. Pega programas completos de radio, cuñas o podcasts dentro de `music_radio/`.
2. Puedes incluir la frecuencia en el nombre del archivo para que la pantalla LCD la sintonice automáticamente:
   - `102.9 FM - Flash FM.mp3`
   - `91.5 FM - K-DST.mp3`
   - `103.9 FM - CSR.mp3`
3. Si los audios están en otro formato, haz doble clic en `music_radio/_convertir_a_mp3.bat`.

---

## 🎛️ Controles del Estéreo

| Botón | Función |
| :---: | :--- |
| **`PWR`** | Enciende o apaga el estéreo. |
| **`SRC: MP3 / RADIO`** | Alterna entre música personal y emisoras de radio. |
| **`|◄◄`** | Pista anterior o dial FM hacia atrás. |
| **`► / ❚❚`** | Reproducir o Pausar audio. |
| **`►►|`** | Siguiente pista o dial FM hacia adelante. |
| **`🔀`** | Activa o desactiva la reproducción aleatoria (modo MP3). |
| **`⟳`** | Recarga las carpetas de música sin necesidad de reiniciar el juego. |
| **Slider** | Ajuste fluido de volumen (0% a 100%). |

---

## 🔒 Auditoría de Seguridad y Privacidad

- **Sin Conexiones Externas:** El mod no realiza peticiones HTTP, sockets de red, telemetría ni comunicación externa.
- **Sin Credenciales ni Tokens:** No almacena ni requiere claves API, contraseñas ni tokens personales.
- **Protección de Copyright:** El archivo `.gitignore` excluye deliberadamente todos los archivos de audio binarios (`.mp3`, `.m4a`, etc.) para evitar subir música con derechos de autor a repositorios públicos.
- **Rutas Relativas VFS:** Todo el código fuente utiliza rutas virtuales relativas (`/mods/unpacked/DynamicRadio/`), sin filtrar rutas absolutas ni nombres de usuario del sistema operativo local.

---

## 🛠️ Requisitos

- **Juego:** BeamNG.drive v0.28 o superior (probado en v0.40+).
- **Para los scripts de conversión:** [FFmpeg](https://ffmpeg.org) instalado en Windows (`winget install Gyan.FFmpeg`).

---

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT**. Eres libre de modificarlo, adaptarlo y redistribuirlo citando al autor original.

