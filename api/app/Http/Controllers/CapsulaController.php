<?php

namespace App\Http\Controllers;

use App\Models\Capsula;
use App\Models\EstacionBase;
use App\Models\Robot;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CapsulaController extends Controller
{
    /**
     * GET /api/capsulas - Catálogo de cápsulas con concentración de micorrizas
     */
    public function index(): JsonResponse
    {
        $capsulas = Capsula::where('activa', true)
            ->orderByRaw("CASE grado WHEN 'minimo' THEN 1 WHEN 'medio' THEN 2 WHEN 'alto' THEN 3 END")
            ->get();

        return response()->json($capsulas);
    }

    /**
     * POST /api/capsulas - Dar de alta nueva cápsula
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nombre' => 'required|string|max:255',
            'grado' => ['required', Rule::in(['minimo', 'medio', 'alto'])],
            'cantidad_micorrizas' => 'required|integer|min:100',
            'unidad_medida' => 'nullable|string',
            'tipo_hongo' => 'nullable|string',
            'humedad_suelo_optima_min' => 'nullable|numeric|between:0,100',
            'humedad_suelo_optima_max' => 'nullable|numeric|between:0,100',
            'radio_expansion_estimado_m' => 'nullable|numeric|min:0.1',
            'costo_recurso' => 'nullable|numeric|min:0.1',
            'descripcion' => 'nullable|string',
        ]);

        $capsula = Capsula::create($validated);
        return response()->json($capsula, 201);
    }

    /**
     * GET /api/capsulas/{id} - Detalle de una cápsula
     */
    public function show(Capsula $capsula): JsonResponse
    {
        return response()->json($capsula);
    }

    /**
     * PUT /api/capsulas/{id} - Actualizar especificaciones desde el Gemelo Digital
     */
    public function update(Request $request, Capsula $capsula): JsonResponse
    {
        $validated = $request->validate([
            'nombre' => 'nullable|string|max:255',
            'grado' => ['nullable', Rule::in(['minimo', 'medio', 'alto'])],
            'cantidad_micorrizas' => 'nullable|integer|min:100',
            'unidad_medida' => 'nullable|string',
            'tipo_hongo' => 'nullable|string',
            'humedad_suelo_optima_min' => 'nullable|numeric|between:0,100',
            'humedad_suelo_optima_max' => 'nullable|numeric|between:0,100',
            'radio_expansion_estimado_m' => 'nullable|numeric|min:0.1',
            'costo_recurso' => 'nullable|numeric|min:0.1',
            'descripcion' => 'nullable|string',
            'activa' => 'nullable|boolean',
        ]);

        $capsula->update($validated);

        return response()->json([
            'message' => 'Cápsula actualizada correctamente desde el Gemelo Digital',
            'capsula' => $capsula,
        ]);
    }

    /**
     * GET /api/capsulas/inventario - Estado global de existencias en estaciones base y robots
     */
    public function inventario(): JsonResponse
    {
        $stockRobots = [
            'minimo' => Robot::sum('capsulas_minimo'),
            'medio' => Robot::sum('capsulas_medio'),
            'alto' => Robot::sum('capsulas_alto'),
            'total' => Robot::sum('capsulas_minimo') + Robot::sum('capsulas_medio') + Robot::sum('capsulas_alto'),
        ];

        $stockBases = [
            'minimo' => EstacionBase::sum('stock_capsulas_minimo'),
            'medio' => EstacionBase::sum('stock_capsulas_medio'),
            'alto' => EstacionBase::sum('stock_capsulas_alto'),
            'total' => EstacionBase::sum('stock_capsulas_minimo') + EstacionBase::sum('stock_capsulas_medio') + EstacionBase::sum('stock_capsulas_alto'),
        ];

        return response()->json([
            'en_robots' => $stockRobots,
            'en_estaciones_base' => $stockBases,
            'total_sistema' => [
                'minimo' => $stockRobots['minimo'] + $stockBases['minimo'],
                'medio' => $stockRobots['medio'] + $stockBases['medio'],
                'alto' => $stockRobots['alto'] + $stockBases['alto'],
                'total' => $stockRobots['total'] + $stockBases['total'],
            ],
        ]);
    }
}
