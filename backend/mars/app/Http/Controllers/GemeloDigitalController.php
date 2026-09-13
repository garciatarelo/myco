<?php

namespace App\Http\Controllers;

use App\Models\Capsula;
use App\Models\EstacionBase;
use App\Models\Inyeccion;
use App\Models\MedicionSuelo;
use App\Models\Robot;
use App\Models\Simulacion;
use App\Models\Terreno;
use App\Services\OptimizacionMycoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class GemeloDigitalController extends Controller
{
    /**
     * GET /api/gemelo-digital/estado - Monitoreo global en tiempo real para el Gemelo Digital
     */
    public function estado(Request $request): JsonResponse
    {
        $terrenoId = $request->input('terreno_id');

        $robots = Robot::when($terrenoId, fn($q) => $q->where('terreno_id', $terrenoId))
            ->with(['estacionBase'])
            ->get();

        $terrenos = Terreno::when($terrenoId, fn($q) => $q->where('id', $terrenoId))
            ->with('estacionesBase')
            ->get();

        $ultimasMediciones = MedicionSuelo::when($terrenoId, fn($q) => $q->where('terreno_id', $terrenoId))
            ->latest('fecha_medicion')
            ->limit(50)
            ->get();

        $inyeccionesRecientes = Inyeccion::when($terrenoId, fn($q) => $q->where('terreno_id', $terrenoId))
            ->with('capsula')
            ->latest('fecha_inyeccion')
            ->limit(30)
            ->get();

        $estacionesBase = EstacionBase::when($terrenoId, fn($q) => $q->where('terreno_id', $terrenoId))->get();

        $capsulas = Capsula::where('activa', true)->get();

        // Métricas de estado del terreno
        $humedadPromedio = $ultimasMediciones->avg('humedad') ?? 50.0;
        $phPromedio = $ultimasMediciones->avg('ph') ?? 6.8;
        $tempPromedio = $ultimasMediciones->avg('temperatura') ?? 21.0;
        $coberturaMicelialCm = Inyeccion::sum('expansion_micelio_estimada_cm');

        return response()->json([
            'timestamp' => now(),
            'estado_terreno' => [
                'humedad_promedio_pct' => round($humedadPromedio, 1),
                'ph_promedio' => round($phPromedio, 2),
                'temperatura_promedio_c' => round($tempPromedio, 1),
                'expansion_micelial_m2' => round($coberturaMicelialCm / 100, 2),
                'puntos_monitoreados' => $ultimasMediciones->count(),
            ],
            'flota_robots' => $robots,
            'terrenos' => $terrenos,
            'estaciones_base' => $estacionesBase,
            'capsulas_catalogo' => $capsulas,
            'mediciones_recientes' => $ultimasMediciones,
            'inyecciones_recientes' => $inyeccionesRecientes,
        ]);
    }

    /**
     * POST /api/gemelo-digital/configuracion
     * Actualiza la configuración de robots y/o cápsulas directamente desde el Gemelo Digital
     */
    public function actualizarConfiguracion(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'robot_id' => 'nullable|exists:robots,id',
            'robot_config' => 'nullable|array',
            'capsula_id' => 'nullable|exists:capsulas,id',
            'capsula_config' => 'nullable|array',
            'config_general' => 'nullable|array',
        ]);

        $cambios = [];

        if (!empty($validated['robot_id']) && !empty($validated['robot_config'])) {
            $robot = Robot::find($validated['robot_id']);
            $actual = $robot->configuracion ?? [];
            $robot->update(['configuracion' => array_merge($actual, $validated['robot_config'])]);
            $cambios['robot'] = $robot;
        }

        if (!empty($validated['capsula_id']) && !empty($validated['capsula_config'])) {
            $capsula = Capsula::find($validated['capsula_id']);
            $capsula->update($validated['capsula_config']);
            $cambios['capsula'] = $capsula;
        }

        return response()->json([
            'message' => 'Configuración sincronizada desde el Gemelo Digital',
            'cambios_aplicados' => $cambios,
        ]);
    }

    /**
     * POST /api/simulaciones/ejecutar
     * Ejecuta una simulación temporal bajo condiciones ideales, extremas o de Marte
     */
    public function ejecutarSimulacion(Request $request, OptimizacionMycoService $optService): JsonResponse
    {
        $validated = $request->validate([
            'nombre' => 'required|string|max:255',
            'entorno' => ['required', Rule::in(['tierra', 'marte'])],
            'tipo_condicion' => ['required', Rule::in(['ideal', 'extrema', 'marte', 'personalizada'])],
            'duracion_dias' => 'nullable|integer|min:1|max:365',
            'parametros' => 'nullable|array',
            'terreno_id' => 'nullable|exists:terrenos,id',
            'robot_id' => 'nullable|exists:robots,id',
        ]);

        $duracion = $validated['duracion_dias'] ?? 30;
        $parametros = $validated['parametros'] ?? [];

        // Ejecutar simulación matemática con el servicio
        $resultado = $optService->ejecutarSimulacionTemporal(
            $validated['nombre'],
            $validated['entorno'],
            $validated['tipo_condicion'],
            $duracion,
            $parametros
        );

        // Guardar registro de la simulación
        $simulacion = Simulacion::create([
            'nombre' => $validated['nombre'],
            'entorno' => $validated['entorno'],
            'tipo_condicion' => $validated['tipo_condicion'],
            'parametros' => array_merge($parametros, ['duracion_dias' => $duracion]),
            'resultados' => $resultado['resultados'],
            'terreno_id' => $validated['terreno_id'] ?? null,
            'robot_id' => $validated['robot_id'] ?? null,
            'duracion_dias' => $duracion,
            'cobertura_micelio_porcentaje' => min(100.0, ($resultado['resultados']['cobertura_final_m2'] / 50.0) * 100),
            'estado' => 'completada',
        ]);

        return response()->json([
            'message' => 'Simulación temporal completada exitosamente',
            'simulacion' => $simulacion,
            'resumen' => $resultado,
        ], 201);
    }

    /**
     * GET /api/simulaciones - Listar simulaciones realizadas
     */
    public function simulaciones(Request $request): JsonResponse
    {
        $query = Simulacion::query();

        if ($request->has('entorno')) {
            $query->where('entorno', $request->input('entorno'));
        }

        if ($request->has('tipo_condicion')) {
            $query->where('tipo_condicion', $request->input('tipo_condicion'));
        }

        $simulaciones = $query->latest()->get();
        return response()->json($simulaciones);
    }

    /**
     * GET /api/simulaciones/{id} - Detalle de una simulación
     */
    public function detalleSimulacion(Simulacion $simulacion): JsonResponse
    {
        return response()->json($simulacion);
    }
}
