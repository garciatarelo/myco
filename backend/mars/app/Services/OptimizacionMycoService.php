<?php

namespace App\Services;

use App\Models\Capsula;
use App\Models\Robot;
use App\Models\MedicionSuelo;

class OptimizacionMycoService
{
    /**
     * Evalúa las condiciones del suelo y determina el grado óptimo de cápsula y justificación.
     */
    public function evaluarCondicionesSuelo(float $humedad, float $ph, float $temperatura): array
    {
        // Rango de pH ideal para micorrizas: 5.5 - 7.5
        $phOptimo = ($ph >= 5.5 && $ph <= 7.8);

        if ($humedad < 20.0) {
            return [
                'es_optimo' => false,
                'grado_recomendado' => 'ninguno',
                'ahorro_recursos' => 100.0,
                'expansion_estimada_cm' => 0.0,
                'justificacion' => 'Humedad crítica (<20%). Se omite la inyección para ahorrar recursos y evitar pérdida de esporas.',
            ];
        }

        if ($humedad >= 65.0 && $phOptimo) {
            return [
                'es_optimo' => true,
                'grado_recomendado' => 'alto',
                'ahorro_recursos' => 35.0, // Alta eficiencia por volumen colonizado
                'expansion_estimada_cm' => round(35.0 + ($humedad - 65.0) * 0.4, 2),
                'justificacion' => sprintf(
                    'Alta humedad (%.1f%%) y pH favorable (%.2f). Punto óptimo para cápsula Grado Alto para máxima colonización y expansión micelar.',
                    $humedad,
                    $ph
                ),
            ];
        }

        if ($humedad >= 40.0) {
            return [
                'es_optimo' => true,
                'grado_recomendado' => 'medio',
                'ahorro_recursos' => 50.0,
                'expansion_estimada_cm' => round(20.0 + ($humedad - 40.0) * 0.5, 2),
                'justificacion' => sprintf(
                    'Humedad moderada (%.1f%%). Grado Medio recomendado para optimizar recursos y mantener crecimiento sostenido.',
                    $humedad
                ),
            ];
        }

        // 20% - 39.9%
        return [
            'es_optimo' => true,
            'grado_recomendado' => 'minimo',
            'ahorro_recursos' => 70.0,
            'expansion_estimada_cm' => round(10.0 + ($humedad - 20.0) * 0.4, 2),
            'justificacion' => sprintf(
                'Humedad baja (%.1f%%). Grado Mínimo seleccionado para proteger el recurso y permitir micorrización básica.',
                $humedad
            ),
        ];
    }

    /**
     * Recomienda el punto óptimo entre dos coordenadas o a lo largo de un segmento,
     * identificando dónde la humedad es más propicia para inyectar.
     */
    public function recomendarPuntoOptimoEntreCoordenadas(
        float $lat1,
        float $lon1,
        float $lat2,
        float $lon2,
        ?int $terrenoId = null
    ): array {
        // Muestrear 5 puntos intermedios
        $puntos = [];
        $muestras = 5;

        for ($i = 0; $i <= $muestras; $i++) {
            $t = $i / $muestras;
            $lat = round($lat1 + ($lat2 - $lat1) * $t, 6);
            $lon = round($lon1 + ($lon2 - $lon1) * $t, 6);

            // Buscar si hay mediciones cercanas reales
            $medicion = MedicionSuelo::when($terrenoId, fn($q) => $q->where('terreno_id', $terrenoId))
                ->orderByRaw("ABS(latitud - {$lat}) + ABS(longitud - {$lon}) ASC")
                ->first();

            $humedad = $medicion ? $medicion->humedad : (50.0 + sin($t * M_PI) * 30.0); // Simulación de gradiente
            $ph = $medicion ? $medicion->ph : 6.8;
            $temp = $medicion ? $medicion->temperatura : 21.0;

            $eval = $this->evaluarCondicionesSuelo($humedad, $ph, $temp);

            $puntos[] = [
                'lat' => $lat,
                'lon' => $lon,
                'humedad' => round($humedad, 1),
                'ph' => round($ph, 2),
                'temperatura' => round($temp, 1),
                'evaluacion' => $eval,
            ];
        }

        // Ordenar por mejor expansión y humedad
        usort($puntos, fn($a, $b) => $b['evaluacion']['expansion_estimada_cm'] <=> $a['evaluacion']['expansion_estimada_cm']);
        $mejorPunto = $puntos[0];

        return [
            'punto_optimo' => [
                'lat' => $mejorPunto['lat'],
                'lon' => $mejorPunto['lon'],
                'humedad' => $mejorPunto['humedad'],
                'ph' => $mejorPunto['ph'],
                'temperatura' => $mejorPunto['temperatura'],
            ],
            'grado_capsula' => $mejorPunto['evaluacion']['grado_recomendado'],
            'expansion_estimada_cm' => $mejorPunto['evaluacion']['expansion_estimada_cm'],
            'ahorro_recursos_pct' => $mejorPunto['evaluacion']['ahorro_recursos'],
            'justificacion' => $mejorPunto['evaluacion']['justificacion'],
            'todos_los_puntos' => $puntos,
        ];
    }

    /**
     * Determina la dotación óptima de cápsulas que un robot debe cargar según
     * la distancia proyectada y las condiciones del terreno para optimizar recursos.
     */
    public function calcularCargaOptimaCapsulas(Robot $robot, int $puntosRuta, float $humedadPromedio = 55.0): array
    {
        $capacidadMaxima = $robot->capacidad_capsulas > 0 ? $robot->capacidad_capsulas : 30;

        // Frecuencia de inyección estimada: cada ~3 puntos de recorrido
        $inyeccionesEstimadas = (int) ceil($puntosRuta / 3);
        $totalCargar = min($inyeccionesEstimadas, $capacidadMaxima);

        if ($humedadPromedio >= 65.0) {
            // Predominan cápsulas de grado alto
            $alto = (int) round($totalCargar * 0.6);
            $medio = (int) round($totalCargar * 0.3);
            $minimo = $totalCargar - ($alto + $medio);
        } elseif ($humedadPromedio >= 40.0) {
            // Predominan cápsulas de grado medio
            $medio = (int) round($totalCargar * 0.6);
            $alto = (int) round($totalCargar * 0.2);
            $minimo = $totalCargar - ($medio + $alto);
        } else {
            // Suelos más áridos: predominan grado mínimo y medio
            $minimo = (int) round($totalCargar * 0.6);
            $medio = (int) round($totalCargar * 0.3);
            $alto = $totalCargar - ($minimo + $medio);
        }

        return [
            'capacidad_maxima' => $capacidadMaxima,
            'capsulas_recomendadas_total' => $totalCargar,
            'distribucion' => [
                'minimo' => max(0, $minimo),
                'medio' => max(0, $medio),
                'alto' => max(0, $alto),
            ],
            'ahorro_peso_porcentaje' => round((($capacidadMaxima - $totalCargar) / $capacidadMaxima) * 100, 1),
            'recomendacion' => sprintf(
                'Carga optimizada: %d cápsulas (Mín: %d, Med: %d, Alto: %d). Ahorro de carga del robot: %.1f%%.',
                $totalCargar,
                max(0, $minimo),
                max(0, $medio),
                max(0, $alto),
                round((($capacidadMaxima - $totalCargar) / $capacidadMaxima) * 100, 1)
            ),
        ];
    }

    /**
     * Ejecuta una simulación temporal del comportamiento del micelio
     * bajo condiciones ideales, extremas o del Planeta Marte.
     */
    public function ejecutarSimulacionTemporal(
        string $nombre,
        string $entorno,
        string $tipoCondicion,
        int $duracionDias = 30,
        array $parametrosPersonalizados = []
    ): array {
        $timeline = [];
        $cobertura = 0.0;
        $supervivencia = 100.0;
        $biomasaGramos = 0.0;

        // Factores ambientales base
        $temp = $parametrosPersonalizados['temperatura'] ?? match ($tipoCondicion) {
            'marte' => -55.0, // Marte promedio nocturno/diurno
            'extrema' => 38.5, // Sequía extrema
            'ideal' => 22.0, // Ideal
            default => 20.0,
        };

        $humedad = $parametrosPersonalizados['humedad'] ?? match ($tipoCondicion) {
            'marte' => 8.0, // Muy seco / regolito
            'extrema' => 15.0,
            'ideal' => 75.0,
            default => 50.0,
        };

        $radiacionUV = match ($tipoCondicion) {
            'marte' => 'Extrema (250-400 nm sin capa de ozono)',
            'extrema' => 'Alta',
            'ideal' => 'Baja / controlada',
            default => 'Moderada',
        };

        $tasaCrecimientoDiario = match ($tipoCondicion) {
            'marte' => 0.4, // Crecimiento lento en regolito protegido con bio-cápsula
            'extrema' => 0.7,
            'ideal' => 3.2,
            default => 1.8,
        };

        $consumoCapsulas = [
            'minimo' => 0,
            'medio' => 0,
            'alto' => 0,
        ];

        for ($dia = 1; $dia <= $duracionDias; $dia++) {
            // Curvas dinámicas
            if ($tipoCondicion === 'marte') {
                // En Marte, el micelio encapsulado se aclimata tras el día 5
                $factorAdaptacion = $dia < 5 ? 0.3 : min(1.0, 0.4 + ($dia * 0.03));
                $cobertura += $tasaCrecimientoDiario * $factorAdaptacion;
                $supervivencia = max(68.0, 100.0 - ($dia * 0.9));
                $biomasaGramos += 1.8 * $factorAdaptacion;
                $consumoCapsulas['alto'] += ($dia % 4 == 0) ? 1 : 0;
            } elseif ($tipoCondicion === 'ideal') {
                // Exponencial
                $cobertura += $tasaCrecimientoDiario * (1 + $dia * 0.05);
                $supervivencia = min(99.5, 95.0 + ($dia * 0.15));
                $biomasaGramos += 5.4 + ($dia * 0.3);
                $consumoCapsulas['alto'] += ($dia % 3 == 0) ? 1 : 0;
                $consumoCapsulas['medio'] += ($dia % 2 == 0) ? 1 : 0;
            } else {
                // Extrema (sequía)
                $cobertura += $tasaCrecimientoDiario * 0.6;
                $supervivencia = max(52.0, 100.0 - ($dia * 1.5));
                $biomasaGramos += 0.9;
                $consumoCapsulas['minimo'] += ($dia % 2 == 0) ? 1 : 0;
            }

            if ($dia % 5 == 0 || $dia === $duracionDias) {
                $timeline[] = [
                    'dia' => $dia,
                    'cobertura_m2' => round($cobertura, 2),
                    'supervivencia_pct' => round($supervivencia, 1),
                    'biomasa_g' => round($biomasaGramos, 1),
                    'estado_hifas' => $dia < 10 ? 'inoculacion_temprana' : ($dia < 20 ? 'red_primaria' : 'micelacion_densa'),
                ];
            }
        }

        $resumen = [
            'nombre' => $nombre,
            'entorno' => $entorno,
            'tipo_condicion' => $tipoCondicion,
            'duracion_dias' => $duracionDias,
            'condiciones_ambientales' => [
                'temperatura_c' => $temp,
                'humedad_suelo_pct' => $humedad,
                'radiacion_uv' => $radiacionUV,
                'sustrato' => $entorno === 'marte' ? 'Regolito marciano tratado con biopolímeros' : 'Suelo fértil agrícola',
            ],
            'resultados' => [
                'cobertura_final_m2' => round($cobertura, 2),
                'tasa_supervivencia_final_pct' => round($supervivencia, 1),
                'biomasa_total_generada_g' => round($biomasaGramos, 1),
                'consumo_capsulas_estimado' => $consumoCapsulas,
                'viabilidad_biologica' => $supervivencia >= 60.0 ? 'Exitosa / Sostenible' : 'Requiere mayor aporte de humedad',
                'timeline' => $timeline,
            ],
        ];

        return $resumen;
    }
}
