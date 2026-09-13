<?php

namespace App\Http\Controllers;

use App\Models\MedicionSuelo;
use App\Models\Robot;
use App\Services\OptimizacionMycoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MedicionController extends Controller
{
    /**
     * GET /api/mediciones - Historial de lecturas de suelo
     */
    public function index(Request $request): JsonResponse
    {
        $query = MedicionSuelo::with(['robot', 'terreno']);

        if ($request->has('robot_id')) {
            $query->where('robot_id', $request->input('robot_id'));
        }

        if ($request->has('terreno_id')) {
            $query->where('terreno_id', $request->input('terreno_id'));
        }

        if ($request->boolean('solo_optimas')) {
            $query->where('es_optimo_inyeccion', true);
        }

        $mediciones = $query->latest('fecha_medicion')->paginate($request->input('per_page', 50));
        return response()->json($mediciones);
    }

    /**
     * POST /api/mediciones - Alta de medición de suelo tomada por un robot en modo lectura
     */
    public function store(Request $request, OptimizacionMycoService $optService): JsonResponse
    {
        $validated = $request->validate([
            'robot_id' => 'required|exists:robots,id',
            'terreno_id' => 'nullable|exists:terrenos,id',
            'latitud' => 'required|numeric',
            'longitud' => 'required|numeric',
            'ph' => 'required|numeric|between:0,14',
            'temperatura' => 'required|numeric|between:-100,100',
            'humedad' => 'required|numeric|between:0,100',
            'conductividad' => 'nullable|numeric',
            'fecha_medicion' => 'nullable|date',
        ]);

        $robot = Robot::findOrFail($validated['robot_id']);

        // Evaluar condiciones con el algoritmo de optimización
        $eval = $optService->evaluarCondicionesSuelo(
            (float) $validated['humedad'],
            (float) $validated['ph'],
            (float) $validated['temperatura']
        );

        $validated['es_optimo_inyeccion'] = $eval['es_optimo'];
        $validated['grado_sugerido'] = $eval['grado_recomendado'];
        $validated['fecha_medicion'] = $validated['fecha_medicion'] ?? now();

        $medicion = MedicionSuelo::create($validated);

        // Actualizar la última posición y telemetría del robot
        $robot->update([
            'latitud' => $validated['latitud'],
            'longitud' => $validated['longitud'],
            'latitud_marte' => $validated['latitud'],
            'longitud_marte' => $validated['longitud'],
        ]);

        return response()->json([
            'message' => 'Medición de suelo registrada exitosamente por el robot en modo lectura',
            'medicion' => $medicion,
            'analisis_optimizacion' => $eval,
        ], 201);
    }

    /**
     * GET /api/mediciones/recientes - Últimas mediciones en tiempo real para el Gemelo Digital
     */
    public function recientes(Request $request): JsonResponse
    {
        $limite = $request->input('limite', 30);
        $mediciones = MedicionSuelo::with('robot')
            ->latest('fecha_medicion')
            ->limit($limite)
            ->get();

        return response()->json($mediciones);
    }

    /**
     * GET /api/mediciones/mapa-calor - Agrupación de datos para visualización de mapa de calor
     */
    public function mapaCalor(Request $request): JsonResponse
    {
        $terrenoId = $request->input('terreno_id');

        $puntos = MedicionSuelo::when($terrenoId, fn($q) => $q->where('terreno_id', $terrenoId))
            ->latest('fecha_medicion')
            ->limit(200)
            ->get(['id', 'latitud', 'longitud', 'ph', 'temperatura', 'humedad', 'es_optimo_inyeccion', 'grado_sugerido']);

        return response()->json([
            'total_muestras' => $puntos->count(),
            'puntos' => $puntos,
        ]);
    }
}
