<?php

namespace App\Http\Controllers;

use App\Models\EstacionBase;
use App\Models\Terreno;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TerrenoController extends Controller
{
    /**
     * GET /api/terrenos - Listar todos los terrenos
     */
    public function index(Request $request): JsonResponse
    {
        $query = Terreno::with(['cliente', 'estacionesBase', 'robots']);

        if ($request->has('entorno')) {
            $query->where('entorno', $request->input('entorno'));
        }

        if ($request->has('cliente_id')) {
            $query->where('cliente_id', $request->input('cliente_id'));
        }

        return response()->json($query->get());
    }

    /**
     * POST /api/terrenos - Crear nuevo terreno
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nombre' => 'required|string|max:255',
            'descripcion' => 'nullable|string',
            'cliente_id' => 'nullable|exists:users,id',
            'entorno' => ['required', Rule::in(['tierra', 'marte'])],
            'latitud_central' => 'required|numeric',
            'longitud_central' => 'required|numeric',
            'poligono_coordenadas' => 'nullable|array',
            'dimensiones_m2' => 'nullable|numeric|min:10',
            'red_wifi_ssid' => 'nullable|string',
            'red_wifi_pass' => 'nullable|string',
            'red_wifi_status' => 'nullable|string|max:50',
            'condiciones_terreno' => 'nullable|array',
            'elevacion_data' => 'nullable|array',
            'rutas_rovers' => 'nullable|array',
            'clusters_muestreo' => 'nullable|array',
            'puntos_inicio_escaneo' => 'nullable|array',
        ]);

        $terreno = Terreno::create($validated);
        return response()->json($terreno, 201);
    }

    /**
     * GET /api/terrenos/{id} - Detalle de terreno
     */
    public function show(Terreno $terreno): JsonResponse
    {
        $terreno->load([
            'cliente',
            'estacionesBase',
            'robots.sensores',
            'mediciones' => fn($q) => $q->latest('fecha_medicion')->limit(100),
            'inyecciones' => fn($q) => $q->latest('fecha_inyeccion')->limit(100),
        ]);
        return response()->json($terreno);
    }

    /**
     * PUT /api/terrenos/{id} - Actualizar terreno
     */
    public function update(Request $request, Terreno $terreno): JsonResponse
    {
        $validated = $request->validate([
            'nombre' => 'nullable|string|max:255',
            'descripcion' => 'nullable|string',
            'cliente_id' => 'nullable|exists:users,id',
            'entorno' => ['nullable', Rule::in(['tierra', 'marte'])],
            'latitud_central' => 'nullable|numeric',
            'longitud_central' => 'nullable|numeric',
            'poligono_coordenadas' => 'nullable|array',
            'dimensiones_m2' => 'nullable|numeric|min:10',
            'red_wifi_ssid' => 'nullable|string',
            'red_wifi_pass' => 'nullable|string',
            'red_wifi_status' => 'nullable|string|max:50',
            'condiciones_terreno' => 'nullable|array',
            'elevacion_data' => 'nullable|array',
            'rutas_rovers' => 'nullable|array',
            'clusters_muestreo' => 'nullable|array',
            'puntos_inicio_escaneo' => 'nullable|array',
        ]);

        $terreno->update($validated);
        return response()->json($terreno);
    }

    /**
     * GET /api/estaciones-base - Listar estaciones de recarga y abastecimiento
     */
    public function estacionesBase(): JsonResponse
    {
        $estaciones = EstacionBase::with(['terreno', 'robots'])->get();
        return response()->json($estaciones);
    }

    /**
     * POST /api/estaciones-base - Crear nueva estación base
     */
    public function storeEstacionBase(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nombre' => 'required|string|max:255',
            'terreno_id' => 'nullable|exists:terrenos,id',
            'latitud' => 'required|numeric',
            'longitud' => 'required|numeric',
            'estado' => ['nullable', Rule::in(['operativa', 'ocupada', 'mantenimiento'])],
            'stock_capsulas_minimo' => 'nullable|integer|min:0',
            'stock_capsulas_medio' => 'nullable|integer|min:0',
            'stock_capsulas_alto' => 'nullable|integer|min:0',
        ]);

        $estacion = EstacionBase::create($validated);
        return response()->json($estacion, 201);
    }
}
