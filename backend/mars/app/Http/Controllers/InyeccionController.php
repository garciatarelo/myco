<?php

namespace App\Http\Controllers;

use App\Models\Capsula;
use App\Models\Inyeccion;
use App\Models\MedicionSuelo;
use App\Models\Robot;
use App\Services\OptimizacionMycoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class InyeccionController extends Controller
{
    /**
     * GET /api/inyecciones - Listar inyecciones realizadas
     */
    public function index(Request $request): JsonResponse
    {
        $query = Inyeccion::with(['robot', 'capsula', 'terreno', 'ruta']);

        if ($request->has('robot_id')) {
            $query->where('robot_id', $request->input('robot_id'));
        }

        if ($request->has('terreno_id')) {
            $query->where('terreno_id', $request->input('terreno_id'));
        }

        if ($request->has('grado_capsula')) {
            $query->where('grado_capsula', $request->input('grado_capsula'));
        }

        $inyecciones = $query->latest('fecha_inyeccion')->paginate($request->input('per_page', 50));
        return response()->json($inyecciones);
    }

    /**
     * POST /api/inyecciones - Registrar inyección directa
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'robot_id' => 'required|exists:robots,id',
            'capsula_id' => 'nullable|exists:capsulas,id',
            'terreno_id' => 'nullable|exists:terrenos,id',
            'ruta_id' => 'nullable|exists:rutas,id',
            'latitud' => 'required|numeric',
            'longitud' => 'required|numeric',
            'grado_capsula' => ['required', Rule::in(['minimo', 'medio', 'alto'])],
            'humedad_suelo_detectada' => 'nullable|numeric|between:0,100',
            'ph_detectado' => 'nullable|numeric|between:0,14',
            'temperatura_detectada' => 'nullable|numeric|between:-100,100',
            'expansion_micelio_estimada_cm' => 'nullable|numeric',
            'ahorro_recurso_porcentaje' => 'nullable|numeric',
            'justificacion_algoritmo' => 'nullable|string',
        ]);

        $robot = Robot::findOrFail($validated['robot_id']);

        // Consumir del inventario del robot si tiene disponibles
        $robot->consumirCapsula($validated['grado_capsula']);

        $validated['fecha_inyeccion'] = now();
        $inyeccion = Inyeccion::create($validated);

        return response()->json($inyeccion, 201);
    }

    /**
     * POST /api/inyecciones/ejecutar-optimizada
     * El Myco en modo inyección evalúa las condiciones del terreno, calcula el tipo de cápsula óptimo,
     * ahorra recursos y realiza la inoculación.
     */
    public function ejecutarOptimizada(Request $request, OptimizacionMycoService $optService): JsonResponse
    {
        $validated = $request->validate([
            'robot_id' => 'required|exists:robots,id',
            'latitud' => 'required|numeric',
            'longitud' => 'required|numeric',
            'terreno_id' => 'nullable|exists:terrenos,id',
            'ruta_id' => 'nullable|exists:rutas,id',
            'humedad' => 'nullable|numeric|between:0,100',
            'ph' => 'nullable|numeric|between:0,14',
            'temperatura' => 'nullable|numeric|between:-100,100',
        ]);

        $robot = Robot::findOrFail($validated['robot_id']);

        // Obtener o inferir condiciones del suelo
        $humedad = $validated['humedad'];
        $ph = $validated['ph'];
        $temp = $validated['temperatura'];

        if ($humedad === null || $ph === null || $temp === null) {
            // Buscar la última lectura más cercana
            $ultimaMedicion = MedicionSuelo::where('robot_id', $robot->id)
                ->latest('fecha_medicion')
                ->first();

            $humedad = $humedad ?? ($ultimaMedicion ? $ultimaMedicion->humedad : 68.0);
            $ph = $ph ?? ($ultimaMedicion ? $ultimaMedicion->ph : 6.7);
            $temp = $temp ?? ($ultimaMedicion ? $ultimaMedicion->temperatura : 22.0);
        }

        // Ejecutar algoritmo de optimización
        $eval = $optService->evaluarCondicionesSuelo((float) $humedad, (float) $ph, (float) $temp);

        if (!$eval['es_optimo']) {
            return response()->json([
                'message' => 'Inyección omitida por el algoritmo de optimización para ahorrar recursos.',
                'motivo' => $eval['justificacion'],
                'ahorro_recursos_pct' => $eval['ahorro_recursos'],
                'robot_modo' => $robot->modo,
            ], 200);
        }

        $grado = $eval['grado_recomendado'];

        // Verificar disponibilidad de cápsula en el robot
        if (!$robot->consumirCapsula($grado)) {
            // Si no tiene del grado exacto, verificar si tiene de otro grado o debe ir a base
            if ($robot->capsulas_total <= 0) {
                $robot->update(['estado' => 'retornando_base']);
                return response()->json([
                    'message' => 'El robot no cuenta con cápsulas disponibles. Retornando a la estación base para recarga.',
                    'robot' => $robot,
                ], 409);
            }
        }

        // Reducir levemente batería (0.5% por inyección)
        if ($robot->bateria > 1) {
            $robot->decrement('bateria', 1);
        }

        // Actualizar posición del robot
        $robot->update([
            'latitud' => $validated['latitud'],
            'longitud' => $validated['longitud'],
            'latitud_marte' => $validated['latitud'],
            'longitud_marte' => $validated['longitud'],
        ]);

        $capsula = Capsula::where('grado', $grado)->where('activa', true)->first();

        $inyeccion = Inyeccion::create([
            'robot_id' => $robot->id,
            'capsula_id' => $capsula?->id,
            'terreno_id' => $validated['terreno_id'] ?? $robot->terreno_id,
            'ruta_id' => $validated['ruta_id'] ?? null,
            'latitud' => $validated['latitud'],
            'longitud' => $validated['longitud'],
            'grado_capsula' => $grado,
            'humedad_suelo_detectada' => $humedad,
            'ph_detectado' => $ph,
            'temperatura_detectada' => $temp,
            'expansion_micelio_estimada_cm' => $eval['expansion_estimada_cm'],
            'ahorro_recurso_porcentaje' => $eval['ahorro_recursos'],
            'justificacion_algoritmo' => $eval['justificacion'],
            'fecha_inyeccion' => now(),
        ]);

        return response()->json([
            'message' => 'Inyección de micorriza ejecutada exitosamente en punto óptimo',
            'inyeccion' => $inyeccion->load('capsula'),
            'robot_telemetria' => [
                'bateria' => $robot->bateria,
                'capsulas_restantes' => [
                    'minimo' => $robot->capsulas_minimo,
                    'medio' => $robot->capsulas_medio,
                    'alto' => $robot->capsulas_alto,
                    'total' => $robot->capsulas_total,
                ],
            ],
            'optimizacion' => $eval,
        ], 201);
    }

    /**
     * POST /api/inyecciones/recomendar-punto
     * Determina el punto óptimo entre coordenadas y grado de cápsula a inyectar
     */
    public function recomendarPunto(Request $request, OptimizacionMycoService $optService): JsonResponse
    {
        $validated = $request->validate([
            'start.lat' => 'required|numeric',
            'start.lon' => 'required|numeric',
            'end.lat' => 'required|numeric',
            'end.lon' => 'required|numeric',
            'terreno_id' => 'nullable|exists:terrenos,id',
        ]);

        $resultado = $optService->recomendarPuntoOptimoEntreCoordenadas(
            (float) $validated['start']['lat'],
            (float) $validated['start']['lon'],
            (float) $validated['end']['lat'],
            (float) $validated['end']['lon'],
            $validated['terreno_id'] ?? null
        );

        return response()->json($resultado);
    }

    /**
     * GET /api/inyecciones/estadisticas - Estadísticas de micelio y cápsulas
     */
    public function estadisticas(): JsonResponse
    {
        $totalInyecciones = Inyeccion::count();
        $porGrado = [
            'minimo' => Inyeccion::where('grado_capsula', 'minimo')->count(),
            'medio' => Inyeccion::where('grado_capsula', 'medio')->count(),
            'alto' => Inyeccion::where('grado_capsula', 'alto')->count(),
        ];

        $expansionTotalCm = Inyeccion::sum('expansion_micelio_estimada_cm');
        $ahorroPromedio = Inyeccion::avg('ahorro_recurso_porcentaje') ?? 0;

        return response()->json([
            'total_inyecciones' => $totalInyecciones,
            'distribucion_grado' => $porGrado,
            'expansion_estimada_acumulada_metros' => round($expansionTotalCm / 100, 2),
            'ahorro_promedio_recursos_pct' => round($ahorroPromedio, 1),
        ]);
    }
}
