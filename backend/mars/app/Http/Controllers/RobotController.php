<?php

namespace App\Http\Controllers;

use App\Models\Robot;
use App\Services\OptimizacionMycoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RobotController extends Controller
{
    /**
     * GET /api/robots - Listar todos los robots con relaciones
     */
    public function index(): JsonResponse
    {
        $robots = Robot::with(['terreno', 'estacionBase', 'rutas', 'sensores'])
            ->withCount(['mediciones', 'inyecciones'])
            ->get();

        return response()->json($robots);
    }

    /**
     * POST /api/robots - Crear nuevo robot Myco
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nombre' => 'required|string|unique:robots',
            'modelo' => 'nullable|string',
            'numero_serie' => 'nullable|string',
            'terreno_id' => 'nullable|exists:terrenos,id',
            'estacion_base_id' => 'nullable|exists:estaciones_base,id',
            'modo' => ['nullable', Rule::in(['lectura', 'inyeccion'])],
            'estado' => ['nullable', Rule::in(['activo', 'inactivo', 'mantenimiento', 'retornando_base', 'recargando'])],
            'latitud_marte' => 'nullable|numeric',
            'longitud_marte' => 'nullable|numeric',
            'latitud' => 'nullable|numeric',
            'longitud' => 'nullable|numeric',
            'bateria' => 'nullable|integer|between:0,100',
            'wifi_ssid' => 'nullable|string',
            'capacidad_capsulas' => 'nullable|integer|min:1',
            'capsulas_minimo' => 'nullable|integer|min:0',
            'capsulas_medio' => 'nullable|integer|min:0',
            'capsulas_alto' => 'nullable|integer|min:0',
            'configuracion' => 'nullable|array',
            'sensores_ir' => 'nullable|array',
        ]);

        // Sincronizar coordenadas si solo se proveyó una de las dos formas
        if (isset($validated['latitud']) && !isset($validated['latitud_marte'])) {
            $validated['latitud_marte'] = $validated['latitud'];
        } elseif (isset($validated['latitud_marte']) && !isset($validated['latitud'])) {
            $validated['latitud'] = $validated['latitud_marte'];
        }

        if (isset($validated['longitud']) && !isset($validated['longitud_marte'])) {
            $validated['longitud_marte'] = $validated['longitud'];
        } elseif (isset($validated['longitud_marte']) && !isset($validated['longitud'])) {
            $validated['longitud'] = $validated['longitud_marte'];
        }

        $robot = Robot::create($validated);
        return response()->json($robot, 201);
    }

    /**
     * GET /api/robots/{id} - Obtener detalles de un robot
     */
    public function show(Robot $robot): JsonResponse
    {
        $robot->load(['terreno', 'estacionBase', 'rutas', 'sensores', 'mediciones' => fn($q) => $q->latest()->limit(20), 'inyecciones' => fn($q) => $q->latest()->limit(20)]);
        return response()->json($robot);
    }

    /**
     * PUT /api/robots/{id} - Actualizar posición/estado del robot
     */
    public function update(Request $request, Robot $robot): JsonResponse
    {
        $validated = $request->validate([
            'nombre' => [
                'nullable',
                'string',
                Rule::unique('robots', 'nombre')->ignore($robot->id),
            ],
            'modelo' => 'nullable|string',
            'numero_serie' => 'nullable|string',
            'terreno_id' => 'nullable|exists:terrenos,id',
            'estacion_base_id' => 'nullable|exists:estaciones_base,id',
            'modo' => ['nullable', Rule::in(['lectura', 'inyeccion'])],
            'estado' => ['nullable', Rule::in(['activo', 'inactivo', 'mantenimiento', 'retornando_base', 'recargando'])],
            'latitud_marte' => 'nullable|numeric',
            'longitud_marte' => 'nullable|numeric',
            'latitud' => 'nullable|numeric',
            'longitud' => 'nullable|numeric',
            'bateria' => 'nullable|integer|between:0,100',
            'wifi_ssid' => 'nullable|string',
            'wifi_conectado' => 'nullable|boolean',
            'wifi_rssi' => 'nullable|integer',
            'capacidad_capsulas' => 'nullable|integer|min:1',
            'capsulas_minimo' => 'nullable|integer|min:0',
            'capsulas_medio' => 'nullable|integer|min:0',
            'capsulas_alto' => 'nullable|integer|min:0',
            'configuracion' => 'nullable|array',
            'sensores_ir' => 'nullable|array',
        ]);

        if (isset($validated['latitud']) && !isset($validated['latitud_marte'])) {
            $validated['latitud_marte'] = $validated['latitud'];
        } elseif (isset($validated['latitud_marte']) && !isset($validated['latitud'])) {
            $validated['latitud'] = $validated['latitud_marte'];
        }

        if (isset($validated['longitud']) && !isset($validated['longitud_marte'])) {
            $validated['longitud_marte'] = $validated['longitud'];
        } elseif (isset($validated['longitud_marte']) && !isset($validated['longitud'])) {
            $validated['longitud'] = $validated['longitud_marte'];
        }

        $robot->update($validated);
        return response()->json($robot);
    }

    /**
     * DELETE /api/robots/{id} - Eliminar robot
     */
    public function destroy(Robot $robot): JsonResponse
    {
        $robot->delete();
        return response()->json(['message' => 'Robot eliminado']);
    }

    /**
     * GET /api/robots/{id}/ubicacion - Obtener ubicación actual y telemetría
     */
    public function ubicacion(Robot $robot): JsonResponse
    {
        return response()->json([
            'robot_id' => $robot->id,
            'nombre' => $robot->nombre,
            'modo' => $robot->modo,
            'estado' => $robot->estado,
            'latitud' => $robot->latitud ?? $robot->latitud_marte,
            'longitud' => $robot->longitud ?? $robot->longitud_marte,
            'latitud_marte' => $robot->latitud_marte,
            'longitud_marte' => $robot->longitud_marte,
            'bateria' => $robot->bateria,
            'en_estacion_base' => $robot->en_estacion_base,
            'wifi_ssid' => $robot->wifi_ssid,
            'wifi_conectado' => $robot->wifi_conectado,
            'wifi_rssi' => $robot->wifi_rssi,
            'capsulas_restantes' => [
                'minimo' => $robot->capsulas_minimo,
                'medio' => $robot->capsulas_medio,
                'alto' => $robot->capsulas_alto,
                'total' => $robot->capsulas_total,
            ],
            'timestamp' => $robot->updated_at,
        ]);
    }

    /**
     * POST /api/robots/{id}/cambiar-modo - Alternar entre modo lectura e inyeccion
     */
    public function cambiarModo(Request $request, Robot $robot): JsonResponse
    {
        $validated = $request->validate([
            'modo' => ['required', Rule::in(['lectura', 'inyeccion'])],
        ]);

        $robot->update(['modo' => $validated['modo']]);

        return response()->json([
            'message' => "Modo del robot actualizado a {$validated['modo']}",
            'robot' => $robot,
        ]);
    }

    /**
     * POST /api/robots/{id}/ir-a-base - Enviar el robot a su estación base
     */
    public function irABase(Robot $robot): JsonResponse
    {
        $robot->retornarABase();

        return response()->json([
            'message' => 'Orden de retorno a estación base emitida',
            'robot' => $robot->fresh(),
        ]);
    }

    /**
     * POST /api/robots/{id}/recargar - Recargar batería y reponer cápsulas
     */
    public function recargar(Robot $robot): JsonResponse
    {
        $robot->recargar();

        return response()->json([
            'message' => 'Robot recargado al 100% de batería y cápsulas reabastecidas',
            'robot' => $robot->fresh(),
        ]);
    }

    /**
     * POST /api/robots/{id}/wifi - Actualizar conectividad Wi-Fi
     */
    public function configurarWifi(Request $request, Robot $robot): JsonResponse
    {
        $validated = $request->validate([
            'wifi_ssid' => 'required|string',
            'wifi_conectado' => 'required|boolean',
            'wifi_ip' => 'nullable|ip',
            'wifi_rssi' => 'nullable|integer',
        ]);

        $robot->update($validated);

        return response()->json([
            'message' => 'Conexión Wi-Fi actualizada',
            'robot' => $robot,
        ]);
    }

    /**
     * PUT /api/robots/{id}/configuracion - Actualizar configuración desde el gemelo digital
     */
    public function actualizarConfiguracion(Request $request, Robot $robot): JsonResponse
    {
        $validated = $request->validate([
            'configuracion' => 'required|array',
            'capacidad_capsulas' => 'nullable|integer|min:1',
        ]);

        $configActual = $robot->configuracion ?? [];
        $nuevaConfig = array_merge($configActual, $validated['configuracion']);

        $robot->update([
            'configuracion' => $nuevaConfig,
            'capacidad_capsulas' => $validated['capacidad_capsulas'] ?? $robot->capacidad_capsulas,
        ]);

        return response()->json([
            'message' => 'Configuración del robot actualizada desde el Gemelo Digital',
            'robot' => $robot,
        ]);
    }

    /**
     * POST /api/robots/{id}/optimizar-carga - Calcular cuántas cápsulas debe poner el robot
     */
    public function optimizarCarga(Request $request, Robot $robot, OptimizacionMycoService $optService): JsonResponse
    {
        $validated = $request->validate([
            'puntos_ruta' => 'required|integer|min:1',
            'humedad_promedio' => 'nullable|numeric|between:0,100',
        ]);

        $humedad = $validated['humedad_promedio'] ?? 55.0;
        $resultado = $optService->calcularCargaOptimaCapsulas($robot, $validated['puntos_ruta'], (float) $humedad);

        return response()->json($resultado);
    }
}
