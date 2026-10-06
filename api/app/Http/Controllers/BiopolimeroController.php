<?php

namespace App\Http\Controllers;

use App\Models\Biopolimero;
use App\Models\Ruta;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class BiopolimeroController extends Controller
{
    /**
     * GET /api/biopolimeros - Listar todos
     */
    public function index(): JsonResponse
    {
        $biopolimeros = Biopolimero::with('ruta')->get();
        return response()->json($biopolimeros);
    }

    /**
     * POST /api/biopolimeros - Registrar nueva siembra
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ruta_id' => 'required|exists:rutas,id',
            'latitud_marte' => 'required|numeric|between:-90,90',
            'longitud_marte' => 'required|numeric|between:-180,180',
            'tipo_micelio' => 'required|string',
            'humedad_detectada' => 'nullable|integer|between:0,100',
            'toxicidad' => 'nullable|integer|between:0,100',
        ]);

        $validated['fecha_siembra'] = now();
        $validated['nivel_crecimiento'] = 0;

        $biopolimero = Biopolimero::create($validated);
        return response()->json($biopolimero, 201);
    }

    /**
     * GET /api/biopolimeros/{id}
     */
    public function show(Biopolimero $biopolimero): JsonResponse
    {
        $biopolimero->load('ruta');
        return response()->json($biopolimero);
    }

    /**
     * GET /api/biopolimeros/area - Filtrar por área geográfica
     */
    public function porArea(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'lat_min' => 'required|numeric',
            'lat_max' => 'required|numeric',
            'lon_min' => 'required|numeric',
            'lon_max' => 'required|numeric',
        ]);

        $biopolimeros = Biopolimero::whereBetween('latitud_marte', [$validated['lat_min'], $validated['lat_max']])
            ->whereBetween('longitud_marte', [$validated['lon_min'], $validated['lon_max']])
            ->with('ruta')
            ->get();

        return response()->json($biopolimeros);
    }

    /**
     * PUT /api/biopolimeros/{id}/actualizar-crecimiento
     */
    public function actualizarCrecimiento(Biopolimero $biopolimero): JsonResponse
    {
        $biopolimero->actualizarCrecimiento();
        
        return response()->json([
            'message' => 'Crecimiento actualizado',
            'biopolimero' => $biopolimero,
        ]);
    }

    /**
     * GET /api/biopolimeros/estadisticas
     */
    public function estadisticas(Request $request): JsonResponse
    {
        $query = Biopolimero::query();

        if ($request->has('ruta_id')) {
            $query->where('ruta_id', $request->input('ruta_id'));
        }

        $total = $query->count();
        $crecimiento_promedio = $query->avg('nivel_crecimiento') ?? 0;
        
        $madurosQuery = clone $query;
        $maduros = $madurosQuery->where('nivel_crecimiento', '>=', 80)->count();
        
        $toxicidad_promedio = $query->avg('toxicidad') ?? 0;

        return response()->json([
            'total_siembras' => $total,
            'crecimiento_promedio' => round($crecimiento_promedio, 2),
            'siembras_maduras' => $maduros,
            'toxicidad_promedio' => round($toxicidad_promedio, 2),
        ]);
    }
}
