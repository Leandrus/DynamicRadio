/**
 * ============================================================================
 * Dynamic Radio - BeamNG.drive HUD Car Stereo UI App
 * ============================================================================
 * Directiva AngularJS para el reproductor HUD estéreo de vehículos.
 * 
 * Características principales:
 * - Reproducción 100% local a través del sistema de archivos virtual VFS.
 * - Modo dual: MP3 (música personal) y RADIO (emisoras/grabaciones simuladas con dial FM).
 * - Detección automática del vehículo: se oculta al bajar del auto y pausa el audio.
 * - Pantalla LCD retroiluminada con ecualizador animado, reloj en tiempo real y selector de volumen.
 * - Modo aleatorio (Shuffle) para la lista MP3.
 * ============================================================================
 */

angular.module('beamng.apps')
.directive('dynamicRadio', ['$log', '$timeout', function ($log, $timeout) {
  return {
    templateUrl: '/ui/modules/apps/DynamicRadio/app.html',
    replace: true,
    restrict: 'EA',
    scope: true,
    controller: ['$scope', '$element', function ($scope, $element) {
      'use strict';

      // ----------------------------------------------------------------------
      // Motor de Audio HTML5
      // ----------------------------------------------------------------------
      var audio = new Audio();
      audio.preload = 'auto';
      var trackPlayStartTime = 0;         // Timestamp del momento en que empezó a sonar la pista actual

      // ----------------------------------------------------------------------
      // Estado del Componente
      // ----------------------------------------------------------------------
      $scope.isPoweredOn = true;          // Estado encendido/apagado del estéreo
      $scope.inVehicle = true;            // Si el jugador está dentro de un vehículo
      $scope.isEditingMode = false;       // Modo edición de interfaz (para posicionar la app)
      $scope.isTaxi = false;              // Si el jugador está en un taxi (bloqueo de controles)
      $scope.mode = 'MP3';                // Modo activo: 'MP3' o 'RADIO'
      $scope.isPlaying = false;           // Si hay audio reproduciéndose actualmente
      $scope.volume = 0.75;               // Nivel de volumen (0.0 a 1.0)
      $scope.statusText = 'LISTO';        // Texto de estado en la barra superior LCD
      $scope.displayTitle = 'DYNAMIC STEREO'; // Título de la pista o emisora
      $scope.displaySubtitle = 'SELECCIONA PISTA'; // Subtítulo / dial FM
      $scope.infoLeft = '';               // Información inferior (número de pista / dial)
      $scope.clockTime = '12:00';         // Reloj digital en tiempo real
      $scope.isShuffle = false;           // Modo aleatorio (exclusivo para MP3)

      $scope.mp3List = [];                // Lista de pistas en music_mp3/
      $scope.currentMp3Idx = 0;           // Índice de pista MP3 activa

      $scope.radioList = [];              // Lista de emisiones en music_radio/
      $scope.currentRadioIdx = 0;         // Índice de estación de radio activa

      var wasPlayingBeforeExit = false;   // Guarda si estaba sonando antes de bajar del auto

      // ----------------------------------------------------------------------
      // Inicialización y Carga de la Extensión Lua
      // ----------------------------------------------------------------------
      /**
       * Garantiza que la extensión Lua esté registrada en el motor de BeamNG.
       * @param {function} cb Callback al finalizar
       */
      function ensureLuaBackend(cb) {
        var code = '(function()' +
          ' local src = readFile("lua/ge/extensions/dynamicRadio.lua") or readFile("/mods/unpacked/DynamicRadio/lua/ge/extensions/dynamicRadio.lua");' +
          ' if src then' +
          '   local fn = loadstring(src);' +
          '   if fn then' +
          '     local ok, m = pcall(fn);' +
          '     if ok and m then' +
          '       rawset(_G, "dynamicRadio", m);' +
          '       if extensions then extensions.dynamicRadio = m end;' +
          '       return true;' +
          '     end;' +
          '   end;' +
          ' end;' +
          ' return false;' +
          'end)()';
        bngApi.engineLua(code, function () {
          if (typeof cb === 'function') cb();
        });
      }

      // ----------------------------------------------------------------------
      // Controladores de Eventos del Elemento Audio HTML5
      // ----------------------------------------------------------------------
      audio.onplaying = function () {
        trackPlayStartTime = Date.now();
        $scope.$evalAsync(function () {
          $scope.isPlaying = true;
          $scope.statusText = $scope.isTaxi ? 'TAXI' : (($scope.mode === 'RADIO') ? 'EN VIVO' : 'PLAY');
        });
      };

      audio.onpause = function () {
        $scope.$evalAsync(function () {
          $scope.isPlaying = false;
          if ($scope.isPoweredOn) {
            $scope.statusText = $scope.isTaxi ? 'TAXI' : 'PAUSA';
          }
        });
      };

      audio.onwaiting = function () {
        $scope.$evalAsync(function () {
          $scope.statusText = 'CARGANDO...';
        });
      };

      audio.onerror = function () {
        $scope.$evalAsync(function () {
          $scope.isPlaying = false;
          $scope.statusText = 'ERROR AUDIO';
          $log.warn('DynamicRadio audio error on src:', audio.src, audio.error);
        });
      };

      audio.onended = function () {
        $scope.$evalAsync(function () {
          // Protección contra falsos onended inmediatos (seeks no soportados o búfer vacío en CEF):
          // Una pista solo se considera terminada si estuvo reproduciéndose al menos 3 segundos reales.
          var elapsed = Date.now() - trackPlayStartTime;
          if (!trackPlayStartTime || elapsed < 3000) {
            return;
          }

          if ($scope.isPoweredOn) {
            // Avanza automáticamente a la siguiente emisora/pista al finalizar de verdad
            advanceTrackInternal();
          } else {
            $scope.isPlaying = false;
            $scope.statusText = 'FIN';
          }
        });
      };

      // ----------------------------------------------------------------------
      // Gestión de Volumen
      // ----------------------------------------------------------------------
      /**
       * Aplica el volumen del slider al elemento HTML5 audio.
       */
      $scope.applyVolume = function () {
        if ($scope.isTaxi) return;
        var v = Math.max(0, Math.min(1, parseFloat($scope.volume) || 0));
        $scope.volume = v;
        audio.volume = v;
      };

      // ----------------------------------------------------------------------
      // Encendido / Apagado (Power)
      // ----------------------------------------------------------------------
      /**
       * Alterna el encendido del estéreo del auto.
       */
      $scope.togglePower = function () {
        if ($scope.isTaxi) return;
        $scope.isPoweredOn = !$scope.isPoweredOn;
        if (!$scope.isPoweredOn) {
          audio.pause();
          $scope.isPlaying = false;
          $scope.statusText = 'OFF';
        } else {
          $scope.updateDisplay();
          $scope.playCurrent();
        }
      };

      // ----------------------------------------------------------------------
      // Selector de Modo (MP3 / RADIO)
      // ----------------------------------------------------------------------
      /**
       * Alterna entre reproducción de MP3 local y Radio simulada.
       */
      $scope.toggleMode = function () {
        if ($scope.isTaxi || !$scope.isPoweredOn) return;
        var wasPlaying = $scope.isPlaying;
        audio.pause();

        $scope.mode = ($scope.mode === 'MP3') ? 'RADIO' : 'MP3';
        $scope.updateDisplay();

        if (wasPlaying) {
          $scope.playCurrent();
        }
      };

      // ----------------------------------------------------------------------
      // Actualización de la Pantalla LCD
      // ----------------------------------------------------------------------
      /**
       * Actualiza la información visible en la pantalla LCD según el modo y pista actual.
       */
      $scope.updateDisplay = function () {
        if (!$scope.isPoweredOn) return;

        if ($scope.mode === 'MP3') {
          if ($scope.mp3List.length > 0) {
            var track = $scope.mp3List[$scope.currentMp3Idx];
            $scope.displayTitle = (track.title || track.filename).toUpperCase();
            $scope.displaySubtitle = 'PISTA ' + ($scope.currentMp3Idx + 1) + ' DE ' + $scope.mp3List.length;
            $scope.infoLeft = 'MP3 ' + ($scope.currentMp3Idx + 1) + '/' + $scope.mp3List.length;
          } else {
            $scope.displayTitle = 'CARPETA VACIA';
            $scope.displaySubtitle = 'COLOCA TUS CANCIONES EN MUSIC_MP3';
            $scope.infoLeft = 'MP3 0/0';
          }
        } else {
          if ($scope.radioList.length > 0) {
            var st = $scope.radioList[$scope.currentRadioIdx];
            $scope.displayTitle = (st.title || st.filename).toUpperCase();
            $scope.displaySubtitle = (st.frequency || 'FM STEREO') + ($scope.isTaxi ? ' • TAXI' : '');
            $scope.infoLeft = (st.frequency ? st.frequency + ' • ' : '') + 'DIAL ' + ($scope.currentRadioIdx + 1) + '/' + $scope.radioList.length;
          } else {
            $scope.displayTitle = 'SIN EMISORAS';
            $scope.displaySubtitle = 'COLOCA AUDIOS EN MUSIC_RADIO';
            $scope.infoLeft = 'RADIO 0/0';
          }
        }

        if ($scope.isTaxi) {
          $scope.statusText = 'TAXI';
        }
      };

      // ----------------------------------------------------------------------
      // Reproducción y Navegación de Pistas
      // ----------------------------------------------------------------------
      /**
       * Carga y reproduce el elemento actualmente seleccionado.
       */
      $scope.playCurrent = function () {
        if (!$scope.isPoweredOn) return;

        var item = null;
        if ($scope.mode === 'MP3') {
          if ($scope.mp3List.length > 0) {
            item = $scope.mp3List[$scope.currentMp3Idx];
          }
        } else {
          if ($scope.radioList.length > 0) {
            item = $scope.radioList[$scope.currentRadioIdx];
          }
        }

        if (item && item.path) {
          try {
            audio.pause();
            trackPlayStartTime = Date.now();
            audio.src = item.path;
            audio.load();
            $scope.applyVolume();
            var playPromise = audio.play();
            if (playPromise !== undefined) {
              playPromise.catch(function (err) {
                // Si la promesa fue interrumpida por un cambio rápido de pista o auto, no mostrar error
                if (err && (err.name === 'AbortError' || err.code === 20)) return;
                $scope.$evalAsync(function () {
                  $scope.isPlaying = false;
                  $scope.statusText = 'PAUSA';
                });
              });
            }
          } catch (e) {
            $log.error('DynamicRadio error playing:', e);
          }
        } else {
          $scope.statusText = 'SIN PISTAS';
        }

        $scope.updateDisplay();
      };

      /**
       * Avanza internamente a la siguiente pista o emisora (usado por el reproductor al terminar un audio).
       */
      function advanceTrackInternal() {
        if (!$scope.isPoweredOn) return;

        if ($scope.mode === 'MP3') {
          if ($scope.mp3List.length > 0) {
            if ($scope.isShuffle && $scope.mp3List.length > 1) {
              var nextIdx = Math.floor(Math.random() * $scope.mp3List.length);
              while (nextIdx === $scope.currentMp3Idx) {
                nextIdx = Math.floor(Math.random() * $scope.mp3List.length);
              }
              $scope.currentMp3Idx = nextIdx;
            } else {
              $scope.currentMp3Idx = ($scope.currentMp3Idx + 1) % $scope.mp3List.length;
            }
            $scope.updateDisplay();
            $scope.playCurrent();
          }
        } else {
          if ($scope.radioList.length > 0) {
            $scope.currentRadioIdx = ($scope.currentRadioIdx + 1) % $scope.radioList.length;
            $scope.updateDisplay();
            $scope.playCurrent();
          }
        }
      }

      /**
       * Alterna entre Reproducir y Pausar (Bloqueado en Taxi).
       */
      $scope.togglePlay = function () {
        if ($scope.isTaxi || !$scope.isPoweredOn) return;

        if ($scope.isPlaying) {
          audio.pause();
        } else {
          if (!audio.src || audio.src === '' || audio.src === window.location.href) {
            $scope.playCurrent();
          } else {
            audio.play().catch(function () {
              $scope.playCurrent();
            });
          }
        }
      };

      /**
       * Pasa a la siguiente canción o dial de radio (Bloqueado en Taxi).
       */
      $scope.nextTrack = function () {
        if ($scope.isTaxi || !$scope.isPoweredOn) return;
        advanceTrackInternal();
      };

      /**
       * Retrocede a la canción o dial de radio anterior (Bloqueado en Taxi).
       */
      $scope.prevTrack = function () {
        if ($scope.isTaxi || !$scope.isPoweredOn) return;

        if ($scope.mode === 'MP3') {
          if ($scope.mp3List.length > 0) {
            $scope.currentMp3Idx = ($scope.currentMp3Idx - 1 + $scope.mp3List.length) % $scope.mp3List.length;
            $scope.updateDisplay();
            $scope.playCurrent();
          }
        } else {
          if ($scope.radioList.length > 0) {
            $scope.currentRadioIdx = ($scope.currentRadioIdx - 1 + $scope.radioList.length) % $scope.radioList.length;
            $scope.updateDisplay();
            $scope.playCurrent();
          }
        }
      };

      /**
       * Alterna el modo aleatorio (Shuffle) para canciones MP3 (Bloqueado en Taxi).
       */
      $scope.toggleShuffle = function () {
        if ($scope.isTaxi) return;
        $scope.isShuffle = !$scope.isShuffle;
      };

      // ----------------------------------------------------------------------
      // Estado de Carga y Cambio de Vehículo
      // ----------------------------------------------------------------------
      var currentVehicleId = null;        // ID del vehículo actual del jugador
      var listsLoaded = false;            // Bandera que indica si las listas están cargadas
      var pendingAutoPlayOnCarSwitch = false; // Reproducción diferida si aún no cargan las listas

      // ----------------------------------------------------------------------
      // Recarga de Listas desde el Sistema de Archivos
      // ----------------------------------------------------------------------
      /**
       * Consulta a la extensión Lua para escanear music_mp3/ y music_radio/.
       * @param {function} cb Callback opcional tras recargar
       */
      $scope.reloadAll = function (cb) {
        if ($scope.isTaxi && typeof cb !== 'function') return;

        ensureLuaBackend(function () {
          bngApi.engineLua('extensions.dynamicRadio.getMp3List()', function (mp3Data) {
            bngApi.engineLua('extensions.dynamicRadio.getRadioList()', function (radioData) {
              $scope.$evalAsync(function () {
                if (Array.isArray(mp3Data)) {
                  $scope.mp3List = mp3Data;
                  if ($scope.mp3List.length > 0) {
                    $scope.currentMp3Idx = Math.floor(Math.random() * $scope.mp3List.length);
                  } else {
                    $scope.currentMp3Idx = 0;
                  }
                }
                if (Array.isArray(radioData)) {
                  $scope.radioList = radioData;
                  if ($scope.radioList.length > 0) {
                    $scope.currentRadioIdx = Math.floor(Math.random() * $scope.radioList.length);
                  } else {
                    $scope.currentRadioIdx = 0;
                  }
                }
                listsLoaded = true;
                $scope.updateDisplay();

                // Si ocurrió un cambio de auto antes de terminar la carga, ejecutar ahora
                if (pendingAutoPlayOnCarSwitch) {
                  pendingAutoPlayOnCarSwitch = false;
                  playRandomOnCarSwitch();
                }

                if (typeof cb === 'function') cb();
              });
            });
          });
        });
      };

      // ----------------------------------------------------------------------
      // Reloj Digital
      // ----------------------------------------------------------------------
      function updateClock() {
        var d = new Date();
        var h = String(d.getHours()).padStart(2, '0');
        var m = String(d.getMinutes()).padStart(2, '0');
        $scope.clockTime = h + ':' + m;
      }
      updateClock();
      var clockTimer = setInterval(function () {
        $scope.$evalAsync(updateClock);
      }, 1000);

      // ----------------------------------------------------------------------
      // Autoreproducción Aleatoria al Cambiar de Auto
      // ----------------------------------------------------------------------
      var lastCarSwitchTime = 0;

      /**
       * Selecciona el modo y reproduce automáticamente:
       * - En Taxi (pasajero): SIEMPRE modo 'RADIO' de forma obligatoria y aleatoria.
       * - En coche normal: 50% de probabilidad aleatoria entre 'RADIO' o 'MP3'.
       */
      function playRandomOnCarSwitch() {
        var now = Date.now();
        if (now - lastCarSwitchTime < 1500) {
          return;
        }
        lastCarSwitchTime = now;

        if (!$scope.isPoweredOn) {
          $scope.isPoweredOn = true;
        }

        var hasMp3 = ($scope.mp3List && $scope.mp3List.length > 0);
        var hasRadio = ($scope.radioList && $scope.radioList.length > 0);

        if (!hasMp3 && !hasRadio) {
          $scope.updateDisplay();
          return;
        }

        var pickedMode = 'MP3';
        if ($scope.isTaxi) {
          // En modo taxi: reproducción obligatoria y exclusiva de RADIO
          pickedMode = hasRadio ? 'RADIO' : (hasMp3 ? 'MP3' : 'RADIO');
        } else if (hasMp3 && hasRadio) {
          // Vehículo normal: 50% MP3 / 50% RADIO
          pickedMode = (Math.random() < 0.5) ? 'MP3' : 'RADIO';
        } else if (hasRadio) {
          pickedMode = 'RADIO';
        } else {
          pickedMode = 'MP3';
        }

        $scope.mode = pickedMode;

        // Selección aleatoria de pista o dial dentro del modo elegido
        if (pickedMode === 'MP3' && hasMp3) {
          if ($scope.mp3List.length > 1) {
            var newMp3Idx = Math.floor(Math.random() * $scope.mp3List.length);
            if (newMp3Idx === $scope.currentMp3Idx) {
              newMp3Idx = (newMp3Idx + 1) % $scope.mp3List.length;
            }
            $scope.currentMp3Idx = newMp3Idx;
          } else {
            $scope.currentMp3Idx = 0;
          }
        } else if (pickedMode === 'RADIO' && hasRadio) {
          if ($scope.radioList.length > 1) {
            var newRadioIdx = Math.floor(Math.random() * $scope.radioList.length);
            if (newRadioIdx === $scope.currentRadioIdx) {
              newRadioIdx = (newRadioIdx + 1) % $scope.radioList.length;
            }
            $scope.currentRadioIdx = newRadioIdx;
          } else {
            $scope.currentRadioIdx = 0;
          }
        }

        wasPlayingBeforeExit = false;
        $scope.updateDisplay();
        $scope.playCurrent();
      }

      // ----------------------------------------------------------------------
      // Detección y Control de Estado de Vehículo
      // ----------------------------------------------------------------------
      function handleVehicleState(inVeh, vehicleId, isTaxi) {
        $scope.$evalAsync(function () {
          var prevInVeh = $scope.inVehicle;
          var prevIsTaxi = $scope.isTaxi;
          $scope.inVehicle = !!inVeh;
          $scope.isTaxi = !!isTaxi;
          var vehId = (typeof vehicleId === 'number') ? vehicleId : -1;

          if (!inVeh || vehId === -1) {
            // El jugador bajó del vehículo o está a pie (walk mode) -> pausar estéreo
            if ($scope.isPlaying) {
              wasPlayingBeforeExit = true;
              audio.pause();
            }
            return;
          }

          var isSameVehicle = (currentVehicleId !== null && currentVehicleId === vehId);
          var isSameTaxi = (prevIsTaxi === $scope.isTaxi);

          if (isSameVehicle && isSameTaxi) {
            // Mismo vehículo y mismo modo: reanudar si el jugador se había bajado y volvió a subir
            if (!prevInVeh && wasPlayingBeforeExit && $scope.isPoweredOn) {
              wasPlayingBeforeExit = false;
              audio.play().catch(function () {});
            }
            return;
          }

          // El jugador subió a un auto diferente, primera vez, o cambió estado de taxi
          var taxiEnded = (prevIsTaxi && !$scope.isTaxi);
          currentVehicleId = vehId;
          wasPlayingBeforeExit = false;

          if (taxiEnded) {
            // Finalizó el viaje como pasajero: restaurar visualización normal y controles
            $scope.updateDisplay();
          }

          if (listsLoaded) {
            playRandomOnCarSwitch();
          } else {
            pendingAutoPlayOnCarSwitch = true;
          }
        });
      }

      function checkVehicleState() {
        bngApi.engineLua('extensions.dynamicRadio.getVehicleState()', function (data) {
          if (data && typeof data.inVehicle === 'boolean') {
            handleVehicleState(data.inVehicle, data.vehicleId, data.isTaxi);
          }
        });
      }

      // ----------------------------------------------------------------------
      // Listeners de Eventos de BeamNG
      // ----------------------------------------------------------------------
      $scope.$on('appContainer:editMode', function (event, enabled) {
        $scope.$evalAsync(function () {
          $scope.isEditingMode = !!enabled;
        });
      });

      $scope.$on('DynamicRadioVehicleState', function (event, data) {
        if (data && typeof data.inVehicle === 'boolean') {
          handleVehicleState(data.inVehicle, data.vehicleId, data.isTaxi);
        }
      });

      $scope.$on('VehicleFocusChanged', function () {
        checkVehicleState();
      });

      $scope.$on('onVehicleSwitched', function () {
        checkVehicleState();
      });

      $scope.$on('onTaxiViewEnter', function () {
        checkVehicleState();
      });

      $scope.$on('onTaxiRideChanged', function () {
        checkVehicleState();
      });

      $scope.$on('OverhaulPassengerMode', function () {
        checkVehicleState();
      });

      // Chequeo periódico de seguridad para el estado del vehículo (cada 2 segundos)
      var vehicleCheckTimer = setInterval(checkVehicleState, 2000);

      // ----------------------------------------------------------------------
      // Inicialización de la Aplicación
      // ----------------------------------------------------------------------
      $scope.applyVolume();
      $scope.reloadAll(function () {
        checkVehicleState();
      });

      // ----------------------------------------------------------------------
      // Limpieza al Destruir la App
      // ----------------------------------------------------------------------
      $scope.$on('$destroy', function () {
        clearInterval(clockTimer);
        clearInterval(vehicleCheckTimer);
        try {
          audio.pause();
          audio.src = '';
        } catch (e) {}
      });
    }]
  };
}]);
